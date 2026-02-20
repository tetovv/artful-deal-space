/**
 * Client-side text extraction for PDF, DOCX, and text files.
 * Avoids Edge Function memory limits by processing on the browser.
 */
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Configure PDF.js worker — try CDN, log if it fails
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn("[clientExtract] Failed to set PDF.js worker URL:", e);
}

const MAX_TEXT_CHARS = 500_000;
const MAX_PDF_PAGES = 50;

const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv", "json", "xml", "html", "htm", "rtf"]);

/** Extract text from a PDF file */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];
    const numPages = Math.min(doc.numPages, MAX_PDF_PAGES);
    console.log(`[clientExtract] PDF: ${doc.numPages} pages total, processing ${numPages}`);
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(" "));
    }
    const text = pages.join("\n\n");
    console.log(`[clientExtract] PDF extracted: ${text.length} chars`);
    return text;
  } catch (e: any) {
    console.error("[clientExtract] PDF extraction failed:", e);
    throw new Error(`PDF extraction failed: ${e.message || e}. Убедитесь, что PDF содержит текстовый слой (не сканированное изображение).`);
  }
}

/** Extract text from a DOCX file */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    console.log(`[clientExtract] DOCX extracted: ${result.value.length} chars`);
    return result.value;
  } catch (e: any) {
    console.error("[clientExtract] DOCX extraction failed:", e);
    throw new Error(`DOCX extraction failed: ${e.message || e}`);
  }
}

/** Check if a file extension is supported */
export function isSupportedExtension(fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  return SUPPORTED_EXTENSIONS.has(ext);
}

/** Extract text from any supported file */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop() || "";

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(`Неподдерживаемый формат файла: .${ext}. Поддерживаемые: ${[...SUPPORTED_EXTENSIONS].join(", ")}`);
  }

  console.log(`[clientExtract] Processing "${file.name}" (${(file.size / 1024).toFixed(1)} KB, ext: ${ext})`);
  const buffer = await file.arrayBuffer();

  let text = "";
  if (ext === "pdf") {
    text = await extractPdfText(buffer);
  } else if (ext === "docx") {
    text = await extractDocxText(buffer);
  } else {
    // txt, md, csv, json, xml, html, etc.
    text = new TextDecoder().decode(new Uint8Array(buffer));
    console.log(`[clientExtract] Text file extracted: ${text.length} chars`);
  }

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
