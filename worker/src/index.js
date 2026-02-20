/**
 * Ingest Worker — polls ingest_jobs (status='queued'), processes files,
 * extracts text, chunks content, writes to project_chunks.
 *
 * ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { extractText } from "./extract.js";
import { chunkText } from "./chunk.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const POLL_INTERVAL_MS = 3_000;
const MAX_TEXT_CHARS = 500_000;
const CHUNK_MAX = 1200;
const CHUNK_OVERLAP = 150;
const BATCH_SIZE = 50;

/** Update job row */
async function updateJob(jobId, fields) {
  await supabase
    .from("ingest_jobs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

/** Process a single ingest job */
async function processJob(job) {
  const { id: jobId, project_id: projectId, user_id: userId } = job;
  console.log(`[worker] Processing job ${jobId} for project ${projectId}`);

  await updateJob(jobId, {
    status: "running",
    progress: 0,
    started_at: new Date().toISOString(),
    stage: "loading_sources",
    message: "Загрузка источников…",
    error: null,
  });

  try {
    // 1. Fetch project_sources for this project
    const { data: sources, error: srcErr } = await supabase
      .from("project_sources")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "uploaded");

    if (srcErr) throw new Error(`Sources fetch error: ${srcErr.message}`);
    if (!sources || sources.length === 0) {
      throw new Error("Нет загруженных файлов для обработки.");
    }

    await updateJob(jobId, {
      progress: 5,
      message: `Найдено ${sources.length} файл(ов)`,
    });

    // Check for cancellation
    const cancelled = await isCancelled(jobId);
    if (cancelled) return;

    // 2. Download + extract text from each source
    const allChunks = [];
    const totalSources = sources.length;

    for (let i = 0; i < totalSources; i++) {
      if (await isCancelled(jobId)) return;

      const src = sources[i];
      const pct = 5 + Math.round(((i + 1) / totalSources) * 55);

      await updateJob(jobId, {
        progress: Math.min(pct, 60),
        stage: "extracting",
        message: `Извлечение текста: ${src.file_name} (${i + 1}/${totalSources})`,
      });

      // Download file from storage
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("ai_sources")
        .download(src.storage_path);

      if (dlErr) {
        console.warn(`[worker] Download failed for ${src.file_name}:`, dlErr.message);
        await supabase
          .from("project_sources")
          .update({ status: "error" })
          .eq("id", src.id);
        continue;
      }

      // Extract text
      let text = "";
      try {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        text = await extractText(buffer, src.file_name);
      } catch (extErr) {
        console.warn(`[worker] Extract failed for ${src.file_name}:`, extErr.message);
        await supabase
          .from("project_sources")
          .update({ status: "error" })
          .eq("id", src.id);
        continue;
      }

      if (!text || text.trim().length === 0) {
        await supabase
          .from("project_sources")
          .update({ status: "error" })
          .eq("id", src.id);
        continue;
      }

      // Truncate if too long
      if (text.length > MAX_TEXT_CHARS) {
        text = text.slice(0, MAX_TEXT_CHARS);
      }

      // Chunk
      const chunks = chunkText(text, CHUNK_MAX, CHUNK_OVERLAP);
      for (const c of chunks) {
        allChunks.push({
          project_id: projectId,
          user_id: userId,
          source_id: src.id,
          content: c.content,
          metadata: {
            file_name: src.file_name,
            chunk_index: c.chunk_index,
            start_char: c.start_char,
            end_char: c.end_char,
          },
        });
      }

      // Update source status
      await supabase
        .from("project_sources")
        .update({ status: "processed", chunk_count: chunks.length })
        .eq("id", src.id);
    }

    if (await isCancelled(jobId)) return;

    if (allChunks.length === 0) {
      throw new Error("Не удалось извлечь текст ни из одного файла.");
    }

    // 3. Delete old chunks for this project
    await updateJob(jobId, {
      progress: 65,
      stage: "writing",
      message: "Удаление старых данных…",
    });

    await supabase
      .from("project_chunks")
      .delete()
      .eq("project_id", projectId);

    // 4. Insert new chunks in batches
    let inserted = 0;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      if (await isCancelled(jobId)) return;

      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const { error: insErr } = await supabase
        .from("project_chunks")
        .insert(batch);

      if (insErr) {
        console.error(`[worker] Chunk insert error:`, insErr.message);
        continue;
      }

      inserted += batch.length;
      const writePct = 65 + Math.round((inserted / allChunks.length) * 30);

      await updateJob(jobId, {
        progress: Math.min(writePct, 95),
        message: `Запись чанков: ${inserted}/${allChunks.length}`,
      });
    }

    if (inserted === 0) {
      throw new Error("Не удалось сохранить данные. Попробуйте ещё раз.");
    }

    // 5. Update project status
    await supabase
      .from("projects")
      .update({
        status: "ingested",
        ingest_progress: 100,
        ingest_error: null,
      })
      .eq("id", projectId);

    // 6. Mark job as done
    await updateJob(jobId, {
      status: "done",
      progress: 100,
      stage: "done",
      message: `Готово: ${inserted} чанков из ${totalSources} файлов`,
      finished_at: new Date().toISOString(),
    });

    console.log(`[worker] Job ${jobId} done: ${inserted} chunks`);
  } catch (err) {
    console.error(`[worker] Job ${jobId} error:`, err.message);

    await updateJob(jobId, {
      status: "error",
      progress: 0,
      stage: "error",
      error: err.message,
      message: null,
      finished_at: new Date().toISOString(),
    });

    await supabase
      .from("projects")
      .update({
        status: "error",
        ingest_progress: 0,
        ingest_error: err.message,
      })
      .eq("id", job.project_id);
  }
}

/** Check if the job has been cancelled */
async function isCancelled(jobId) {
  const { data } = await supabase
    .from("ingest_jobs")
    .select("status")
    .eq("id", jobId)
    .single();

  if (data?.status === "canceled") {
    console.log(`[worker] Job ${jobId} was cancelled`);
    await updateJob(jobId, {
      status: "canceled",
      finished_at: new Date().toISOString(),
      message: "Отменено пользователем",
    });
    return true;
  }
  return false;
}

/** Main polling loop */
async function pollLoop() {
  console.log("[worker] Ingest worker started, polling every", POLL_INTERVAL_MS, "ms");

  while (true) {
    try {
      // Pick the oldest queued job
      const { data: jobs, error } = await supabase
        .from("ingest_jobs")
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1);

      if (error) {
        console.error("[worker] Poll error:", error.message);
      } else if (jobs && jobs.length > 0) {
        await processJob(jobs[0]);
      }
    } catch (e) {
      console.error("[worker] Unexpected error:", e.message);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM received, shutting down");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[worker] SIGINT received, shutting down");
  process.exit(0);
});

pollLoop();
