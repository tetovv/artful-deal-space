import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLovableJSON } from "../_shared/lovable_ai.ts";
import { buildPlanSystemPrompt, buildPlanPatchPrompt } from "../_shared/prompts/plan.ts";

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

    const { project_id, answers } = await req.json();
    if (!project_id || !answers) return errorResponse("project_id and answers required", 400);

    // Verify ownership
    const { data: project } = await supabase
      .from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single();
    if (!project) return errorResponse("Project not found or forbidden", 404);

    const { hard_topics = [], pace = "normal", add_more = false } = answers;

    // Analyze recent attempts for this project
    const { data: recentAttempts } = await supabase
      .from("attempts")
      .select("score, artifact_id, feedback")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Calculate deviation
    const scores = (recentAttempts || []).map((a: any) => a.score).filter((s: any) => s !== null);
    const avgScore = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 100;
    const needsRePlan = avgScore < 50 || hard_topics.length >= 3 || pace === "too_fast";

    let updatedRoadmap = project.roadmap;

    if (needsRePlan) {
      // Get chunks for re-planning
      const { data: chunks } = await supabase
        .from("project_chunks")
        .select("id, content")
        .eq("project_id", project_id)
        .limit(20);

      try {
        const patchResult = await callLovableJSON<any>({
          system: buildPlanSystemPrompt(),
          user: buildPlanPatchPrompt(
            project.roadmap,
            { hard_topics, pace, add_more, avg_score: avgScore },
            (chunks || []).map((c: any) => ({ text: c.content }))
          ),
          maxRetries: 1,
        });

        if (patchResult.roadmap?.length) {
          updatedRoadmap = patchResult.roadmap;
        }
      } catch (e) {
        console.warn("Re-plan failed, keeping current roadmap:", e);
      }
    } else {
      // Rule-based adjustments
      const roadmap = Array.isArray(updatedRoadmap) ? [...updatedRoadmap] : [];
      
      // Mark hard topics for remediation
      for (const topic of hard_topics) {
        const step = roadmap.find((s: any) => s.id === topic || s.title?.includes(topic));
        if (step) {
          (step as any).status = "available";
          (step as any).description = `[Повторение] ${(step as any).description || ""}`;
        }
      }

      updatedRoadmap = roadmap;
    }

    // Save updates
    await supabase.from("projects").update({
      roadmap: updatedRoadmap,
    }).eq("id", project_id);

    return jsonResponse({
      success: true,
      roadmap_updated: needsRePlan,
      avg_score: avgScore,
      roadmap: updatedRoadmap,
    });
  } catch (e) {
    console.error("project_checkin error:", e);
    return errorResponse(e as Error);
  }
});
