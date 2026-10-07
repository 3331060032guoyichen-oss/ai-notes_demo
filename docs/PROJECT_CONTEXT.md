# Project Context

## Current status

- Phase: Phase 1
- Step 1 status: PASS
- Step 2 status: PASS
- Step 3 status: PASS
- Step 4 status: PASS
- Step 5 status: PASS
- Step 6 status: PASS
- Current Step: Wiki structure foundation
- Phase 1 status: PASS
- Next Step: Future phase planning
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
- `types/knowledge.ts`
- `lib/knowledge-storage.ts`
- `app/api/knowledge/route.ts`
- `app/api/knowledge/[id]/route.ts`
- `types/relation.ts`
- `lib/relation-storage.ts`
- `app/api/relations/route.ts`
- `app/api/knowledge/[id]/relations/route.ts`
- `app/api/knowledge/[id]/backlinks/route.ts`
- `app/api/relations/[id]/route.ts`
- `types/graph.ts`
- `app/api/graph/route.ts`
- `types/wiki.ts`
- `lib/wiki-storage.ts`
- `app/api/wiki/route.ts`
- `data/wiki.json`
- Draft confirmation UI in `app/page.tsx`
- Runtime storage: `data/raw.json`
- Runtime storage: `data/knowledge.json`
- Runtime storage: `data/relations.json`
- Article-derived Wiki structure: `data/wiki.json`

The current UI accepts text, saves Raw data, and displays saved records. `POST /api/raw` validates the request and persists Raw data; `GET /api/raw` reads the saved records. `data/raw.json` is ignored by Git and is not a source-of-truth file in the repository.

`POST /api/organize` accepts a `rawId`, reads the corresponding Raw on the server, calls DeepSeek, validates the JSON Draft shape, filters unknown related Knowledge IDs, and returns the Draft without persisting Knowledge or changing Raw. `DEEPSEEK_API_KEY` is never exposed to the browser.

## Verified behavior

The completed Step 1 verification covered Raw creation and reading, empty and overlong text rejection, missing and invalid request bodies, multiple Raw writes, missing-file recovery, corrupted-storage failure recovery, and persistence after restarting the development server. `pnpm lint`, `pnpm build`, and `git diff --check` passed.

Step 2 verification covered a real DeepSeek Draft response, empty and unknown `rawId`, invalid JSON and body shapes, invalid Draft JSON, non-JSON upstream output, upstream failure, timeout, missing API key, unknown relation ID filtering, and Raw retention after failures.

Step 3 verification covered the real page flow from Raw to Draft, editing Draft, cancelling without creating Knowledge, confirming and persisting Knowledge, list/detail reads, duplicate confirmation protection, Raw traceability, and restart persistence. The page uses the local Brandkit token style without adding a UI dependency.

Step 4 verification covered real AI relation suggestions, user selection in the page, accepted relation persistence, unknown Knowledge rejection, self-relation rejection, reverse-direction deduplication, and dynamic relation reads for both endpoints.

Step 5 verification covered dynamic Backlink reads, empty results, unknown Knowledge handling, relation deletion followed by a changed Backlink result, and relation/Backlink persistence after restarting the server.

Step 6 verification covered dynamic Graph nodes and edges, a readable node list, clicking a node to load Knowledge details, and keeping Graph reads separate from the Raw/Draft/Knowledge write flow. The view uses the local Brandkit token style and no graph dependency.

The current Wiki structure foundation stores the attached LLM Wiki article as an immutable Raw source and exposes 12 derived Wiki pages with 14 typed links. The page includes a browsable Wiki directory and detail view; it is intentionally read-only until the future Ingest / Proposal workflow is implemented.

Final Phase 1 verification covered one fresh end-to-end chain: Raw creation, real DeepSeek Draft generation, user-edited confirmation, Knowledge persistence, accepted Relation, dynamic Backlink, Graph node/edge generation, Knowledge detail loading, and restart persistence for Raw, Knowledge, and Relation.

## Not implemented yet

- OCR, multimodal input, Agent, RAG, Embedding, and vector storage

These remain future work outside the completed Phase 1 scope.
