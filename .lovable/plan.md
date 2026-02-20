

## Current State Assessment

The client-side extraction pipeline is **already correctly implemented**:

1. **`src/lib/clientExtract.ts`** -- uses `pdfjs-dist` v4 for PDF and `mammoth` for DOCX extraction directly in the browser
2. **`runStageIngest` in GuidedWorkspace.tsx** -- reads original File objects from `extractFilesRef`, extracts text client-side, chunks it, and inserts directly into `project_chunks` table via Supabase SDK (no Edge Function call)
3. **No call to `project_ingest` Edge Function** in the main pipeline path

## Why I Cannot Test Directly

The AI Workspace requires authentication, and the browser tool cannot upload files through a file input. **You need to test this yourself** by:

1. Log in to the app
2. Navigate to `/ai-workspace`
3. Upload the PDF file "Концессия 1397-р.pdf"
4. Select a goal and proceed
5. Watch the pipeline stages -- Stage 2 ("Извлечение и индексация") should complete without calling `project_ingest`

## Potential Issues to Harden

If Stage 2 still fails, the likely causes are:

### 1. PDF.js worker loading failure
The worker is loaded from CDN: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`. If the CDN is blocked or the version string mismatches, extraction silently fails.

**Fix**: Add a try/catch around `extractPdfText` with a clear error message, and add a fallback worker URL.

### 2. File object lost on retry
If the user retries Stage 2, `extractFilesRef.current` may be empty (Map cleared on new generation). The fallback downloads from Storage, but `supabase.storage.download()` returns a `Blob`, not a `File` with the correct name extension.

**Fix**: Ensure the fallback path correctly sets the file name for extension detection.

### 3. Large PDF memory pressure
A large PDF (50+ pages) could strain browser memory during `pdfjs-dist` parsing.

**Fix**: Add progress reporting and catch OOM errors gracefully.

## Implementation Plan

### Step 1: Add robust error handling to `clientExtract.ts`
- Wrap PDF extraction in try/catch with specific error messages
- Add a console.log for debugging extracted text length
- Handle the case where PDF.js worker fails to load

### Step 2: Fix fallback path in `runStageIngest`
- When downloading from Storage on retry, preserve file extension for correct extraction routing

### Step 3: Add extraction progress feedback
- Update stage label to show "Extracting file X of N..." during extraction
- Show chunk count after completion

### Step 4: Verify file type support
- PDF: via pdfjs-dist (client)
- DOCX: via mammoth (client)
- TXT/MD/CSV: via TextDecoder (client)
- Ensure unsupported formats show a clear error

## Technical Details

```text
Pipeline Flow (no Edge Function):

[User uploads file] 
    --> Storage upload (ai_sources bucket)
    --> File object kept in extractFilesRef
    --> extractTextFromFile(file) [browser, pdfjs/mammoth]
    --> chunkText(text, 1200, 150)
    --> supabase.from("project_chunks").insert(batches)
    --> project status = "ingested"
```

**Limits**:
- Max file size: 20MB (Storage limit)
- Max text: 500,000 characters (truncated)
- Max PDF pages: 50
- Chunk size: 1,200 chars with 150 overlap
- Batch insert: 50 chunks per DB call

