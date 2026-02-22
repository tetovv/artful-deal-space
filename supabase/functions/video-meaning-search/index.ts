import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── helpers ── */

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

/** Preview policy: for restricted content, strip transcript snippets and deep data. */
function applyPreviewPolicy(
  moment: Record<string, unknown>,
  hasAccess: boolean,
) {
  if (hasAccess) return { ...moment, access: "allowed" };
  return {
    id: moment.id,
    video_id: moment.video_id,
    start_sec: moment.start_sec,
    end_sec: moment.end_sec,
    // No transcript_snippet, no entity/action/emotion tags
    transcript_snippet: null,
    entity_tags: [],
    action_tags: [],
    emotion_tags: [],
    visual_caption: null,
    access: "locked",
  };
}

/** Build entitlement sets for the current user. */
async function buildEntitlements(supabase: any, userId: string) {
  const [{ data: purchases }, { data: subs }] = await Promise.all([
    supabase
      .from("purchases")
      .select("content_id")
      .eq("user_id", userId),
    supabase
      .from("subscriptions")
      .select("creator_id")
      .eq("user_id", userId),
  ]);

  const purchasedIds = new Set(
    (purchases || []).map((p: any) => p.content_id),
  );
  const subscribedCreatorIds = new Set(
    (subs || []).map((s: any) => s.creator_id),
  );

  return { purchasedIds, subscribedCreatorIds };
}

function hasAccessToContent(
  content: Record<string, unknown>,
  purchasedIds: Set<string>,
  subscribedCreatorIds: Set<string>,
): boolean {
  if (
    content.monetization_type === "free" ||
    !content.price ||
    (content.price as number) === 0
  ) {
    return true;
  }
  if (purchasedIds.has(content.id as string)) return true;
  if (subscribedCreatorIds.has(content.creator_id as string)) return true;
  return false;
}

/* ── mock search logic (MVP stub) ── */

async function mockSearch(
  supabase: any,
  _queryText: string,
  includePrivate: boolean,
  userId: string,
) {
  // Fetch published video moments (public scope)
  let momentQuery = supabase
    .from("moment_index")
    .select(
      "*, content_items!inner(id, title, creator_name, creator_id, monetization_type, price, status, type)",
    )
    .eq("content_items.status", "published")
    .eq("content_items.type", "video")
    .limit(20);

  const { data: moments } = await momentQuery;

  if (!moments || moments.length === 0) {
    // Return deterministic empty result
    return { best: null, moreVideos: [], montageCandidates: [] };
  }

  const ent = await buildEntitlements(supabase, userId);

  const enriched = moments.map((m: any) => {
    const ci = m.content_items;
    const access = hasAccessToContent(ci, ent.purchasedIds, ent.subscribedCreatorIds);
    const filtered = applyPreviewPolicy(m, access);
    return {
      ...filtered,
      video_title: ci.title,
      creator_name: ci.creator_name,
      score: Math.random(), // mock relevance
    };
  });

  enriched.sort((a: any, b: any) => b.score - a.score);

  return {
    best: enriched[0] || null,
    moreVideos: enriched.slice(1),
    montageCandidates: enriched.filter((e: any) => e.access === "allowed").slice(0, 5),
  };
}

/* ── route handlers ── */

async function handleSearch(supabase: any, userId: string, body: any) {
  const queryText = (body.queryText || "").trim();
  if (!queryText) return err("queryText is required");

  const includePrivate = body.includePrivateSources === true;
  const preferences = body.preferences || {};

  // Parse intent (mock)
  const parsedIntent = { raw: queryText, type: "videoMeaning" };

  // Persist query
  const { data: query, error: qErr } = await supabase
    .from("video_search_queries")
    .insert({
      user_id: userId,
      query_text: queryText,
      mode: "videoMeaning",
      parsed_intent: parsedIntent,
      preferences,
      include_private_sources: includePrivate,
      status: "completed",
    })
    .select("id")
    .single();

  if (qErr) return err("Failed to create query", 500);

  // Snapshot entitlements
  const ent = await buildEntitlements(supabase, userId);
  await supabase.from("video_access_snapshots").insert({
    query_id: query.id,
    user_id: userId,
    entitlement_summary: {
      purchased_count: ent.purchasedIds.size,
      subscribed_count: ent.subscribedCreatorIds.size,
    },
  });

  // Run search
  const results = await mockSearch(supabase, queryText, includePrivate, userId);

  // Persist results for moments that exist
  if (results.best) {
    const allResults = [results.best, ...results.moreVideos].filter(
      (r: any) => r.id,
    );
    const inserts = allResults.map((r: any) => ({
      query_id: query.id,
      moment_id: r.id,
      score: r.score || 0,
      rationale: { mock: true },
    }));
    if (inserts.length > 0) {
      await supabase.from("video_search_results").insert(inserts);
    }
  }

  return json({
    needsClarification: false,
    queryId: query.id,
    results,
  });
}

async function handleClarify(supabase: any, userId: string, body: any) {
  const { queryId, answersJson } = body;
  if (!queryId) return err("queryId is required");

  // Update clarifications
  const { data: existing } = await supabase
    .from("video_search_queries")
    .select("*")
    .eq("id", queryId)
    .eq("user_id", userId)
    .single();

  if (!existing) return err("Query not found", 404);

  const clarifications = [
    ...((existing.clarifications as any[]) || []),
    { answers: answersJson, at: new Date().toISOString() },
  ];

  await supabase
    .from("video_search_queries")
    .update({ clarifications, status: "completed" })
    .eq("id", queryId);

  // Re-run search with same params
  const results = await mockSearch(
    supabase,
    existing.query_text,
    existing.include_private_sources,
    userId,
  );

  return json({ queryId, results });
}

async function handleGetQuery(
  supabase: any,
  userId: string,
  queryId: string,
) {
  const { data: query } = await supabase
    .from("video_search_queries")
    .select("*")
    .eq("id", queryId)
    .eq("user_id", userId)
    .single();

  if (!query) return err("Query not found", 404);

  const { data: results } = await supabase
    .from("video_search_results")
    .select("*, moment_index(*)")
    .eq("query_id", queryId)
    .order("score", { ascending: false });

  return json({
    query,
    intent: query.parsed_intent,
    clarifications: query.clarifications,
    results: results || [],
  });
}

async function handleCreateMontage(
  supabase: any,
  userId: string,
  body: any,
) {
  const {
    queryId,
    selectedMomentIds,
    leadInSeconds = 2,
    maxSegments = 10,
    targetDurationSec = 60,
  } = body;
  if (!queryId) return err("queryId is required");

  // Build segments from selected moments or top results
  let momentIds = selectedMomentIds;
  if (!momentIds || momentIds.length === 0) {
    const { data: topResults } = await supabase
      .from("video_search_results")
      .select("moment_id")
      .eq("query_id", queryId)
      .order("score", { ascending: false })
      .limit(maxSegments);
    momentIds = (topResults || []).map((r: any) => r.moment_id);
  }

  // Create montage project (reuse existing montage_projects table)
  const { data: project, error: pErr } = await supabase
    .from("montage_projects")
    .insert({
      user_id: userId,
      source_query_id: queryId,
      target_duration: targetDurationSec,
      scope: "video_meaning_search",
      status: "completed",
    })
    .select("id")
    .single();

  if (pErr) return err("Failed to create montage", 500);

  // Fetch moments for segments
  if (momentIds.length > 0) {
    const { data: moments } = await supabase
      .from("moment_index")
      .select("id, video_id, start_sec, end_sec, transcript_snippet")
      .in("id", momentIds);

    const segments = (moments || []).map((m: any, i: number) => ({
      montage_id: project.id,
      source_type: "video",
      source_id: m.video_id,
      start_sec: Math.max(0, m.start_sec - leadInSeconds),
      end_sec: m.end_sec,
      rationale: m.transcript_snippet?.slice(0, 100) || "",
      sort_order: i,
      segment_status: "included",
    }));

    if (segments.length > 0) {
      await supabase.from("montage_segments").insert(segments);
    }
  }

  return json({ projectId: project.id, status: "completed" });
}

async function handleGetMontage(
  supabase: any,
  userId: string,
  projectId: string,
) {
  const { data: project } = await supabase
    .from("montage_projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) return err("Montage not found", 404);

  const { data: segments } = await supabase
    .from("montage_segments")
    .select("*")
    .eq("montage_id", projectId)
    .order("sort_order", { ascending: true });

  const totalDuration = (segments || []).reduce(
    (s: number, seg: any) => s + (seg.end_sec - seg.start_sec),
    0,
  );

  return json({
    status: project.status,
    segments: segments || [],
    totalDurationSec: totalDuration,
  });
}

/* ── main handler ── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Paths: /video-meaning-search, /video-meaning-search/clarify,
  //        /video-meaning-search/:queryId,
  //        /video-meaning-search/montage, /video-meaning-search/montage/:id

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

  // Route: last meaningful segment after function name
  const fnIdx = pathParts.indexOf("video-meaning-search");
  const sub = pathParts.slice(fnIdx + 1);

  try {
    // POST /video-meaning-search (search)
    if (req.method === "POST" && sub.length === 0) {
      const body = await req.json();
      return handleSearch(supabase, userId, body);
    }

    // POST /video-meaning-search/clarify
    if (req.method === "POST" && sub[0] === "clarify") {
      const body = await req.json();
      return handleClarify(supabase, userId, body);
    }

    // POST /video-meaning-search/montage
    if (req.method === "POST" && sub[0] === "montage") {
      const body = await req.json();
      return handleCreateMontage(supabase, userId, body);
    }

    // GET /video-meaning-search/montage/:id
    if (req.method === "GET" && sub[0] === "montage" && sub[1]) {
      return handleGetMontage(supabase, userId, sub[1]);
    }

    // GET /video-meaning-search/:queryId
    if (req.method === "GET" && sub[0] && sub[0] !== "montage") {
      return handleGetQuery(supabase, userId, sub[0]);
    }

    return err("Not found", 404);
  } catch (e) {
    console.error("video-meaning-search error:", e);
    return err("Internal error", 500);
  }
});
