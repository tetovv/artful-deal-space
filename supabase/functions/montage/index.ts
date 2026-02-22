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
    // POST /montage — create montage job
    // GET  /montage/:id/status — get status + segments

    if (req.method === "POST" && pathParts.length <= 1) {
      const body = await req.json();
      const { targetDuration, scope, sourceQueryId, selectedSourceIds } = body;

      const duration = [15, 30, 60, 90].includes(targetDuration) ? targetDuration : 30;

      // Create project
      const { data: project, error: pErr } = await sb
        .from("montage_projects")
        .insert({
          user_id: user.id,
          source_query_id: sourceQueryId || null,
          target_duration: duration,
          scope: scope || "this_answer",
          status: "processing",
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      // Gather entitled content
      const { data: purchases } = await sb.from("purchases").select("content_id").eq("user_id", user.id);
      const purchasedIds = new Set((purchases || []).map((p: any) => p.content_id));

      const { data: subs } = await admin.from("subscriptions").select("creator_id").eq("user_id", user.id);
      const subscribedCreatorIds = new Set((subs || []).map((s: any) => s.creator_id));

      let sourceContent: any[] = [];

      if (scope === "selected" && selectedSourceIds?.length > 0) {
        // Only selected sources
        const { data } = await admin
          .from("content_items")
          .select("id, title, description, type, creator_name, creator_id, monetization_type, price, duration")
          .in("id", selectedSourceIds)
          .eq("status", "published");
        sourceContent = data || [];
      } else if (scope === "this_answer" && sourceQueryId) {
        // Evidence from this answer
        const { data: evidence } = await sb
          .from("ask_evidence")
          .select("source_id")
          .eq("query_id", sourceQueryId);
        const sourceIds = (evidence || []).map((e: any) => e.source_id).filter(Boolean);
        if (sourceIds.length > 0) {
          const { data } = await admin
            .from("content_items")
            .select("id, title, description, type, creator_name, creator_id, monetization_type, price, duration")
            .in("id", sourceIds)
            .eq("status", "published");
          sourceContent = data || [];
        }
      } else {
        // All results — get recent content
        const { data } = await admin
          .from("content_items")
          .select("id, title, description, type, creator_name, creator_id, monetization_type, price, duration")
          .eq("status", "published")
          .limit(100);
        sourceContent = data || [];
      }

      // Filter to entitled only
      const entitled = sourceContent.filter((c: any) => {
        if (c.monetization_type === "free" || !c.price || c.price === 0) return true;
        if (purchasedIds.has(c.id)) return true;
        if (subscribedCreatorIds.has(c.creator_id)) return true;
        return false;
      });

      if (entitled.length === 0) {
        await admin.from("montage_projects").update({ status: "empty" }).eq("id", project.id);
        return new Response(JSON.stringify({ id: project.id, status: "empty" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // AI generates segment plan
      const contentList = entitled.map((c: any) =>
        `[${c.type}] "${c.title}" by ${c.creator_name} (id:${c.id}, duration:${c.duration || "unknown"}s)`
      ).join("\n");

      try {
        const aiResult = await callLovableJSON<any>({
          system: `Ты — монтажный ассистент. На основе списка доступного контента создай плейлист сегментов для справочного монтажа длительностью ${duration} секунд.

Правила:
- Каждый сегмент имеет: sourceId (uuid контента), start (секунда начала), end (секунда конца), rationale (1 предложение — почему этот фрагмент выбран).
- Суммарная длительность сегментов должна быть примерно ${duration} секунд.
- Для видео/аудио контента с duration, используй реальные временные метки. Для других — используй start:0, end: разумный интервал (5-15с).
- Выбери наиболее ценные и разнообразные фрагменты.
- Верни JSON: { "segments": [{ "sourceId": "uuid", "start": 0, "end": 10, "rationale": "..." }] }`,
          user: `Доступный контент:\n${contentList}`,
          temperature: 0.3,
        });

        const segments = (aiResult.segments || []).filter((s: any) => s.sourceId);
        const contentMap = new Map(entitled.map((c: any) => [c.id, c]));

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const content = contentMap.get(seg.sourceId);
          if (!content) continue;

          const deepLink = content.type === "video"
            ? `/product/${seg.sourceId}?t=${Math.floor(seg.start)}`
            : `/product/${seg.sourceId}`;

          await sb.from("montage_segments").insert({
            montage_id: project.id,
            source_type: content.type,
            source_id: seg.sourceId,
            start_sec: seg.start || 0,
            end_sec: seg.end || 0,
            deep_link: deepLink,
            rationale: seg.rationale || "",
            sort_order: i,
          });
        }

        await admin.from("montage_projects").update({ status: "ready" }).eq("id", project.id);

        return new Response(JSON.stringify({ id: project.id, status: "ready" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        await admin.from("montage_projects").update({ status: "error" }).eq("id", project.id);
        return new Response(JSON.stringify({ id: project.id, status: "error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (req.method === "GET" && pathParts.length >= 2) {
      const montageId = pathParts[1];

      const { data: project, error: pErr } = await sb
        .from("montage_projects")
        .select("*")
        .eq("id", montageId)
        .single();
      if (pErr) throw pErr;

      const { data: segments } = await sb
        .from("montage_segments")
        .select("*")
        .eq("montage_id", montageId)
        .order("sort_order");

      return new Response(JSON.stringify({ project, segments: segments || [] }), {
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
