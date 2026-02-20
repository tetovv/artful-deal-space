import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLovableJSON } from "../_shared/lovable_ai.ts";
import { buildActSystemPrompt, buildActUserPrompt } from "../_shared/prompts/act.ts";

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

    const { artifact_id, answers } = await req.json();
    if (!artifact_id || !answers?.length) return errorResponse("artifact_id and answers[] required", 400);

    // Get artifact + verify ownership
    const { data: artifact } = await supabase
      .from("artifacts").select("*, projects!inner(user_id)").eq("id", artifact_id).single();
    if (!artifact) return errorResponse("Artifact not found", 404);
    if ((artifact as any).projects.user_id !== user.id) return errorResponse("Forbidden", 403);

    // Get private data (service role only — no client SELECT policy)
    const { data: privateData } = await supabase
      .from("artifact_private").select("private_json").eq("artifact_id", artifact_id).single();

    const privateJson = privateData?.private_json as any;
    let score: number | null = null;
    let feedback: Record<string, unknown> = {};
    let nextStepSuggestion: string | null = null;

    // Deterministic grading for quiz types
    if (privateJson?.kind === "quiz" && privateJson?.answer_key?.length) {
      const answerKey = privateJson.answer_key;
      let totalPoints = 0;
      let earnedPoints = 0;
      const questionFeedback: Record<string, { correct: boolean; earned: number; max: number }> = {};

      for (const key of answerKey) {
        const points = key.points || 1;
        totalPoints += points;
        const userAnswer = answers.find((a: any) => a.block_id === key.question_id);
        if (!userAnswer) {
          questionFeedback[key.question_id] = { correct: false, earned: 0, max: points };
          continue;
        }

        const userValues = Array.isArray(userAnswer.value) ? userAnswer.value : [userAnswer.value];
        const correctIds = key.correct_option_ids || [];
        const isCorrect =
          userValues.length === correctIds.length &&
          userValues.every((v: string) => correctIds.includes(v));

        if (isCorrect) earnedPoints += points;
        questionFeedback[key.question_id] = { correct: isCorrect, earned: isCorrect ? points : 0, max: points };
      }

      score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      feedback = {
        type: "quiz",
        total_points: totalPoints,
        earned_points: earnedPoints,
        passing_score: privateJson.passing_score || 60,
        passed: score >= (privateJson.passing_score || 60),
        questions: questionFeedback,
      };

      nextStepSuggestion = score >= (privateJson.passing_score || 60)
        ? "continue_next_step"
        : "remediate_topic";
    } else {
      // Open exercise — use AI grading
      try {
        // Get related chunks for context
        const { data: chunks } = await supabase
          .from("project_chunks")
          .select("id, content")
          .eq("project_id", artifact.project_id)
          .limit(10);

        const userAnswerText = answers.map((a: any) => `${a.block_id}: ${a.value}`).join("\n");

        const gradeResult = await callLovableJSON<{
          public_payload: any;
          private_payload?: any;
          ui_hints: { score?: number; next_actions?: string[] };
        }>({
          system: buildActSystemPrompt("grade_open"),
          user: buildActUserPrompt({
            actionType: "grade_open",
            context: `Artifact: ${artifact.title}`,
            chunks: (chunks || []).map((c: any) => ({ id: c.id, text: c.content })),
            userAnswer: userAnswerText,
          }),
          maxRetries: 1,
        });

        score = gradeResult.ui_hints?.score ?? null;
        feedback = {
          type: "exercise",
          ai_feedback: gradeResult.public_payload,
          score,
        };
        nextStepSuggestion = (score ?? 0) >= 60 ? "continue_next_step" : "remediate_topic";
      } catch (e) {
        console.error("AI grading failed:", e);
        feedback = { type: "exercise", error: "AI grading failed", raw_answers: answers };
      }
    }

    // Save attempt
    const { data: attempt } = await supabase.from("attempts").insert({
      artifact_id,
      user_id: user.id,
      answers: answers,
      score,
      feedback,
      status: "completed",
      completed_at: new Date().toISOString(),
    }).select("id").single();

    return jsonResponse({
      success: true,
      attempt_id: attempt?.id,
      score,
      feedback,
      next_step_suggestion: nextStepSuggestion,
    });
  } catch (e) {
    console.error("artifact_submit error:", e);
    return errorResponse(e as Error);
  }
});
