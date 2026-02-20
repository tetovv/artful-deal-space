import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) return errorResponse("Unauthorized", 401);

    const { project_id, documents, chunking } = await req.json();
    if (!project_id || !documents?.length) return errorResponse("project_id and documents[] required", 400);

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("projects").select("id, user_id").eq("id", project_id).single();
    if (projErr || !project) return errorResponse("Project not found", 404);
    if (project.user_id !== user.id) return errorResponse("Forbidden", 403);

    // Update status
    await supabase.from("projects").update({ status: "ingesting" }).eq("id", project_id);

    const maxChars = chunking?.max_chars || 1200;
    const overlap = chunking?.overlap || 150;
    const ftsConfig = Deno.env.get("FTS_CONFIG") || "simple";

    // Process documents into chunks
    const allChunks: { content: string; metadata: Record<string, unknown> }[] = [];

    for (const doc of documents) {
      const text: string = doc.text || doc.content || "";
      const fileName: string = doc.file_name || doc.name || "unknown";
      if (!text.trim()) continue;

      // Simple chunking by character count with overlap
      let start = 0;
      let chunkIndex = 0;
      while (start < text.length) {
        const end = Math.min(start + maxChars, text.length);
        const chunk = text.slice(start, end);
        allChunks.push({
          content: chunk,
          metadata: {
            file_name: fileName,
            chunk_index: chunkIndex,
            start_char: start,
            end_char: end,
          },
        });
        start = end - overlap;
        if (start >= text.length) break;
        chunkIndex++;
      }
    }

    // Delete old chunks for this project
    await supabase.from("project_chunks").delete().eq("project_id", project_id);

    // Insert chunks in batches of 50
    const batchSize = 50;
    let inserted = 0;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize).map((c) => ({
        project_id,
        user_id: user.id,
        content: c.content,
        metadata: c.metadata,
        source_id: project_id, // simplified: use project as source
      }));

      const { error: insertErr } = await supabase.from("project_chunks").insert(batch);
      if (insertErr) {
        console.error("Chunk insert error:", insertErr);
        throw new Error(`Failed to insert chunks: ${insertErr.message}`);
      }
      inserted += batch.length;

      // Update progress
      const progress = Math.round((inserted / allChunks.length) * 100);
      await supabase.from("projects").update({ status: "ingesting" }).eq("id", project_id);
    }

    // Update project status
    await supabase.from("projects").update({ status: "ingested" }).eq("id", project_id);

    return jsonResponse({
      success: true,
      chunks_created: allChunks.length,
      rag_mode: Deno.env.get("RAG_MODE") || "fts",
    });
  } catch (e) {
    console.error("project_ingest error:", e);
    return errorResponse(e as Error);
  }
});
