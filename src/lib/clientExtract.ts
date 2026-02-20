/**
 * Client-side text extraction for PDF, DOCX, and text files.
 * ALL heavy parsing runs in a Web Worker — the main thread is NEVER blocked.
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

/** Singleton worker — created lazily, reused across calls */
let _worker: Worker | null = null;
let _workerFailed = false;

function getWorker(): Worker | null {
  if (_workerFailed) return null;
  if (_worker) return _worker;
  try {
    _worker = new Worker(new URL("./extractWorker.ts", import.meta.url), { type: "module" });
    _worker.onerror = () => {
      console.warn("[clientExtract] Web Worker failed to load, falling back to main thread");
      _workerFailed = true;
      _worker = null;
    };
    return _worker;
  } catch (e) {
    console.warn("[clientExtract] Web Worker unavailable:", e);
    _workerFailed = true;
    return null;
  }
}

let _msgId = 0;

/** Extract text using the Web Worker (off main thread) */
function extractViaWorker(
  file: File,
  signal?: AbortSignal,
  onProgress?: (p: ExtractProgress) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    if (!worker) {
      reject(new Error("WORKER_UNAVAILABLE"));
      return;
    }

    const id = String(++_msgId);
    let settled = false;

    const cleanup = () => {
      settled = true;
      worker.removeEventListener("message", onMsg);
      signal?.removeEventListener("abort", onAbort);
    };

    const onMsg = (e: MessageEvent) => {
      if (e.data.id !== id || settled) return;

      if (e.data.type === "progress") {
        onProgress?.({
          page: e.data.page,
          totalPages: e.data.totalPages,
          file: e.data.file,
          stage: "extracting",
        });
        return;
      }

      if (e.data.type === "result") {
        cleanup();
        if (e.data.truncated) {
          console.warn(`[clientExtract] Text truncated to ${MAX_TEXT_CHARS} chars`);
        }
        resolve(e.data.text);
        return;
      }

      if (e.data.type === "error") {
        cleanup();
        reject(new Error(e.data.error));
        return;
      }
    };

    const onAbort = () => {
      if (settled) return;
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    worker.addEventListener("message", onMsg);
    signal?.addEventListener("abort", onAbort);

    // Send the file buffer to the worker (transferable for zero-copy)
    file.arrayBuffer().then(
      (buffer) => {
        if (settled) return;
        worker.postMessage({ id, buffer, fileName: file.name }, [buffer]);
      },
      (err) => {
        if (settled) return;
        cleanup();
        reject(err);
      }
    );
  });
}

/** Fallback: main-thread extraction with aggressive yielding */
async function extractOnMainThread(
  file: File,
  signal?: AbortSignal,
  onProgress?: (p: ExtractProgress) => void,
): Promise<string> {
  // Dynamic imports to avoid loading heavy libs unless needed
  const ext = file.name.toLowerCase().split(".").pop() || "";
  const buffer = await file.arrayBuffer();

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  if (ext === "pdf") {
    const pdfjsLib = await import("pdfjs-dist");
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    } catch (_) { /* ignore */ }

    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const numPages = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(" "));
      onProgress?.({ page: i, totalPages: numPages, stage: "extracting" });
      // Yield EVERY page to prevent freeze
      await new Promise<void>(r => setTimeout(r, 0));
    }

    let text = pages.join("\n\n");
    if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);
    return text;
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.default.extractRawText({ arrayBuffer: buffer });
    return result.value.slice(0, MAX_TEXT_CHARS);
  }

  // Plain text
  const text = new TextDecoder().decode(new Uint8Array(buffer));
  return text.slice(0, MAX_TEXT_CHARS);
}

/** Check if a file extension is supported */
export function isSupportedExtension(fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Extract text from any supported file.
 * Uses Web Worker by default (zero UI blocking).
 * Falls back to main-thread extraction if Worker is unavailable.
 */
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

  try {
    // Try Web Worker first (main thread stays free)
    const text = await extractViaWorker(file, signal, onProgress);
    console.log(`[clientExtract] Worker extracted: ${text.length} chars`);
    return text;
  } catch (e: any) {
    // Re-throw abort
    if (e.name === "AbortError") throw e;

    // If worker failed, fall back to main thread
    if (e.message === "WORKER_UNAVAILABLE" || _workerFailed) {
      console.warn("[clientExtract] Falling back to main-thread extraction");
      const text = await extractOnMainThread(file, signal, onProgress);
      console.log(`[clientExtract] Main-thread extracted: ${text.length} chars`);
      return text;
    }

    throw e;
  }
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
