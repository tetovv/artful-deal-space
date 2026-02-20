import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const MAX_TEXT_CHARS = 200_000;

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
    const { project_id, sources, documents, chunking } = body;
    if (!project_id) return errorResponse("project_id required", 400);

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("projects").select("id, user_id").eq("id", project_id).single();
    if (projErr || !project) return errorResponse("Project not found", 404);
    if (project.user_id !== user.id) return errorResponse("Forbidden", 403);

    await supabase.from("projects").update({ status: "ingesting" }).eq("id", project_id);

    const maxChars = chunking?.max_chars || 1200;
    const overlap = chunking?.overlap || 150;

    const allChunks: { content: string; metadata: Record<string, unknown> }[] = [];

    // ─── Mode 1: Storage-based sources (preferred, no payload size issue) ───
    if (sources?.length) {
      for (const src of sources) {
        const { storage_path, file_name, source_id } = src;
        if (!storage_path) continue;

        // Download file from Storage
        const { data: fileData, error: dlErr } = await supabase.storage
          .from("ai_sources")
          .download(storage_path);

        if (dlErr || !fileData) {
          console.error(`Failed to download ${storage_path}:`, dlErr);
          continue;
        }

        // Read as text (files are already extracted on client and uploaded as .txt)
        const text = await fileData.text();
        if (!text.trim()) continue;

        // Chunk
        let start = 0;
        let chunkIndex = 0;
        while (start < text.length) {
          const end = Math.min(start + maxChars, text.length);
          const chunk = text.slice(start, end);
          allChunks.push({
            content: chunk,
            metadata: { file_name: file_name || "unknown", chunk_index: chunkIndex, start_char: start, end_char: end },
          });
          start = end - overlap;
          if (start >= text.length) break;
          chunkIndex++;
        }
      }
    }

    // ─── Mode 2: Inline documents[] (legacy, with size protection) ───
    if (documents?.length) {
      for (const doc of documents) {
        let text: string = doc.text || doc.content || "";
        const fileName: string = doc.file_name || doc.name || "unknown";

        if (text.length > MAX_TEXT_CHARS) {
          return errorResponse(
            `Документ "${fileName}" слишком большой (${text.length} символов, максимум ${MAX_TEXT_CHARS}). Используйте загрузку через Storage.`,
            413
          );
        }

        if (!text.trim()) continue;

        let start = 0;
        let chunkIndex = 0;
        while (start < text.length) {
          const end = Math.min(start + maxChars, text.length);
          const chunk = text.slice(start, end);
          allChunks.push({
            content: chunk,
            metadata: { file_name: fileName, chunk_index: chunkIndex, start_char: start, end_char: end },
          });
          start = end - overlap;
          if (start >= text.length) break;
          chunkIndex++;
        }
      }
    }

    if (!allChunks.length) {
      return errorResponse("Не удалось извлечь текст. Убедитесь что файлы загружены.", 400);
    }

    // Delete old chunks
    await supabase.from("project_chunks").delete().eq("project_id", project_id);

    // Insert in batches of 50
    const batchSize = 50;
    let inserted = 0;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize).map((c) => ({
        project_id,
        user_id: user.id,
        content: c.content,
        metadata: c.metadata,
        source_id: project_id,
      }));

      const { error: insertErr } = await supabase.from("project_chunks").insert(batch);
      if (insertErr) {
        console.error("Chunk insert error:", insertErr);
        throw new Error(`Failed to insert chunks: ${insertErr.message}`);
      }
      inserted += batch.length;
    }

    await supabase.from("projects").update({ status: "ingested" }).eq("id", project_id);

    return jsonResponse({
      success: true,
      chunks_created: allChunks.length,
      mode: sources?.length ? "storage" : "inline",
    });
  } catch (e) {
    console.error("project_ingest error:", e);
    return errorResponse(e as Error);
  }
});
