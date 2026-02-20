import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLovableJSON } from "../_shared/lovable_ai.ts";
import { buildPlanSystemPrompt, buildPlanUserPrompt } from "../_shared/prompts/plan.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const { project_id } = await req.json();
    if (!project_id) return errorResponse("project_id required", 400);

    // Verify ownership
    const { data: project } = await supabase
      .from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single();
    if (!project) return errorResponse("Project not found or forbidden", 404);

    // Retrieve candidate chunks via FTS (pass user.id since service role has no auth.uid())
    const ftsConfig = Deno.env.get("FTS_CONFIG") || "simple";
    const { data: candidates } = await supabase.rpc("match_chunks_fts", {
      p_project_id: project_id,
      p_query: "основные темы структура термины определения концепции",
      p_limit: 30,
      p_fts_config: ftsConfig,
      p_user_id: user.id,
    });

    // Fallback: if FTS returns nothing, grab first 30 chunks directly
    let chunks = candidates || [];
    if (!chunks.length) {
      const { data: fallback } = await supabase
        .from("project_chunks")
        .select("id, content, metadata")
        .eq("project_id", project_id)
        .order("created_at", { ascending: true })
        .limit(30);
      chunks = (fallback || []).map((c: any) => ({ id: c.id, content: c.content, metadata: c.metadata, score: 0 }));
    }

    if (!chunks.length) return errorResponse("No chunks found. Run ingest first.", 400);

    // LLM rerank: ask AI to pick best 12 chunks
    const chunkList = chunks.map((c: any, i: number) => `[${i}] id=${c.id}: ${c.content.slice(0, 200)}`).join("\n");
    let rerankedChunks = chunks;
    try {
      const reranked = await callLovableJSON<{ selected: number[] }>({
        system: "Ты — ассистент поиска. Из списка фрагментов выбери 8-12 наиболее информативных для создания учебного плана. Верни JSON: {\"selected\": [0, 3, 5, ...]} — массив индексов.",
        user: chunkList,
        maxRetries: 1,
      });
      if (reranked.selected?.length) {
        rerankedChunks = reranked.selected
          .filter((i: number) => i >= 0 && i < chunks.length)
          .map((i: number) => chunks[i]);
      }
    } catch (e) {
      console.warn("Rerank failed, using all candidates:", e);
    }

    // Call PLAN
    await supabase.from("projects").update({ status: "planning" }).eq("id", project_id);

    const planResult = await callLovableJSON<any>({
      system: buildPlanSystemPrompt(),
      user: buildPlanUserPrompt(rerankedChunks.map((c: any) => ({ text: c.content, meta: c.metadata }))),
      maxRetries: 2,
    });

    // Save to project
    const updateData: Record<string, unknown> = {
      status: "planned",
      roadmap: planResult.roadmap || [],
      assistant_menu_policy: planResult.assistant_menu_policy || {},
    };

    await supabase.from("projects").update(updateData).eq("id", project_id);

    // Create diagnostic quiz if enabled
    if (planResult.diagnostic?.enabled && planResult.diagnostic?.quiz?.questions?.length) {
      const { data: artifact } = await supabase.from("artifacts").insert({
        project_id,
        user_id: user.id,
        title: "Диагностический тест",
        type: "quiz",
        public_json: {
          kind: "quiz",
          questions: planResult.diagnostic.quiz.questions,
          shuffle: false,
        },
        status: "published",
        roadmap_step_id: "diagnostic",
        sort_order: 0,
      }).select("id").single();

      if (artifact && planResult.diagnostic.answer_key?.length) {
        await supabase.from("artifact_private").insert({
          artifact_id: artifact.id,
          user_id: user.id,
          private_json: {
            kind: "quiz",
            answer_key: planResult.diagnostic.answer_key,
            passing_score: 60,
          },
        });
      }
    }

    return jsonResponse({
      success: true,
      topics: planResult.topics,
      roadmap: planResult.roadmap,
      assistant_menu_policy: planResult.assistant_menu_policy,
      has_diagnostic: !!planResult.diagnostic?.enabled,
    });
  } catch (e) {
    console.error("project_plan error:", e);
    return errorResponse(e as Error);
  }
});
