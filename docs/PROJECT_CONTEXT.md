# Project Context

## Current status

- Phase: Phase 1
- Current Step: Step 2 — DeepSeek + structured Draft
- Step 1 status: PASS
- Step 2 status: PASS
- Next Step: Step 3 — Draft confirmation + Knowledge persistence
- DeepSeek is connected only on the server.

Step 1 is merged into the `develop-guozechen` integration branch. The project is currently being built on `develop-guozechen`; `main` has not been modified.

## Implemented in Step 1

- `types/raw.ts`
- `lib/raw-storage.ts`
- `app/api/raw/route.ts`
- `app/page.tsx`
- `app/globals.css`
- `.gitignore`
- `types/organize.ts`
- `lib/deepseek.ts`
- `app/api/organize/route.ts`
- Runtime storage: `data/raw.json`

The current UI accepts text, saves Raw data, and displays saved records. `POST /api/raw` validates the request and persists Raw data; `GET /api/raw` reads the saved records. `data/raw.json` is ignored by Git and is not a source-of-truth file in the repository.

`POST /api/organize` accepts a `rawId`, reads the corresponding Raw on the server, calls DeepSeek, validates the JSON Draft shape, filters unknown related Knowledge IDs, and returns the Draft without persisting Knowledge or changing Raw. `DEEPSEEK_API_KEY` is never exposed to the browser.

## Verified behavior

The completed Step 1 verification covered Raw creation and reading, empty and overlong text rejection, missing and invalid request bodies, multiple Raw writes, missing-file recovery, corrupted-storage failure recovery, and persistence after restarting the development server. `pnpm lint`, `pnpm build`, and `git diff --check` passed.

Step 2 verification covered a real DeepSeek Draft response, empty and unknown `rawId`, invalid JSON and body shapes, invalid Draft JSON, non-JSON upstream output, upstream failure, timeout, missing API key, unknown relation ID filtering, and Raw retention after failures.

## Not implemented yet

- Knowledge and user confirmation flow
- KnowledgeRelation, Backlink, and Graph
- OCR, multimodal input, Agent, RAG, Embedding, and vector storage

These remain future work. Do not begin Step 3 or extend the UI until the next Step is explicitly started.
