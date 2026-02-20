import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLovableJSON } from "../_shared/lovable_ai.ts";
import { buildActSystemPrompt, buildActUserPrompt, isAssistantNoteAction } from "../_shared/prompts/act.ts";

const VALID_ACTIONS = [
  "generate_lesson_blocks", "generate_quiz", "generate_flashcards",
  "generate_slides", "generate_method_pack", "explain_term",
  "expand_selection", "give_example", "remediate_topic", "grade_open",
  "explain_mistake", "explain_correct", "give_hint",
];

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

    const { project_id, action_type, context, target, user_answer } = await req.json();
    if (!project_id || !action_type) return errorResponse("project_id and action_type required", 400);
    if (!VALID_ACTIONS.includes(action_type)) return errorResponse(`Invalid action_type: ${action_type}`, 400);

    // Verify ownership
    const { data: project } = await supabase
      .from("projects").select("id, user_id").eq("id", project_id).eq("user_id", user.id).single();
    if (!project) return errorResponse("Project not found or forbidden", 404);

    // Build retrieval query from target
    const queryParts: string[] = [];
    if (target?.term) queryParts.push(target.term);
    if (target?.selected_text) queryParts.push(target.selected_text.slice(0, 200));
    if (target?.topic_id) queryParts.push(target.topic_id);
    if (context) queryParts.push(context.slice(0, 200));
    const retrievalQuery = queryParts.join(" ") || action_type;

    // Retrieve candidate chunks
    const ftsConfig = Deno.env.get("FTS_CONFIG") || "simple";
    const { data: candidates } = await supabase.rpc("match_chunks_fts", {
      p_project_id: project_id,
      p_query: retrievalQuery,
      p_limit: 30,
      p_fts_config: ftsConfig,
      p_user_id: user.id,
    });

    let chunks = candidates || [];
    if (!chunks.length) {
      const { data: fallback } = await supabase
        .from("project_chunks")
        .select("id, content, metadata")
        .eq("project_id", project_id)
        .limit(15);
      chunks = (fallback || []).map((c: any) => ({ id: c.id, content: c.content, metadata: c.metadata, score: 0 }));
    }

    // LLM rerank
    if (chunks.length > 10) {
      const chunkList = chunks.map((c: any, i: number) => `[${i}] id=${c.id}: ${c.content.slice(0, 150)}`).join("\n");
      try {
        const reranked = await callLovableJSON<{ selected: number[] }>({
          system: `Выбери 6-10 фрагментов, наиболее релевантных для действия "${action_type}" по теме "${retrievalQuery}". JSON: {"selected": [0,2,...]}`,
          user: chunkList,
          maxRetries: 1,
          temperature: 0.1,
        });
        if (reranked.selected?.length) {
          chunks = reranked.selected.filter((i: number) => i >= 0 && i < chunks.length).map((i: number) => chunks[i]);
        }
      } catch { /* use all */ }
    }

    // Call ACT
    const actResult = await callLovableJSON<{
      public_payload: Record<string, unknown>;
      private_payload?: Record<string, unknown> | null;
      source_refs: string[];
      ui_hints: Record<string, unknown>;
    }>({
      system: buildActSystemPrompt(action_type),
      user: buildActUserPrompt({
        actionType: action_type,
        context,
        target,
        chunks: chunks.map((c: any) => ({ id: c.id, text: c.content })),
        userAnswer: user_answer,
      }),
      maxRetries: 2,
    });

    // Validate: assistant_note actions must NOT return method_pack
    if (isAssistantNoteAction(action_type) && actResult.public_payload?.kind === "method_pack") {
      // Convert method_pack to assistant_note
      const blocks = (actResult.public_payload as any).blocks || [];
      const firstBlock = blocks[0];
      actResult.public_payload = {
        kind: "assistant_note",
        title: firstBlock?.title || action_type,
        content: blocks.map((b: any) => `${b.title ? `**${b.title}**\n` : ""}${b.content || ""}`).join("\n\n"),
        source_refs: actResult.source_refs || [],
      };
    }

    // Save artifact (skip for assistant_note actions and grade_open)
    let artifactId: string | null = null;
    const isInlineAction = isAssistantNoteAction(action_type) || action_type === "grade_open";

    if (!isInlineAction) {
      const { data: artifact } = await supabase.from("artifacts").insert({
        project_id,
        user_id: user.id,
        title: `${action_type} — ${target?.term || target?.topic_id || "artifact"}`,
        type: action_type.replace("generate_", ""),
        public_json: actResult.public_payload,
        status: "published",
        roadmap_step_id: target?.topic_id || null,
      }).select("id").single();

      artifactId = artifact?.id || null;

      // Save private payload if present
      if (artifactId && actResult.private_payload) {
        await supabase.from("artifact_private").insert({
          artifact_id: artifactId,
          user_id: user.id,
          private_json: actResult.private_payload,
        });
      }
    }

    return jsonResponse({
      success: true,
      artifact_id: artifactId,
      public_payload: actResult.public_payload,
      source_refs: actResult.source_refs,
      ui_hints: actResult.ui_hints,
    });
  } catch (e) {
    console.error("artifact_act error:", e);
    return errorResponse(e as Error);
  }
});
