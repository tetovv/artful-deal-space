# Ingest Worker

Background worker that polls `ingest_jobs` table and processes uploaded files into text chunks.

## How it works

1. Polls `ingest_jobs` with `status='queued'` every 3 seconds
2. Downloads files from Supabase Storage (`ai_sources` bucket)
3. Extracts text (PDF via `pdf-parse`, DOCX via `mammoth`, plain text)
4. Chunks text with overlap (1200 chars / 150 overlap)
5. Writes chunks to `project_chunks` table
6. Updates job status: `running` → `done` / `error` / `canceled`

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (full access) |

## Local Development

```bash
cd worker
npm install
cp .env.example .env
# Fill in .env
npm start
```

## Deploy on Render

- Type: **Background Worker**
- Root Directory: `worker`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: Node 20+
- Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
