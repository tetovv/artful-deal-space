import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

function applyPreviewPolicy(moment: Record<string, unknown>, hasAccess: boolean) {
  if (hasAccess) return { ...moment, access: "allowed" };
  return {
    id: moment.id,
    video_id: moment.video_id,
    start_sec: moment.start_sec,
    end_sec: moment.end_sec,
    transcript_snippet: null,
    entity_tags: [],
    action_tags: [],
    emotion_tags: [],
    visual_caption: null,
    access: "locked",
  };
}

async function buildEntitlements(supabase: any, userId: string) {
  const [{ data: purchases }, { data: subs }] = await Promise.all([
    supabase.from("purchases").select("content_id").eq("user_id", userId),
    supabase.from("subscriptions").select("creator_id").eq("user_id", userId),
  ]);
  return {
    purchasedIds: new Set((purchases || []).map((p: any) => p.content_id)),
    subscribedCreatorIds: new Set((subs || []).map((s: any) => s.creator_id)),
  };
}

function hasAccessToContent(
  content: Record<string, unknown>,
  purchasedIds: Set<string>,
  subscribedCreatorIds: Set<string>,
): boolean {
  if (content.monetization_type === "free" || !content.price || (content.price as number) === 0) return true;
  if (purchasedIds.has(content.id as string)) return true;
  if (subscribedCreatorIds.has(content.creator_id as string)) return true;
  return false;
}

/* ── clarification ── */

interface ClarificationQuestion {
  id: string;
  text: string;
  reason: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}

function buildClarificationQuestions(queryText: string, preferences: Record<string, string>): ClarificationQuestion[] {
  const lower = queryText.toLowerCase();
  const questions: ClarificationQuestion[] = [];
  const detected: Record<string, string> = {};

  if (/нарезк|монтаж/i.test(lower)) detected.outputType = "montage";
  else if (/момент|фрагмент/i.test(lower)) detected.outputType = "just_moment";
  else if (/несколько|больше|подборк/i.test(lower)) detected.outputType = "more_videos";

  if (!detected.outputType && !preferences.resultType) {
    questions.push({
      id: "outputType",
      text: "Что именно вы хотите получить?",
      reason: "Это поможет подобрать формат результата.",
      options: [
        { value: "one_best", label: "Один лучший" },
        { value: "more_videos", label: "Больше эпизодов" },
        { value: "just_moment", label: "Только момент" },
      ],
      defaultValue: "one_best",
    });
  }

  if (questions.length < 2 && !preferences.length) {
    if (!/коротк|средн|полн/i.test(lower)) {
      questions.push({
        id: "duration",
        text: "Какая длительность фрагмента подходит?",
        reason: "Подкасты бывают длинными — ограничим поиск.",
        options: [
          { value: "short", label: "Короткое (≤2 мин)" },
          { value: "medium", label: "Среднее (2–10 мин)" },
          { value: "full", label: "Полный эпизод" },
        ],
        defaultValue: "short",
      });
    }
  }

  return questions.slice(0, 2);
}

function needsClarification(queryText: string, preferences: Record<string, string>) {
  const questions = buildClarificationQuestions(queryText, preferences);
  const hasCritical = questions.some((q) => q.id === "outputType" || q.id === "duration");
  return { needed: hasCritical && questions.length > 0, questions };
}

/* ── mock search ── */

async function mockSearch(supabase: any, _queryText: string, includePrivate: boolean, userId: string) {
  const { data: moments } = await supabase
    .from("moment_index")
    .select("*, content_items!inner(id, title, creator_name, creator_id, monetization_type, price, status, type)")
    .eq("content_items.status", "published")
    .eq("content_items.type", "podcast")
    .limit(20);

  if (!moments || moments.length === 0) {
    return { best: null, moreVideos: [], montageCandidates: [] };
  }

  const ent = await buildEntitlements(supabase, userId);
  const enriched = moments.map((m: any) => {
    const ci = m.content_items;
    const access = hasAccessToContent(ci, ent.purchasedIds, ent.subscribedCreatorIds);
    return {
      ...applyPreviewPolicy(m, access),
      video_title: ci.title,
      creator_name: ci.creator_name,
      score: Math.random(),
    };
  });
  enriched.sort((a: any, b: any) => b.score - a.score);
  return {
    best: enriched[0] || null,
    moreVideos: enriched.slice(1),
    montageCandidates: enriched.filter((e: any) => e.access === "allowed").slice(0, 5),
  };
}

/* ── handlers ── */

async function handleSearch(supabase: any, userId: string, body: any) {
  const queryText = (body.queryText || "").trim();
  if (!queryText) return err("queryText is required");

  const includePrivate = body.includePrivateSources === true;
  const preferences = body.preferences || {};
  const clarification = needsClarification(queryText, preferences);

  const { data: query, error: qErr } = await supabase
    .from("video_search_queries")
    .insert({
      user_id: userId,
      query_text: queryText,
      mode: "podcastMeaning",
      parsed_intent: { raw: queryText, type: "podcastMeaning" },
      preferences,
      include_private_sources: includePrivate,
      status: clarification.needed ? "needs_clarification" : "completed",
      clarification_questions: clarification.needed ? clarification.questions : null,
    })
    .select("id")
    .single();

  if (qErr) return err("Failed to create query", 500);

  if (clarification.needed) {
    return json({ needsClarification: true, queryId: query.id, questions: clarification.questions });
  }

  const results = await mockSearch(supabase, queryText, includePrivate, userId);

  if (results.best) {
    const all = [results.best, ...results.moreVideos].filter((r: any) => r.id);
    const inserts = all.map((r: any) => ({ query_id: query.id, moment_id: r.id, score: r.score || 0, rationale: { mock: true } }));
    if (inserts.length > 0) await supabase.from("video_search_results").insert(inserts);
  }

  return json({ needsClarification: false, queryId: query.id, results });
}

async function handleClarify(supabase: any, userId: string, body: any) {
  const { queryId, answersJson } = body;
  if (!queryId) return err("queryId is required");

  const { data: existing } = await supabase
    .from("video_search_queries")
    .select("*")
    .eq("id", queryId)
    .eq("user_id", userId)
    .single();

  if (!existing) return err("Query not found", 404);

  const clarifications = [...((existing.clarifications as any[]) || []), { answers: answersJson, at: new Date().toISOString() }];
  await supabase.from("video_search_queries").update({ clarifications, status: "completed" }).eq("id", queryId);

  const results = await mockSearch(supabase, existing.query_text, existing.include_private_sources, userId);
  return json({ queryId, results });
}

async function handleGetQuery(supabase: any, userId: string, queryId: string) {
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

  return json({ query, results: results || [] });
}

/* ── main ── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

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

  const fnIdx = pathParts.indexOf("podcast-meaning-search");
  const sub = pathParts.slice(fnIdx + 1);

  try {
    if (req.method === "POST" && sub.length === 0) {
      return handleSearch(supabase, userId, await req.json());
    }
    if (req.method === "POST" && sub[0] === "clarify") {
      return handleClarify(supabase, userId, await req.json());
    }
    if (req.method === "GET" && sub[0] && sub[0] !== "clarify") {
      return handleGetQuery(supabase, userId, sub[0]);
    }
    return err("Not found", 404);
  } catch (e) {
    console.error("podcast-meaning-search error:", e);
    return err("Internal error", 500);
  }
});
