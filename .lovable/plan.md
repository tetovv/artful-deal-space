

# Reliable Stage 2 Pipeline: No Hangs, No Empty Player

## Problem Summary

The pipeline has 6 critical bugs:
1. Stage 2 (client extraction) can hang forever -- no watchdog timeout wraps `runStageIngest`
2. No Cancel button -- user is trapped watching spinner
3. Resume from "My Materials" blindly opens PLAYER regardless of project status (draft/error/generating all open empty player)
4. PLAYER shows "No content. Click Next Step" when artifacts are missing due to pipeline failure
5. `handleAddSources` still calls Edge Function `project_ingest` -- will hit WORKER_LIMIT
6. PDF extraction doesn't yield to UI between pages -- causes UI freeze on large PDFs

## Changes Overview

### File 1: `src/lib/clientExtract.ts`

**Add AbortSignal support and per-page yielding to PDF extraction**

- `extractPdfText(buffer, signal?)` -- check `signal.aborted` between pages, yield to UI every 5 pages
- `extractTextFromFile(file, signal?)` -- pass signal through
- Export `MAX_TEXT_CHARS`, `MAX_PDF_PAGES` constants for UI display
- Add `onProgress?: (page: number, total: number) => void` callback for page-level progress

### File 2: `src/components/guided/GuidedWorkspace.tsx`

**6 targeted changes:**

1. **Add `"canceled"` to `GenStageStatus`** (line 33) and create `abortRef = useRef<AbortController | null>(null)`

2. **Wrap `runStageIngest` in `withTimeout`** (line 943):
   ```
   case "ingesting":
     await withTimeout(
       runStageIngest(projId, sources, pastedText, abortRef.current!.signal),
       STAGE_TIMEOUT_MS,  // 120s
       "ingesting"
     );
   ```

3. **Pass AbortSignal through `runStageIngest`** -- check `signal.aborted` between file iterations and between batch inserts. Throw a dedicated `AbortError`-style EdgeError on cancellation.

4. **Add Cancel button to progress screen** (after line 1681):
   ```
   <Button variant="ghost" size="sm" onClick={() => {
     abortRef.current?.abort();
     // Stage catch block handles status transition
   }}>
     Cancel
   </Button>
   ```
   The catch block in `runPipelineFrom` detects abort and sets stage to `canceled`, genStatus to `error`, updates project status to `error`.

5. **Fix resume logic** (lines 653-660):
   ```
   useEffect(() => {
     if (!resumeProjectId || resumeProjectId === projectId) return;
     // Fetch project to check status
     supabase.from("projects").select("*").eq("id", resumeProjectId).single()
       .then(({ data: proj }) => {
         setProjectId(resumeProjectId);
         if (proj?.status === "ready" && artifacts exist) {
           setPhase("player");
           setGenStatus("done");
         } else if (proj?.status === "error") {
           setPhase("generate");
           setGenStatus("error");
           setPipelineError({ functionName: "resume", status: 0, body: "Previous generation failed" });
         } else {
           // draft/ingesting/generating -- show progress screen
           setPhase("generate");
           setGenStatus("idle");
         }
         onResumeComplete?.();
       });
   }, [resumeProjectId]);
   ```

6. **Replace empty PLAYER state** (lines 1698-1704) with ErrorCard:
   ```
   if (!activeArtifact || !pub) {
     return (
       <Card className="border-destructive/30 bg-destructive/5">
         <CardContent className="pt-5 space-y-3">
           <AlertTriangle ... />
           <p>Guide not ready or generation incomplete</p>
           <Button onClick={() => handleRetryStage("generating")}>Retry generation</Button>
           <Button onClick={handleReplan}>Replan</Button>
           <Button onClick={backToSources}>Back to sources</Button>
         </CardContent>
       </Card>
     );
   }
   ```

7. **Fix `handleAddSources`** (line 1257): replace `callEdge("project_ingest", ...)` with client-side extraction using `extractTextFromFile` + `chunkText` + direct DB insert (same pattern as `runStageIngest`).

### File 3: `src/components/guided/MyMaterials.tsx`

**Fix `deriveStatus` to handle all project states:**

```
type GuideStatus = "ready" | "error" | "generating" | "draft";

function deriveStatus(proj: any): GuideStatus {
  const s = proj.status as string;
  if (s === "error" || s === "failed") return "error";
  if (["generating", "ingesting", "planning"].includes(s)) return "generating";
  if (s === "draft" || s === "uploaded" || s === "ingested") return "draft";
  return "ready";  // "ready" or unknown
}
```

**Add UI for `generating` status:**
- Show spinner badge + "View progress" button (disabled, no PLAYER opening)
- For `draft` status: show "Continue setup" button that goes back to generate phase

## Technical Details

### Timeout values:
- uploading: 60s
- ingesting: 120s (large PDFs need time)
- planning: 180s (LLM)
- generating: 180s (LLM)

### Cancel flow:
```
User clicks "Cancel"
  -> abortRef.current.abort()
  -> runStageIngest checks signal.aborted between files
  -> throws EdgeError with functionName="canceled"
  -> catch block sets stage="canceled", genStatus="error"
  -> project.status updated to "error" in DB
  -> UI shows error screen with "Retry" + "Back to sources"
```

### Limits (displayed in intake and error screens):
- Max file size: 20 MB per file (Storage limit)
- Max PDF pages: 50 (truncated with warning)
- Max text: 500,000 characters (truncated with warning)
- Min text for quality: 200 characters

### Resume flow (fixed):
```
MyMaterials -> onResume(projectId)
  -> GuidedWorkspace fetches project status
  -> error -> show error screen with retry
  -> generating/ingesting -> show read-only progress screen
  -> draft -> show intake/generate screen
  -> ready + has artifacts -> open PLAYER
```

