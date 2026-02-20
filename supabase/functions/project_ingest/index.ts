import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const MAX_TEXT_CHARS = 500_000;

/* ─── Background processing: only text chunking + DB insert ─── */
async function processInBackground(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  userId: string,
  documents: { text: string; file_name: string; source_id?: string }[],
  chunking: { max_chars?: number; overlap?: number } | null,
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const maxChars = chunking?.max_chars || 1200;
  const overlap = chunking?.overlap || 150;

  const allChunks: { content: string; metadata: Record<string, unknown>; source_id?: string }[] = [];
  const processedFiles: string[] = [];
  const totalDocs = documents.length;

  const updateProgress = async (pct: number, error?: string) => {
    const update: Record<string, unknown> = { ingest_progress: Math.min(pct, 100) };
    if (error) update.ingest_error = error;
    await supabase.from("projects").update(update).eq("id", projectId);
  };

  try {
    for (let idx = 0; idx < documents.length; idx++) {
      const doc = documents[idx];
      let text = doc.text || "";
      const fileName = doc.file_name || "pasted_text.txt";
      const sourceId = doc.source_id;

      if (!text.trim()) continue;
      if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);

      let start = 0;
      let chunkIndex = 0;
      while (start < text.length) {
        const end = Math.min(start + maxChars, text.length);
        allChunks.push({
          content: text.slice(start, end),
          metadata: { file_name: fileName, chunk_index: chunkIndex, start_char: start, end_char: end },
          source_id: sourceId,
        });
        start = end - overlap;
        if (start >= text.length) break;
        chunkIndex++;
      }

      processedFiles.push(fileName);

      if (sourceId) {
        await supabase.from("project_sources").update({
          status: "processed",
          chunk_count: chunkIndex + 1,
        }).eq("id", sourceId);
      }

      await updateProgress(Math.round(((idx + 1) / totalDocs) * 70));
    }

    if (!allChunks.length) {
      await supabase.from("projects").update({
        status: "error",
        ingest_progress: 0,
        ingest_error: "Не удалось извлечь текст. Убедитесь, что файлы содержат читаемый текст.",
      }).eq("id", projectId);
      return;
    }

    const totalChars = allChunks.reduce((sum, c) => sum + c.content.length, 0);
    if (totalChars < 200) {
      await supabase.from("projects").update({
        status: "error",
        ingest_progress: 0,
        ingest_error: "Слишком мало текстового контента для создания материала.",
      }).eq("id", projectId);
      return;
    }

    await updateProgress(75);

    // Delete old chunks
    await supabase.from("project_chunks").delete().eq("project_id", projectId);

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < allChunks.length; i += 50) {
      const batch = allChunks.slice(i, i + 50).map((c) => ({
        project_id: projectId,
        user_id: userId,
        content: c.content,
        metadata: c.metadata,
        source_id: c.source_id || projectId,
      }));

      const { error: insertErr } = await supabase.from("project_chunks").insert(batch);
      if (insertErr) {
        console.error("Chunk insert error:", insertErr);
        continue;
      }
      inserted += batch.length;
      await updateProgress(75 + Math.round((inserted / allChunks.length) * 25));
    }

    if (inserted === 0) {
      await supabase.from("projects").update({
        status: "error",
        ingest_progress: 0,
        ingest_error: "Не удалось сохранить данные. Попробуйте ещё раз.",
      }).eq("id", projectId);
      return;
    }

    await supabase.from("projects").update({
      status: "ingested",
      ingest_progress: 100,
      ingest_error: null,
    }).eq("id", projectId);

    console.log(`[project_ingest] Done: ${inserted} chunks, ${processedFiles.length} files`);
  } catch (e) {
    console.error("project_ingest background error:", e);
    await supabase.from("projects").update({
      status: "error",
      ingest_progress: 0,
      ingest_error: `Внутренняя ошибка: ${(e as Error).message || String(e)}`,
    }).eq("id", projectId);
  }
}

/* ─── Main handler ─── */
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const { project_id, documents, chunking } = body;
    if (!project_id) return errorResponse("project_id required", 400);
    if (!documents?.length) return errorResponse("documents required (pre-extracted text)", 400);

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("projects").select("id, user_id").eq("id", project_id).single();
    if (projErr || !project) return errorResponse("Project not found", 404);
    if (project.user_id !== user.id) return errorResponse("Forbidden", 403);

    // Set status to ingesting
    await supabase.from("projects").update({
      status: "ingesting",
      ingest_progress: 0,
      ingest_error: null,
    }).eq("id", project_id);

    // Start background processing — response returns immediately
    // @ts-ignore: EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processInBackground(supabaseUrl, supabaseKey, project_id, user.id, documents, chunking)
    );

    return jsonResponse({
      success: true,
      job_started: true,
      project_id,
    });
  } catch (e) {
    console.error("project_ingest error:", e);
    return errorResponse(e as Error);
  }
});
