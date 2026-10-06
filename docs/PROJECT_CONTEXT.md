# Project Context

## Current status

- Phase: Phase 1
- Current Step: Step 1 — Raw + Storage
- Step 1 status: PASS
- Next Step: Step 2 — DeepSeek + structured Draft
- DeepSeek has not been connected.

Step 1 is complete on the local `feature/raw-storage` branch. The branch is based on `develop`; `develop` is the integration target and `main` has not been modified. No merge or pull request has been created yet.

## Implemented in Step 1

- `types/raw.ts`
- `lib/raw-storage.ts`
- `app/api/raw/route.ts`
- `app/page.tsx`
- `app/globals.css`
- `.gitignore`
- Runtime storage: `data/raw.json`

The current UI accepts text, saves Raw data, and displays saved records. `POST /api/raw` validates the request and persists Raw data; `GET /api/raw` reads the saved records. `data/raw.json` is ignored by Git and is not a source-of-truth file in the repository.

## Verified behavior

The completed Step 1 verification covered Raw creation and reading, empty and overlong text rejection, missing and invalid request bodies, multiple Raw writes, missing-file recovery, corrupted-storage failure recovery, and persistence after restarting the development server. `pnpm lint`, `pnpm build`, and `git diff --check` passed.

## Not implemented yet

- DeepSeek or any model integration
- `/api/organize` and `OrganizeDraft`
- Knowledge and user confirmation flow
- KnowledgeRelation, Backlink, and Graph
- OCR, multimodal input, Agent, RAG, Embedding, and vector storage

These remain future work. Do not begin Step 2 or extend the UI until the next Step is explicitly started.
