/**
 * Text extraction from PDF, DOCX, and plain text files.
 */

import pdf from "pdf-parse";
import mammoth from "mammoth";

const MAX_PDF_PAGES = 50;

/**
 * Extract text from a file buffer based on file name extension.
 * @param {Buffer} buffer
 * @param {string} fileName
 * @returns {Promise<string>}
 */
export async function extractText(buffer, fileName) {
  const ext = fileName.toLowerCase().split(".").pop() || "";

  if (ext === "pdf") {
    return extractPdf(buffer);
  }

  if (ext === "docx") {
    return extractDocx(buffer);
  }

  // txt, md, csv, json, xml, html, etc.
  return buffer.toString("utf-8");
}

async function extractPdf(buffer) {
  const opts = {
    max: MAX_PDF_PAGES,
  };

  const result = await pdf(buffer, opts);
  console.log(`[extract] PDF: ${result.numpages} pages, ${result.text.length} chars`);
  return result.text;
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  console.log(`[extract] DOCX: ${result.value.length} chars`);
  return result.value;
}
