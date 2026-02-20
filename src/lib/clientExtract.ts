/**
 * Client-side text extraction for PDF, DOCX, and text files.
 * Avoids Edge Function memory limits by processing on the browser.
 */
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAX_TEXT_CHARS = 500_000;
const MAX_PDF_PAGES = 50;

/** Extract text from a PDF file */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  const numPages = Math.min(doc.numPages, MAX_PDF_PAGES);
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(" "));
  }
  return pages.join("\n\n");
}

/** Extract text from a DOCX file */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

/** Extract text from any supported file */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  const buffer = await file.arrayBuffer();

  let text = "";
  if (ext === "pdf") {
    text = await extractPdfText(buffer);
  } else if (ext === "docx") {
    text = await extractDocxText(buffer);
  } else {
    // txt, md, csv, etc.
    text = new TextDecoder().decode(new Uint8Array(buffer));
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
