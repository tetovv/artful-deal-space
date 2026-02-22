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

/* ── clarification logic ── */

interface ClarificationQuestion {
  id: string;
  text: string;
  reason: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}

/** Detect what the query already tells us so we skip those questions. */
function parseExplicitPrefs(queryText: string) {
  const lower = queryText.toLowerCase();
  const detected: Record<string, string> = {};

  // Output type detection
  if (/нарезк|монтаж|compilation/i.test(lower)) detected.outputType = "montage";
  else if (/момент|отрыв|clip|фрагмент/i.test(lower)) detected.outputType = "just_moment";
  else if (/несколько|больше|список|подборк/i.test(lower)) detected.outputType = "more_videos";
  else if (/лучш|один|single|best/i.test(lower)) detected.outputType = "one_best";

  // Duration detection
  if (/коротк|short|<=?\s*60|минут/i.test(lower) && !/полн/i.test(lower)) detected.duration = "short";
  else if (/средн|medium|5\s*мин/i.test(lower)) detected.duration = "medium";
  else if (/полн|full|целиком|выпуск|эпизод/i.test(lower)) detected.duration = "full";

  // Recency
  if (/недавн|последн|свеж|новы[хйе]/i.test(lower)) detected.recency = "recent";

  // "Why laughed" intent
  const isLaughIntent = /смеял|смешн|ржал|угар|laugh|funny/i.test(lower);

  return { detected, isLaughIntent };
}

function buildClarificationQuestions(
  queryText: string,
  preferences: Record<string, string>,
): ClarificationQuestion[] {
  const { detected, isLaughIntent } = parseExplicitPrefs(queryText);
  const questions: ClarificationQuestion[] = [];

  // Priority 1: Output type
  if (!detected.outputType && !preferences.resultType) {
    questions.push({
      id: "outputType",
      text: "Что именно вы хотите получить?",
      reason: "Это поможет подобрать формат результата под вашу задачу.",
      options: [
        { value: "one_best", label: "Один лучший" },
        { value: "more_videos", label: "Больше видео" },
        { value: "montage", label: "Монтаж" },
        { value: "just_moment", label: "Только момент" },
      ],
      defaultValue: "one_best",
    });
  }

  // Priority 2: Duration
  if (!detected.duration && !preferences.length) {
    questions.push({
      id: "duration",
      text: "Какая длительность вам подходит?",
      reason: "Так мы покажем фрагменты нужной длины, а не всё подряд.",
      options: [
        { value: "short", label: "Короткое (≤60с)" },
        { value: "medium", label: "Среднее (1–5 мин)" },
        { value: "full", label: "Полный выпуск" },
      ],
      defaultValue: "short",
    });
  }

  // If we already have 2, stop here
  if (questions.length >= 2) return questions.slice(0, 2);

  // Priority 3: context for laugh intents
  if (isLaughIntent && questions.length < 2) {
    questions.push({
      id: "includeContext",
      text: "Включить контекст перед моментом?",
      reason: "Иногда шутка понятна только с предысторией.",
      options: [
        { value: "yes", label: "Да, с контекстом" },
        { value: "no", label: "Нет, только момент" },
      ],
      defaultValue: "yes",
    });
  }

  // Priority 3: Recency (only if still room)
  if (!detected.recency && questions.length < 2) {
    questions.push({
      id: "recency",
      text: "За какой период искать?",
      reason: "Ограничение по времени помогает найти актуальный контент.",
      options: [
        { value: "recent", label: "Последние 12 месяцев" },
        { value: "any", label: "За всё время" },
      ],
      defaultValue: "any",
    });
  }

  return questions.slice(0, 2);
}

/** Decide if clarification is needed. */
function needsClarification(
  queryText: string,
  preferences: Record<string, string>,
): { needed: boolean; questions: ClarificationQuestion[] } {
  const questions = buildClarificationQuestions(queryText, preferences);
  // If at least one priority-1 or priority-2 question remains, clarify
  const hasCritical = questions.some(
    (q) => q.id === "outputType" || q.id === "duration",
  );
  return { needed: hasCritical && questions.length > 0, questions };
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

  // Check if clarification is needed
  const clarification = needsClarification(queryText, preferences);

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
      status: clarification.needed ? "needs_clarification" : "completed",
      clarification_questions: clarification.needed ? clarification.questions : null,
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

  // If clarification needed, return early with questions
  if (clarification.needed) {
    return json({
      needsClarification: true,
      queryId: query.id,
      questions: clarification.questions,
    });
  }

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
    leadInSeconds = 10,
    maxSegments = 5,
    targetDurationSec = 60,
  } = body;
  if (!queryId) return err("queryId is required");

  // Clamp lead-in: 0–25s
  const leadIn = Math.max(0, Math.min(25, leadInSeconds));
  const segLimit = Math.min(maxSegments, 5); // MVP hard limit

  // Build segments from selected moments or top results
  let momentIds = selectedMomentIds;
  if (!momentIds || momentIds.length === 0) {
    const { data: topResults } = await supabase
      .from("video_search_results")
      .select("moment_id, score")
      .eq("query_id", queryId)
      .order("score", { ascending: false })
      .limit(20); // fetch more for diversification
    momentIds = (topResults || []).map((r: any) => r.moment_id);
  }

  // Fetch moment details for diversification
  let moments: any[] = [];
  if (momentIds.length > 0) {
    const { data } = await supabase
      .from("moment_index")
      .select("id, video_id, start_sec, end_sec, transcript_snippet")
      .in("id", momentIds);
    moments = data || [];
  }

  // Diversify: avoid multiple segments from same 60s window of same video
  const selected: any[] = [];
  const usedWindows = new Set<string>();
  // Sort by original order (score rank)
  const orderedMoments = momentIds
    .map((mid: string) => moments.find((m: any) => m.id === mid))
    .filter(Boolean);

  for (const m of orderedMoments) {
    if (selected.length >= segLimit) break;
    const windowKey = `${m.video_id}:${Math.floor(m.start_sec / 60)}`;
    if (usedWindows.has(windowKey)) continue;
    usedWindows.add(windowKey);
    selected.push(m);
  }

  // Check entitlements — only include accessible content
  const videoIds = [...new Set(selected.map((m: any) => m.video_id))];
  const ent = await buildEntitlements(supabase, userId);
  let accessibleVideoIds = new Set<string>();

  if (videoIds.length > 0) {
    const { data: contentItems } = await supabase
      .from("content_items")
      .select("id, monetization_type, price, creator_id")
      .in("id", videoIds);

    for (const ci of contentItems || []) {
      if (hasAccessToContent(ci, ent.purchasedIds, ent.subscribedCreatorIds)) {
        accessibleVideoIds.add(ci.id);
      }
    }
  }

  const accessibleSegments = selected.filter((m: any) =>
    accessibleVideoIds.has(m.video_id),
  );

  // Create montage project
  const { data: project, error: pErr } = await supabase
    .from("montage_projects")
    .insert({
      user_id: userId,
      source_query_id: queryId,
      target_duration: targetDurationSec,
      scope: "video_meaning_search",
      status: accessibleSegments.length > 0 ? "ready" : "empty",
    })
    .select("id")
    .single();

  if (pErr) return err("Failed to create montage", 500);

  // Insert segments with lead-in applied
  if (accessibleSegments.length > 0) {
    const segments = accessibleSegments.map((m: any, i: number) => ({
      montage_id: project.id,
      source_type: "video",
      source_id: m.video_id,
      start_sec: Math.max(0, m.start_sec - leadIn),
      end_sec: m.end_sec,
      deep_link: `/product/${m.video_id}?t=${Math.max(0, Math.floor(m.start_sec - leadIn))}`,
      rationale: m.transcript_snippet?.slice(0, 120) || "Визуальное совпадение",
      sort_order: i,
      segment_status: "included",
    }));

    await supabase.from("montage_segments").insert(segments);
  }

  return json({ projectId: project.id, status: accessibleSegments.length > 0 ? "ready" : "empty" });
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
