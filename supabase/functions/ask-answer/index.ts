import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLovableJSON } from "../_shared/lovable_ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function supabaseForUser(token: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

async function getUserFromToken(token: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const user = await getUserFromToken(token);
    const sb = supabaseForUser(token);
    const admin = supabaseAdmin();

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // paths: /ask-answer, /ask-answer/:queryId, /ask-answer/:queryId/evidence

    if (req.method === "POST" && pathParts.length <= 1) {
      // POST /ask-answer — create query + generate answer
      const body = await req.json();
      const { question, includeWorkplace } = body;
      if (!question?.trim()) {
        return new Response(JSON.stringify({ error: "Question required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create query record
      const { data: query, error: qErr } = await sb
        .from("ask_queries")
        .insert({ user_id: user.id, question, include_workplace: !!includeWorkplace, status: "processing" })
        .select("id")
        .single();
      if (qErr) throw qErr;
      const queryId = query.id;

      // Gather user's entitled content for evidence search
      // Get purchased content IDs
      const { data: purchases } = await sb.from("purchases").select("content_id").eq("user_id", user.id);
      const purchasedIds = new Set((purchases || []).map((p: any) => p.content_id));

      // Get subscribed creator IDs  
      const { data: subs } = await admin.from("subscriptions").select("creator_id").eq("user_id", user.id);
      const subscribedCreatorIds = new Set((subs || []).map((s: any) => s.creator_id));

      // Get free + entitled content matching question (search by title/description similarity)
      const { data: allContent } = await admin
        .from("content_items")
        .select("id, title, description, type, creator_name, creator_id, monetization_type, price")
        .eq("status", "published")
        .limit(200);

      // Filter to entitled items
      const entitledContent = (allContent || []).filter((c: any) => {
        if (c.monetization_type === "free" || !c.price || c.price === 0) return true;
        if (purchasedIds.has(c.id)) return true;
        if (subscribedCreatorIds.has(c.creator_id)) return true;
        return false;
      });

      // Save access snapshot
      await sb.from("ask_access_snapshots").insert({
        query_id: queryId,
        user_id: user.id,
        entitlement_summary: {
          purchased_count: purchasedIds.size,
          subscribed_creators: subscribedCreatorIds.size,
          total_entitled: entitledContent.length,
        },
      });

      // Use AI to find relevant evidence and generate answer
      const contentSummary = entitledContent
        .slice(0, 50)
        .map((c: any) => `[${c.type}] "${c.title}" by ${c.creator_name} (id:${c.id})${c.description ? ` — ${c.description.slice(0, 100)}` : ""}`)
        .join("\n");

      let answerText = "";
      let evidenceItems: any[] = [];

      try {
        const aiResult = await callLovableJSON<any>({
          system: `Ты — поисковый движок по медиа-контенту. На основе вопроса пользователя и списка доступного контента:
1. Найди 3-10 наиболее релевантных элементов контента.
2. Для каждого укажи: sourceId (id контента), confidence (high/medium/low), snippet (краткая цитата/описание почему релевантно, 1-2 предложения), deepLink (для видео: ?t=0, для постов: #content).
3. Сгенерируй короткий ответ (3-6 предложений) на основе найденных источников.
4. Если релевантного контента НЕТ — верни пустой массив evidence и пустой answer.

Верни JSON: { "answer": "...", "evidence": [{ "sourceId": "uuid", "confidence": "high|medium|low", "snippet": "...", "deepLink": "..." }] }`,
          user: `Вопрос: ${question}\n\nДоступный контент:\n${contentSummary || "Контент не найден."}`,
          temperature: 0.2,
        });

        answerText = aiResult.answer || "";
        evidenceItems = (aiResult.evidence || []).filter((e: any) => e.sourceId);
      } catch {
        // AI failed — mark as error
        await admin.from("ask_queries").update({ status: "error" }).eq("id", queryId);
        return new Response(JSON.stringify({ queryId, status: "error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine status
      const hasEvidence = evidenceItems.length > 0;
      const status = hasEvidence ? "answered" : "insufficient";

      // Save result
      if (hasEvidence && answerText) {
        await sb.from("ask_results").insert({
          query_id: queryId,
          answer_text: answerText,
          validated_at: new Date().toISOString(),
        });
      }

      // Save evidence items with content metadata
      const contentMap = new Map(entitledContent.map((c: any) => [c.id, c]));
      for (let i = 0; i < evidenceItems.length; i++) {
        const ev = evidenceItems[i];
        const content = contentMap.get(ev.sourceId);
        if (!content) continue;
        await sb.from("ask_evidence").insert({
          query_id: queryId,
          source_type: content.type,
          source_id: ev.sourceId,
          title: content.title,
          creator_name: content.creator_name,
          deep_link: ev.deepLink || `/product/${ev.sourceId}`,
          snippet: ev.snippet || "",
          confidence: ev.confidence || "medium",
          sort_order: i,
        });
      }

      // Update query status
      await admin.from("ask_queries").update({ status }).eq("id", queryId);

      return new Response(JSON.stringify({ queryId, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && pathParts.length >= 2) {
      const queryId = pathParts[1];
      const isEvidence = pathParts[2] === "evidence";

      if (isEvidence) {
        // GET /ask-answer/:queryId/evidence
        const { data, error } = await sb
          .from("ask_evidence")
          .select("*")
          .eq("query_id", queryId)
          .order("sort_order");
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // GET /ask-answer/:queryId — query + result
      const { data: query, error: qErr } = await sb
        .from("ask_queries")
        .select("*")
        .eq("id", queryId)
        .single();
      if (qErr) throw qErr;

      const { data: result } = await sb
        .from("ask_results")
        .select("*")
        .eq("query_id", queryId)
        .maybeSingle();

      return new Response(JSON.stringify({ query, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
