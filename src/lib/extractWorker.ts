/**
 * Web Worker for PDF/DOCX/text extraction.
 * Runs entirely off the main thread — the UI NEVER freezes.
 */
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

const MAX_TEXT_CHARS = 500_000;
const MAX_PDF_PAGES = 50;

// Inside a Web Worker, pdfjs can't spawn a nested worker reliably.
// Setting workerSrc to empty forces pdfjs to run in "fake worker" mode,
// which is fine because WE are already off the main thread.
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
} catch (_) { /* ignore */ }

async function extractPdf(buffer: ArrayBuffer, id: string, fileName: string): Promise<{ text: string; pages: number }> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const numPages = Math.min(doc.numPages, MAX_PDF_PAGES);

  const pages: string[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(" "));

    // Post progress to main thread
    self.postMessage({ id, type: "progress", page: i, totalPages: numPages, file: fileName });
  }

  return { text: pages.join("\n\n"), pages: numPages };
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, buffer, fileName } = e.data;
  const ext = fileName.toLowerCase().split(".").pop() || "";

  try {
    let text = "";
    let pages: number | undefined;

    if (ext === "pdf") {
      const r = await extractPdf(buffer, id, fileName);
      text = r.text;
      pages = r.pages;
    } else if (ext === "docx") {
      text = await extractDocx(buffer);
    } else {
      text = new TextDecoder().decode(new Uint8Array(buffer));
    }

    const truncated = text.length > MAX_TEXT_CHARS;
    if (truncated) text = text.slice(0, MAX_TEXT_CHARS);

    self.postMessage({ id, type: "result", text, truncated, pages });
  } catch (err: any) {
    self.postMessage({ id, type: "error", error: err.message || String(err) });
  }
};
