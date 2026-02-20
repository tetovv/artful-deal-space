import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const MAX_TEXT_CHARS = 500_000;
const MAX_PDF_PAGES = 50;

/* ─── PDF text extraction ─── */
async function extractPdfText(data: Uint8Array): Promise<string> {
  try {
    const { getDocument } = await import("https://esm.sh/pdfjs-serverless@0.6.0");
    const doc = await getDocument({ data, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PDF_PAGES); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(" "));
    }
    return pages.join("\n\n");
  } catch (e) {
    console.error("PDF parse error:", e);
    return "";
  }
}

/* ─── DOCX text extraction ─── */
async function extractDocxText(data: Uint8Array): Promise<string> {
  try {
    const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
    const zip = await JSZip.loadAsync(data);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) return "";
    const withBreaks = docXml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<w:tab[^>]*\/>/g, "\t");
    const text = withBreaks.replace(/<[^>]+>/g, "");
    return text.replace(/\n{3,}/g, "\n\n").trim();
  } catch (e) {
    console.error("DOCX parse error:", e);
    return "";
  }
}

/* ─── Detect file type and extract text ─── */
async function extractTextFromBlob(blob: Blob, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (ext === "pdf") return extractPdfText(bytes);
  if (ext === "docx") return extractDocxText(bytes);
  return new TextDecoder().decode(bytes);
}

/* ─── Background processing ─── */
async function processInBackground(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  userId: string,
  sources: { storage_path: string; file_name: string; source_id?: string }[],
  documents: { text?: string; content?: string; file_name?: string; name?: string; source_id?: string }[] | null,
  chunking: { max_chars?: number; overlap?: number } | null,
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const maxChars = chunking?.max_chars || 1200;
  const overlap = chunking?.overlap || 150;

  const allChunks: { content: string; metadata: Record<string, unknown>; source_id?: string }[] = [];
  const processedFiles: string[] = [];
  const failedFiles: string[] = [];
  const totalSources = (sources?.length || 0) + (documents?.length || 0);
  let processed = 0;

  const updateProgress = async (pct: number, error?: string) => {
    const update: Record<string, unknown> = { ingest_progress: Math.min(pct, 100) };
    if (error) update.ingest_error = error;
    await supabase.from("projects").update(update).eq("id", projectId);
  };

  try {
    // ─── Mode 1: Storage-based sources ───
    if (sources?.length) {
      for (const src of sources) {
        const { storage_path, file_name, source_id } = src;
        if (!storage_path) continue;

        try {
          const { data: fileData, error: dlErr } = await supabase.storage
            .from("ai_sources")
            .download(storage_path);

          if (dlErr || !fileData) {
            console.error(`Failed to download ${storage_path}:`, dlErr);
            failedFiles.push(file_name || storage_path);
            processed++;
            await updateProgress(Math.round((processed / totalSources) * 80));
            continue;
          }

          const text = await extractTextFromBlob(fileData, file_name || storage_path);
          if (!text.trim()) {
            failedFiles.push(file_name || storage_path);
            processed++;
            await updateProgress(Math.round((processed / totalSources) * 80));
            continue;
          }

          const truncatedText = text.slice(0, MAX_TEXT_CHARS);
          if (text.length > MAX_TEXT_CHARS) {
            console.warn(`File ${file_name} truncated from ${text.length} to ${MAX_TEXT_CHARS} chars`);
          }

          let start = 0;
          let chunkIndex = 0;
          while (start < truncatedText.length) {
            const end = Math.min(start + maxChars, truncatedText.length);
            allChunks.push({
              content: truncatedText.slice(start, end),
              metadata: { file_name: file_name || "unknown", chunk_index: chunkIndex, start_char: start, end_char: end },
              source_id: source_id || undefined,
            });
            start = end - overlap;
            if (start >= truncatedText.length) break;
            chunkIndex++;
          }

          processedFiles.push(file_name || storage_path);

          if (source_id) {
            await supabase.from("project_sources").update({
              status: "processed",
              chunk_count: chunkIndex + 1,
            }).eq("id", source_id);
          }
        } catch (e) {
          console.error(`Error processing ${file_name}:`, e);
          failedFiles.push(file_name || storage_path);
        }

        processed++;
        await updateProgress(Math.round((processed / totalSources) * 80));
      }
    }

    // ─── Mode 2: Inline documents ───
    if (documents?.length) {
      for (const doc of documents) {
        let text: string = doc.text || doc.content || "";
        const fileName: string = doc.file_name || doc.name || "pasted_text.txt";
        const sourceId: string | undefined = doc.source_id;

        if (!text.trim()) { processed++; continue; }
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
        processed++;
        await updateProgress(Math.round((processed / totalSources) * 80));
      }
    }

    if (!allChunks.length) {
      await supabase.from("projects").update({ 
        status: "error", 
        ingest_progress: 0,
        ingest_error: "Не удалось извлечь текст ни из одного файла. Убедитесь, что файлы содержат читаемый текст.",
      }).eq("id", projectId);
      return;
    }

    const totalChars = allChunks.reduce((sum, c) => sum + c.content.length, 0);
    if (totalChars < 200) {
      await supabase.from("projects").update({ 
        status: "error",
        ingest_progress: 0, 
        ingest_error: "Слишком мало текстового контента для создания материала. Загрузите файлы с большим объёмом текста.",
      }).eq("id", projectId);
      return;
    }

    await updateProgress(85);

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
      await updateProgress(85 + Math.round((inserted / allChunks.length) * 15));
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

    console.log(`[project_ingest] Done: ${inserted} chunks, ${processedFiles.length} files, ${failedFiles.length} failed`);
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
    const { project_id, sources, documents, chunking } = body;
    if (!project_id) return errorResponse("project_id required", 400);

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("projects").select("id, user_id").eq("id", project_id).single();
    if (projErr || !project) return errorResponse("Project not found", 404);
    if (project.user_id !== user.id) return errorResponse("Forbidden", 403);

    // Set status to ingesting and reset progress
    await supabase.from("projects").update({ 
      status: "ingesting", 
      ingest_progress: 0,
      ingest_error: null,
    }).eq("id", project_id);

    // Start background processing — response returns immediately
    // @ts-ignore: EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processInBackground(supabaseUrl, supabaseKey, project_id, user.id, sources, documents, chunking)
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
