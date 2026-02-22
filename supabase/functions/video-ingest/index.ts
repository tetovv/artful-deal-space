import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

/* ── Moment construction logic ── */

interface TranscriptRow {
  id: string;
  video_id: string;
  start_sec: number;
  end_sec: number;
  text: string;
  speaker_id: string | null;
  confidence: number | null;
}

interface SceneRow {
  id: string;
  video_id: string;
  start_sec: number;
  end_sec: number;
  keyframe_ref: string | null;
}

/** Merge transcript segments into fixed-window moments (5-20s). */
function buildMomentsFromTranscript(
  transcripts: TranscriptRow[],
  videoId: string,
  windowSec = 15,
  minWindow = 5,
  maxWindow = 20,
): any[] {
  if (transcripts.length === 0) return [];

  // Sort by start time
  const sorted = [...transcripts].sort((a, b) => a.start_sec - b.start_sec);
  const totalEnd = Math.max(...sorted.map((t) => t.end_sec));
  const moments: any[] = [];

  let windowStart = sorted[0].start_sec;

  while (windowStart < totalEnd) {
    let windowEnd = windowStart + windowSec;

    // Collect transcript segments overlapping this window
    const overlapping = sorted.filter(
      (t) => t.start_sec < windowEnd && t.end_sec > windowStart,
    );

    if (overlapping.length === 0) {
      windowStart = windowEnd;
      continue;
    }

    // Adjust window to snap to segment boundaries
    const actualStart = Math.max(windowStart, overlapping[0].start_sec);
    const actualEnd = Math.min(
      windowEnd,
      overlapping[overlapping.length - 1].end_sec,
    );
    const duration = actualEnd - actualStart;

    // Skip if too short
    if (duration < minWindow) {
      windowStart = windowEnd;
      continue;
    }

    // Truncate to maxWindow
    const clampedEnd =
      duration > maxWindow ? actualStart + maxWindow : actualEnd;

    // Build snippet from overlapping text
    const snippet = overlapping
      .map((t) => t.text)
      .join(" ")
      .slice(0, 500);

    moments.push({
      video_id: videoId,
      start_sec: actualStart,
      end_sec: clampedEnd,
      transcript_snippet: snippet,
      entity_tags: [],
      action_tags: [],
      emotion_tags: [],
      visual_caption: null,
      embedding_ref_text: null,
      embedding_ref_vision: null,
      safety_flags: {},
      popularity_signals: {},
    });

    windowStart = clampedEnd;
  }

  return moments;
}

/** Fallback: build coarse moments from scene segments when no transcript. */
function buildMomentsFromScenes(
  scenes: SceneRow[],
  videoId: string,
): any[] {
  if (scenes.length === 0) return [];

  return scenes.map((s) => ({
    video_id: videoId,
    start_sec: s.start_sec,
    end_sec: s.end_sec,
    transcript_snippet: "",
    entity_tags: [],
    action_tags: [],
    emotion_tags: [],
    visual_caption: null,
    embedding_ref_text: null,
    embedding_ref_vision: null,
    safety_flags: {},
    popularity_signals: {},
  }));
}

/** Core pipeline: build moment index for a single video. */
async function buildMomentIndex(
  supabase: any,
  videoId: string,
): Promise<{ momentsCreated: number; source: string }> {
  // Verify video exists
  const { data: video } = await supabase
    .from("content_items")
    .select("id, type, title")
    .eq("id", videoId)
    .single();

  if (!video) throw new Error(`Video ${videoId} not found`);

  // Clear existing moments for idempotency
  await supabase
    .from("moment_index")
    .delete()
    .eq("video_id", videoId);

  // Try transcript first
  const { data: transcripts } = await supabase
    .from("transcript_segments")
    .select("*")
    .eq("video_id", videoId)
    .order("start_sec", { ascending: true });

  let moments: any[];
  let source: string;

  if (transcripts && transcripts.length > 0) {
    moments = buildMomentsFromTranscript(transcripts, videoId);
    source = "transcript";
  } else {
    // Fallback to scenes
    const { data: scenes } = await supabase
      .from("scene_segments")
      .select("*")
      .eq("video_id", videoId)
      .order("start_sec", { ascending: true });

    moments = buildMomentsFromScenes(scenes || [], videoId);
    source = scenes && scenes.length > 0 ? "scenes" : "none";
  }

  // Insert moments
  if (moments.length > 0) {
    const { error: insertErr } = await supabase
      .from("moment_index")
      .insert(moments);

    if (insertErr) {
      console.error("Insert moments error:", insertErr);
      throw new Error("Failed to insert moments");
    }
  }

  return { momentsCreated: moments.length, source };
}

/* ── Batch indexing: process all unindexed published videos ── */

async function indexAllUnindexed(supabase: any): Promise<any[]> {
  // Find published videos that have no moment_index rows
  const { data: videos } = await supabase
    .from("content_items")
    .select("id, title")
    .eq("type", "video")
    .eq("status", "published");

  if (!videos || videos.length === 0) {
    return [];
  }

  // Check which already have moments
  const { data: indexed } = await supabase
    .from("moment_index")
    .select("video_id")
    .in(
      "video_id",
      videos.map((v: any) => v.id),
    );

  const indexedSet = new Set(
    (indexed || []).map((r: any) => r.video_id),
  );
  const unindexed = videos.filter((v: any) => !indexedSet.has(v.id));

  const results: any[] = [];
  for (const v of unindexed) {
    try {
      const result = await buildMomentIndex(supabase, v.id);
      results.push({ videoId: v.id, title: v.title, ...result });
    } catch (e) {
      results.push({
        videoId: v.id,
        title: v.title,
        error: (e as Error).message,
      });
    }
  }

  return results;
}

/* ── HTTP handler ── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader || "" } } },
  );

  let userId: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsErr } = await supabase.auth.getClaims(token);
    if (!claimsErr && data?.claims?.sub) {
      userId = data.claims.sub as string;
    }
  }

  if (!userId) return err("Unauthorized", 401);

  // Use service-role client for writes (moment_index RLS is SELECT-only for anon)
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const fnIdx = pathParts.indexOf("video-ingest");
  const sub = pathParts.slice(fnIdx + 1);

  try {
    if (req.method === "POST" && sub.length === 0) {
      // POST /video-ingest — index a single video
      const body = await req.json();
      const videoId = body.videoId;
      if (!videoId) return err("videoId is required");

      const result = await buildMomentIndex(serviceClient, videoId);
      return json({ videoId, ...result });
    }

    if (req.method === "POST" && sub[0] === "batch") {
      // POST /video-ingest/batch — index all unindexed videos
      const results = await indexAllUnindexed(serviceClient);
      return json({
        processed: results.length,
        results,
      });
    }

    return err("Not found", 404);
  } catch (e) {
    console.error("video-ingest error:", e);
    return err((e as Error).message || "Internal error", 500);
  }
});
