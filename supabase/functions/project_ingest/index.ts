import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const MAX_TEXT_CHARS = 500_000;

/* ─── PDF text extraction using pdfjs-serverless ─── */
async function extractPdfText(data: Uint8Array): Promise<string> {
  try {
    const { getDocument } = await import("https://esm.sh/pdfjs-serverless@0.6.0");
    const doc = await getDocument({ data, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 50); i++) {
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

/* ─── DOCX text extraction using JSZip ─── */
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

  if (ext === "pdf") {
    return extractPdfText(bytes);
  }
  if (ext === "docx") {
    return extractDocxText(bytes);
  }
  // txt, md, and other text files
  return new TextDecoder().decode(bytes);
}

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

    const allChunks: { content: string; metadata: Record<string, unknown>; source_id?: string }[] = [];
    const processedFiles: string[] = [];
    const failedFiles: string[] = [];

    // ─── Mode 1: Storage-based sources (download → extract → chunk) ───
    if (sources?.length) {
      for (const src of sources) {
        const { storage_path, file_name, source_id } = src;
        if (!storage_path) continue;

        try {
          // Download file from Storage
          const { data: fileData, error: dlErr } = await supabase.storage
            .from("ai_sources")
            .download(storage_path);

          if (dlErr || !fileData) {
            console.error(`Failed to download ${storage_path}:`, dlErr);
            failedFiles.push(file_name || storage_path);
            continue;
          }

          // Extract text based on file type (PDF, DOCX, TXT, etc.)
          const text = await extractTextFromBlob(fileData, file_name || storage_path);
          if (!text.trim()) {
            failedFiles.push(file_name || storage_path);
            continue;
          }

          if (text.length > MAX_TEXT_CHARS) {
            console.warn(`File ${file_name} truncated from ${text.length} to ${MAX_TEXT_CHARS} chars`);
          }

          const truncatedText = text.slice(0, MAX_TEXT_CHARS);

          // Chunk the text
          let start = 0;
          let chunkIndex = 0;
          while (start < truncatedText.length) {
            const end = Math.min(start + maxChars, truncatedText.length);
            const chunk = truncatedText.slice(start, end);
            allChunks.push({
              content: chunk,
              metadata: { file_name: file_name || "unknown", chunk_index: chunkIndex, start_char: start, end_char: end },
              source_id: source_id || undefined,
            });
            start = end - overlap;
            if (start >= truncatedText.length) break;
            chunkIndex++;
          }

          processedFiles.push(file_name || storage_path);

          // Update source record with chunk count
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
      }
    }

    // ─── Mode 2: Inline documents[] (legacy / pasted text) ───
    if (documents?.length) {
      for (const doc of documents) {
        let text: string = doc.text || doc.content || "";
        const fileName: string = doc.file_name || doc.name || "pasted_text.txt";
        const sourceId: string | undefined = doc.source_id;

        if (!text.trim()) continue;
        if (text.length > MAX_TEXT_CHARS) {
          text = text.slice(0, MAX_TEXT_CHARS);
        }

        let start = 0;
        let chunkIndex = 0;
        while (start < text.length) {
          const end = Math.min(start + maxChars, text.length);
          const chunk = text.slice(start, end);
          allChunks.push({
            content: chunk,
            metadata: { file_name: fileName, chunk_index: chunkIndex, start_char: start, end_char: end },
            source_id: sourceId,
          });
          start = end - overlap;
          if (start >= text.length) break;
          chunkIndex++;
        }
        processedFiles.push(fileName);
      }
    }

    if (!allChunks.length) {
      await supabase.from("projects").update({ status: "error" }).eq("id", project_id);
      return errorResponse("Не удалось извлечь текст ни из одного файла. Убедитесь, что файлы содержат читаемый текст.", 400);
    }

    // Quality check
    const totalChars = allChunks.reduce((sum, c) => sum + c.content.length, 0);
    if (totalChars < 200) {
      await supabase.from("projects").update({ status: "error" }).eq("id", project_id);
      return errorResponse("Слишком мало текстового контента для создания материала. Загрузите файлы с большим объёмом текста.", 400);
    }

    // Delete old chunks
    await supabase.from("project_chunks").delete().eq("project_id", project_id);

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < allChunks.length; i += 50) {
      const batch = allChunks.slice(i, i + 50).map((c) => ({
        project_id,
        user_id: user.id,
        content: c.content,
        metadata: c.metadata,
        source_id: c.source_id || project_id,
      }));

      const { error: insertErr } = await supabase.from("project_chunks").insert(batch);
      if (insertErr) {
        console.error("Chunk insert error:", insertErr);
        // Continue with remaining batches instead of failing entirely
        continue;
      }
      inserted += batch.length;
    }

    if (inserted === 0) {
      await supabase.from("projects").update({ status: "error" }).eq("id", project_id);
      return errorResponse("Не удалось сохранить данные. Попробуйте ещё раз.", 500);
    }

    await supabase.from("projects").update({ status: "ingested" }).eq("id", project_id);

    return jsonResponse({
      success: true,
      chunks_created: inserted,
      files_processed: processedFiles,
      files_failed: failedFiles,
      mode: sources?.length ? "storage" : "inline",
    });
  } catch (e) {
    console.error("project_ingest error:", e);
    return errorResponse(e as Error);
  }
});
