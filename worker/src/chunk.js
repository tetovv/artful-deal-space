/**
 * Text chunking with overlap.
 */

/**
 * Split text into overlapping chunks.
 * @param {string} text
 * @param {number} maxChars
 * @param {number} overlap
 * @returns {{ content: string, chunk_index: number, start_char: number, end_char: number }[]}
 */
export function chunkText(text, maxChars = 1200, overlap = 150) {
  const chunks = [];
  let start = 0;
  let ci = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push({
      content: text.slice(start, end),
      chunk_index: ci,
      start_char: start,
      end_char: end,
    });
    start = end - overlap;
    if (start >= text.length) break;
    ci++;
  }

  return chunks;
}
