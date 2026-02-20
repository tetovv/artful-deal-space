/**
 * Client-side text extraction for PDF, DOCX, and text files.
 * 
 * KEY DESIGN: Libraries (pdfjs-dist, mammoth) are loaded via dynamic import()
 * only when actually needed. This prevents them from blocking page load.
 * PDF extraction yields to the UI after EVERY page to prevent freezing.
 * Supports AbortSignal for cancellation and progress callbacks.
 */

export const MAX_TEXT_CHARS = 500_000;
export const MAX_PDF_PAGES = 50;
export const MAX_FILE_SIZE_MB = 20;

const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv", "json", "xml", "html", "htm", "rtf"]);

export interface ExtractProgress {
  page?: number;
  totalPages?: number;
  file?: string;
  stage?: string;
}

/** Yield to the browser event loop so the UI doesn't freeze */
const yieldToUI = () => new Promise<void>(r => setTimeout(r, 0));

/** Extract text from a PDF file — dynamic import, yields EVERY page */
async function extractPdfText(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
  onProgress?: (p: ExtractProgress) => void,
): Promise<string> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // Dynamic import — pdfjs-dist is NOT loaded at page load
  const pdfjsLib = await import("pdfjs-dist");

  // Configure worker — use CDN so PDF parsing runs in a pdfjs Web Worker
  // If this fails, pdfjs falls back to main thread but we yield every page
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn("[clientExtract] Failed to set PDF.js worker URL:", e);
  }

  try {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const numPages = Math.min(doc.numPages, MAX_PDF_PAGES);
    console.log(`[clientExtract] PDF: ${doc.numPages} pages, processing ${numPages}`);

    if (doc.numPages > MAX_PDF_PAGES) {
      console.warn(`[clientExtract] PDF truncated: ${doc.numPages} → ${MAX_PDF_PAGES}`);
    }

    const pages: string[] = [];
    for (let i = 1; i <= numPages; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(" "));

      onProgress?.({ page: i, totalPages: numPages, stage: "extracting" });

      // Yield EVERY page — prevents UI freeze even if pdfjs worker isn't loading
      await yieldToUI();
    }

    let text = pages.join("\n\n");
    if (text.length > MAX_TEXT_CHARS) {
      console.warn(`[clientExtract] Text truncated: ${text.length} → ${MAX_TEXT_CHARS}`);
      text = text.slice(0, MAX_TEXT_CHARS);
    }

    console.log(`[clientExtract] PDF extracted: ${text.length} chars`);
    return text;
  } catch (e: any) {
    if (e.name === "AbortError") throw e;
    console.error("[clientExtract] PDF extraction failed:", e);
    throw new Error(`PDF extraction failed: ${e.message || e}. Убедитесь, что PDF содержит текстовый слой.`);
  }
}

/** Extract text from a DOCX file — dynamic import */
async function extractDocxText(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // Dynamic import — mammoth is NOT loaded at page load
  const mammoth = await import("mammoth");

  try {
    const result = await mammoth.default.extractRawText({ arrayBuffer: buffer });
    console.log(`[clientExtract] DOCX extracted: ${result.value.length} chars`);
    return result.value.slice(0, MAX_TEXT_CHARS);
  } catch (e: any) {
    if (e.name === "AbortError") throw e;
    console.error("[clientExtract] DOCX extraction failed:", e);
    throw new Error(`DOCX extraction failed: ${e.message || e}`);
  }
}

/** Check if a file extension is supported */
export function isSupportedExtension(fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  return SUPPORTED_EXTENSIONS.has(ext);
}

/** Extract text from any supported file with abort support */
export async function extractTextFromFile(
  file: File,
  signal?: AbortSignal,
  onProgress?: (p: ExtractProgress) => void,
): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop() || "";

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(`Неподдерживаемый формат файла: .${ext}. Поддерживаемые: ${[...SUPPORTED_EXTENSIONS].join(", ")}`);
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  console.log(`[clientExtract] Processing "${file.name}" (${(file.size / 1024).toFixed(1)} KB, ext: ${ext})`);
  const buffer = await file.arrayBuffer();

  if (ext === "pdf") {
    return extractPdfText(buffer, signal, onProgress);
  }
  if (ext === "docx") {
    return extractDocxText(buffer, signal);
  }

  // txt, md, csv, json, xml, html, etc.
  const text = new TextDecoder().decode(new Uint8Array(buffer));
  console.log(`[clientExtract] Text file extracted: ${text.length} chars`);
  return text.slice(0, MAX_TEXT_CHARS);
}

/** Chunk text with overlap */
export function chunkText(
  text: string,
  maxChars = 1200,
  overlap = 150,
): { content: string; chunk_index: number; start_char: number; end_char: number }[] {
  const chunks: { content: string; chunk_index: number; start_char: number; end_char: number }[] = [];
  let start = 0;
  let ci = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push({ content: text.slice(start, end), chunk_index: ci, start_char: start, end_char: end });
    start = end - overlap;
    if (start >= text.length) break;
    ci++;
  }
  return chunks;
}
