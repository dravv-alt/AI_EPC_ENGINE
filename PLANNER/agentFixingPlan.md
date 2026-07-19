# Agent Fixing Plan — Agents 1, 4, 5

Rebuild the Specification & Quality Compliance Agent (1), the Predictive Schedule Risk Engine (4),
and the Project Knowledge & RFI Intelligence Agent (5) to their planned functionality, in
TypeScript, inside the existing Next.js/Node codebase.

**Written for AFK execution.** Every slice is a tracer bullet: a thin end-to-end path that runs and
is verifiable before the next slice thickens it. Each slice is one commit (`Slice N: <description>`,
matching existing history) and ships a `scripts/verify-*-http.ts` wired into `verify:all`.

---

## Decisions already made (do not relitigate)

| # | Decision |
| --- | --- |
| 1 | Add `NimModelProvider` alongside the existing providers. Gemini stays on raw `fetch` — **no SDK dependency added**, for consistency. |
| 2 | Embeddings are **RAG-only** (index-side `worker.ts:137`, query-side `knowledge/query.ts:34`). Nothing else uses them. |
| 3 | Embeddings move to a **third Python service** (`services/retrieval`), stateless, mirroring `ingestion`/`solver`. `sentence-transformers`, no DB access, no auth. |
| 4 | **Split the provider switches.** `MODEL_PROVIDER` ∈ `mock \| gemini \| nim` governs generation. New `EMBEDDING_PROVIDER` ∈ `mock \| service` governs embeddings, defaulting to `mock`. Add `embedding_model` column + a reindex script. |
| 5 | Agent 5 pipeline = **2 LLM calls**, not 5 hops: one planning call (intent + routing + decomposition), one synthesis call. Retrieval, rerank, and graph expansion are deterministic. |
| 6 | Agent 1 becomes a **RAG pipeline**: metadata filter → semantic search → LLM comparison + professional narrative. It no longer requires a hand-picked target region. |
| 7 | **The LLM owns the compliance verdict** in real mode. `compareCompliance` is demoted to *mock-supplier* + recorded cross-check. This keeps `verify:all` green offline. |
| 8 | Agent 4 signals stay **synthetic but lively** — no new DB queries. |
| 9 | Agent 4 mitigation proposals become **LLM-generated**. |
| 10 | NIM: OpenAI-compatible, configurable base URL, `meta/llama-3.3-70b-instruct`, `temperature: 0`, **JSON-repair retry**, schema-in-prompt. |
| 11 | UI is in scope but thin. Sequencing is dependency-ordered: Foundation → Retrieval service → Agent 5 → Agent 1 → Agent 4. |

## Invariants that must survive every slice

1. **`verify:all` stays green offline** — with `MODEL_PROVIDER=mock` and `EMBEDDING_PROVIDER=mock`,
   the full matrix runs with no containers, no API keys, no network.
2. **Vector search is never global.** The project-scope filter runs in SQL *before* ranking, behind
   `requireProjectPermission`. The Python service never sees a database.
3. **Groundedness is enforced in code, never trusted from the model.** Any model-returned region ID
   is validated against the retrieved set — the guard at `cx/generation.ts:76` is the reference
   implementation.
4. **Nothing AI-authored is authoritative.** Everything lands in `reviewState: "proposed"`; a human
   promotes it. No agent sets a gate, closes a finding, or moves a schedule date.
5. **AI-authored text is labelled** in the database and the audit chain, not just the UI.

---

# Slice 0 — Model provider foundation

**Goal:** three generation providers, two embedding providers, independently switchable, with
structured output that survives a sloppy model.

**Files:** `src/lib/model/provider.ts`, `src/lib/env.ts`, `.env.example`, `package.json`

### Work

1. **Split the env switches** (`src/lib/env.ts:22`):
   ```
   MODEL_PROVIDER      mock | gemini | nim      (default mock)   — generation
   EMBEDDING_PROVIDER  mock | service           (default mock)   — embeddings
   NIM_BASE_URL        default https://integrate.api.nvidia.com/v1
   NIM_API_KEY         optional
   NIM_MODEL           default meta/llama-3.3-70b-instruct
   RETRIEVAL_SERVICE_URL  default http://localhost:8003
   ```
   Add each to both the schema and the explicit `process.env` mapping block (the file maps keys
   manually — a schema-only addition silently reads `undefined`).

2. **Split the interface.** `ModelProvider` currently bundles `generateStructured` + `embed`. Split
   into `GenerationProvider` and `EmbeddingProvider`, keeping `ModelProvider` as a compatibility
   alias so the four existing call sites don't churn. Add `getGenerationProvider()` and
   `getEmbeddingProvider()`; keep `getModelProvider()` delegating to both.

3. **`NimModelProvider`** — OpenAI-compatible `POST {NIM_BASE_URL}/chat/completions`:
   - `Authorization: Bearer ${NIM_API_KEY}`, `temperature: 0`
   - `response_format: { type: "json_object" }`
   - system prompt = `request.system` + the Zod schema rendered as JSON Schema
   - add `zod-to-json-schema` to dependencies

4. **JSON-repair retry — shared by Gemini and NIM.** Extract a `parseStructured` helper:
   - strip ```` ```json ```` fences and leading/trailing prose
   - `JSON.parse` → `schema.parse`
   - on failure, **retry once** with the validation error appended to the prompt
   - fail hard only after the second attempt
   Today a single malformed token throws and kills the whole job (`provider.ts:45`).

5. **`ServiceEmbeddingProvider`** — `POST {RETRIEVAL_SERVICE_URL}/embed`, 8s timeout. Stub it in
   this slice; Slice 1 builds the service. `MockModelProvider.embed` is untouched.

### Tracer
`MODEL_PROVIDER=nim` + a real key returns a schema-valid object through
`generateStructured`; `MODEL_PROVIDER=mock` returns the mock verbatim as before.

### Verify — `scripts/verify-model-provider.ts`
- mock generation returns the `mock` payload unchanged
- mock embedding is 768-dim, unit-norm, and **identical text yields an identical vector**
- repair path: feed the parser ` ```json {...} ``` ` and assert it recovers
- repair path: feed invalid JSON and assert it throws only after the retry
- `getGenerationProvider()` / `getEmbeddingProvider()` resolve independently per env

**Acceptance:** `npm run typecheck` clean; `verify:all` unchanged and green.

---

# Slice 1 — `services/retrieval` (Python, stateless)

**Goal:** a third Python service in the same mould as `ingestion` and `solver` — no DB, no auth,
pure model serving.

**Files:** `services/retrieval/{Dockerfile,requirements.txt,app/main.py}`, `docker-compose.yml`,
`src/lib/model/provider.ts`, `src/app/api/health/route.ts`, `src/lib/db/schema.ts`,
`drizzle/0012_*.sql`, `scripts/reindex-embeddings.ts`

### Work

1. **The service** — FastAPI + uvicorn on **8003**, matching `services/ingestion/app/main.py`:
   ```
   GET  /health   -> {"status":"ok","service":"retrieval","model":...,"dimensions":768}
   POST /embed    -> {"texts": [str], "kind": "passage"|"query"} -> {"embeddings": [[float]], "model", "dimensions"}
   POST /rerank   -> {"query": str, "documents": [str], "top_k": int} -> {"results":[{"index","score"}]}
   ```
   - `requirements.txt`: `fastapi==0.115.6`, `uvicorn[standard]==0.34.0`,
     `sentence-transformers==3.3.1`, `torch` (CPU wheel)
   - embeddings: `BAAI/bge-base-en-v1.5` → **768 dims natively**, so `vector(768)` and the ivfflat
     index need no migration
   - reranking: `CrossEncoder("BAAI/bge-reranker-base")`
   - **bge asymmetry matters** — prefix queries with `"Represent this sentence for searching
     relevant passages: "`, leave passages bare. Getting this wrong quietly degrades recall.
   - load both models once at module import, not per request
   - Dockerfile pre-downloads weights at build time so the container starts warm

2. **`docker-compose.yml`** — add the `retrieval` service with a `/health` healthcheck (copy the
   `ingestion` block), and `RETRIEVAL_SERVICE_URL: http://retrieval:8003` into `&core_environment`.

3. **`/api/health`** — add a third `serviceHealth(...)` probe (`route.ts:29-30`).

4. **`embedding_model` column** on `knowledge_chunks` — `varchar(80)`, nullable, written alongside
   every vector (`"deterministic-mock-v1"` or `"bge-base-en-v1.5"`). Migration `0012`.
   `retrieveSemanticCitations` filters on the **active** model, so a provider switch degrades to
   "no results" instead of silently-wrong cosine rankings across mixed vector spaces.

5. **`worker.ts:131-138`** — batch the embed loop (send up to 32 chunks per call instead of one
   HTTP round-trip per chunk) and write `embedding_model`.

6. **`scripts/reindex-embeddings.ts`** — nulls embeddings for a given model tag and re-enqueues the
   existing `knowledge.embed` job. Makes a provider switch deliberate and auditable.

### Tracer
`docker compose up retrieval` → `/health` returns 768 → `POST /embed` with two texts returns two
768-vectors → the worker backfills a chunk with `embedding_model = "bge-base-en-v1.5"`.

### Verify — `scripts/verify-retrieval-service.ts`
Skips cleanly (exit 0, logged) when `EMBEDDING_PROVIDER=mock`, so `verify:all` stays containerless.
- `/health` reports 768 dimensions
- identical text → identical vector; unrelated text → materially lower cosine
- `/rerank` reorders a deliberately mis-ordered candidate list
- mixed-model guard: a chunk tagged `deterministic-mock-v1` is **excluded** from a
  `bge-base-en-v1.5` query

**Acceptance:** `verify:all` green with no containers; green again with `EMBEDDING_PROVIDER=service`
and the container up.

---

# Slice 2 — Agent 5, retrieval core (rerank + graph expansion)

**Goal:** materially better retrieval, still no synthesis. Deterministic, no LLM.

**Files:** `src/lib/knowledge/query.ts`, `src/lib/knowledge/expand.ts` (new)

### Work

1. **Rerank stage** in `retrieveSemanticCitations` — over-fetch (`limit * 4`), send to
   `/rerank`, keep `top_k`. When `EMBEDDING_PROVIDER=mock`, **skip reranking entirely** and preserve
   today's cosine ordering, so existing assertions hold.

2. **`expandWithGraphContext(projectId, citations)`** (`src/lib/knowledge/expand.ts`) — deterministic,
   no LLM. For each retrieved chunk, walk `edges` from its `source_region_id` to linked entities
   (requirement / evidence / finding / gate / schedule_task), returning a bounded set (cap ~5 per
   chunk). Reuse the `graph/entities.ts` query patterns. Project-scoped throughout.

3. Keep the mandatory metadata filter **before** ranking, exactly as now (`query.ts:38-39`).

### Tracer
A query returns reranked citations, each carrying `graphContext[]`.

### Verify — `scripts/verify-knowledge-rerank-http.ts`
- metadata filter still precedes ranking (a cross-project chunk is never returned)
- with `EMBEDDING_PROVIDER=mock`, ordering is byte-identical to before this slice
- graph expansion returns only same-project entities
- `verify-knowledge-query-http.ts` and `verify-rfi-similar-http.ts` still pass unmodified

---

# Slice 3 — Agent 5, plan + synthesis (the 2 LLM calls)

**Goal:** the cited-answer pipeline, with groundedness enforced in code.

**Files:** `src/lib/knowledge/pipeline.ts` (new),
`src/app/api/projects/[projectId]/knowledge/query/route.ts`

### Work

1. **Planning call** — one structured LLM call:
   ```ts
   z.object({
     documentType: z.string().nullable(),        // routing; null = search all
     subQueries: z.array(z.string()).min(1).max(4)  // decomposition
   })
   ```
   Mock: `{ documentType: null, subQueries: [originalQuery] }` — so mock mode reduces to exactly
   today's single-query behaviour.

2. **Retrieval** — run Slice 2 retrieval per sub-query, union, dedupe by `chunkId`, rerank against
   the *original* query, then graph-expand.

3. **Synthesis call** — one structured LLM call:
   ```ts
   z.object({
     claims: z.array(z.object({
       text: z.string().min(1),
       citations: z.array(z.string().uuid()).min(1)   // sourceRegionIds
     }))
   })
   ```
   Mock: one claim per retrieved chunk citing its own region — today's concatenation behaviour.

4. **Deterministic groundedness filter — the load-bearing part.** Build
   `allowedRegions = new Set(retrieved.map(c => c.sourceRegionId))`. **Drop** (do not throw) any
   claim citing a region outside it. Mirrors `cx/generation.ts:76`, but drops rather than fails
   because a partial cited answer is still useful. Log every drop into the audit payload.

5. **Response shape** — each surviving claim carries `sourceRegionId`, `documentVersionId`,
   `revision`, `contentHash`, `documentTitle` (the `citation()` helper in the compliance route,
   `route.ts:17-31`, is the reference for assembling this). Zero surviving claims → the
   **"no results in scope"** state, `noResults: true`, `answer: null`.

6. **Audit** — write a `knowledge.query.answered` event against the project recording the query,
   model, provider, claim count, and dropped-claim count. Answers are **not** persisted as durable
   entities; queries are stateless, only the event is retained.

7. Keep `enforceAiRateLimit` (`query/route.ts:13`) — it now guards two LLM calls, not zero.

### Tracer
`POST /knowledge/query` returns `{ answer, claims[], noResults }` where every claim carries a valid,
in-scope citation.

### Verify — `scripts/verify-knowledge-synthesis-http.ts`
- **groundedness:** inject a synthesis mock citing a fabricated UUID → assert it is dropped and the
  drop is recorded
- all-claims-fabricated → `noResults: true`, `answer: null`, HTTP 200 (not an error)
- every returned claim carries region ID + revision + content hash
- cross-project regions never appear
- mock mode reproduces the pre-slice concatenation output

---

# Slice 4 — Agent 5, citation-chip UI

**Files:** `src/components/knowledge-search.tsx`, `src/app/knowledge/page.tsx`

- Render each claim with its citation chips (region ID, revision, content hash prefix), deep-linking
  to `/sources/regions`.
- Explicit **"No results in scope"** empty state — not a blank panel.
- Show the RFI-similarity panel (`/knowledge/rfi-similar` already exists and works) labelled
  **advisory**, never auto-answering.
- Mobile-safe at 390×844: no document-level horizontal overflow (the browser acceptance check in
  `verify:all` asserts this).

### Verify
Extend the existing browser acceptance pass — `/knowledge` renders claims, chips, and the empty
state with no console errors.

---

# Slice 5 — Agent 1, semantic candidate discovery

**Goal:** stop requiring a hand-picked `targetSourceRegionId`. This is the actual gap — the current
route (`compliance/checks/route.ts:12-15`) demands both IDs, so the agent finds nothing.

**Files:** `src/lib/compliance/discover.ts` (new),
`src/app/api/projects/[projectId]/compliance/scan/route.ts` (new)

### Work

1. **`discoverCandidateTargets(projectId, requirementId)`**:
   - metadata filter: project + `documentType ∈ {submittal, po, shop_drawing, drawing}`, in SQL,
     before ranking
   - embed the requirement statement, pgvector search the filtered set
   - cross-encoder rerank, keep top N (default 5)
   - returns candidates with full citation metadata

2. **`POST /compliance/scan`** — body `{ requirementIds?: string[], limit?: number }`. Defaults to
   all `reviewState: "accepted"` requirements. Runs discovery, enqueues a durable job per candidate
   pair. Reuses `requireProjectPermission(projectId, "requirement:review")` and
   `enforceAiRateLimit`.

3. **Durable job** (`compliance.check.candidate`) so a bulk scan can't block a request or lose work
   mid-flight. Idempotency key = `compliance-check:{requirementId}:{targetRegionId}`, which also
   prevents duplicate checks across repeated scans.

### Tracer
`POST /compliance/scan` on a project with accepted requirements and ingested submittals produces
candidate pairs and enqueues jobs — no comparison yet.

### Verify — `scripts/verify-compliance-scan-http.ts`
- only `submittal|po|shop_drawing|drawing` regions are ever returned as candidates
- cross-project regions never appear
- re-running the scan creates **no duplicate** checks (idempotency holds)
- a project with zero accepted requirements returns an empty scan, not an error

---

# Slice 6 — Agent 1, LLM verdict + professional narrative

**Goal:** the LLM owns the verdict; determinism is preserved for tests via the mock-supplier pattern.

**Files:** `src/lib/compliance/compare.ts`, `src/lib/compliance/assess.ts` (new),
`src/app/api/projects/[projectId]/compliance/checks/route.ts`, `src/lib/db/schema.ts`,
`drizzle/0013_*.sql`

### Work

1. **Schema** — add to `compliance_checks`:
   - `suggestion_source varchar(20)` — `"deterministic" | "model"`
   - `suggestion_model_version varchar(80)` — nullable
   Without these you cannot distinguish an AI-authored reason from a computed one in the audit
   chain, which is what ADR-019's "always visibly tagged" requires. Every other AI surface already
   records this (`cx_checklists.generationModelVersion`).

2. **`assessCompliance(requirement, target, context)`** (`src/lib/compliance/assess.ts`) — one
   structured LLM call:
   ```ts
   z.object({
     verdict: z.enum(["conforms","deterministic_flag","possible_mismatch",
                      "needs_engineering_judgment","equivalent_by_precedent"]),
     confidence: z.number().min(0).max(1),
     reason: z.string().min(20).max(4000),        // professional engineering register
     groundingRegionIds: z.array(z.string().uuid()).default([])
   })
   ```
   - **`mock` payload = the `compareCompliance(...)` result.** So `MODEL_PROVIDER=mock` returns the
     exact deterministic verdict and `verify-compliance-http.ts` passes **unmodified**, while
     `gemini|nim` gives the LLM full ownership. Same pattern as `cx/generation.ts:69`.
   - prompt carries both exact citations, both document types + hierarchy ranks + revision dates,
     any retrieved standards clauses, and any exact-hash precedent

3. **`compareCompliance` is retained, not deleted.** Two jobs now: supply the mock payload, and get
   recorded into `targetSnapshot.deterministicCrossCheck`. No extra LLM call, no verdict authority —
   free forensics when a demo verdict looks wrong.

4. **`lookup_standard_clause`** — before assessing, retrieve `documentType: "standard"` chunks via
   the Slice 2 stack and pass them as grounding context. Model-returned `groundingRegionIds` are
   **deterministically validated** against the retrieved set; unvalidated → force the verdict down
   to `needs_engineering_judgment` with "no precedent found."

5. **`check_precedent` — unchanged semantics.** Exact normalized-hash equality remains the *only*
   path to `equivalent_by_precedent` (`compare.ts:85`). Semantic precedent matches are attached as
   **advisory context only** and can never change a verdict.

6. **Source conflict** — `hierarchy()` and `sourceConflict` already exist
   (`checks/route.ts:34-37, 78`). Pass them into the prompt and keep them in the snapshot.

7. Finding creation, `reviewState: "proposed"`, and human disposition are **unchanged**. The model
   never creates or closes a finding.

### Tracer
A discovered pair produces a check whose `reason` is professional prose, `suggestion_source =
"model"`, and whose snapshot carries the deterministic cross-check.

### Verify — extend `scripts/verify-compliance-llm-http.ts`
- **`verify-compliance-http.ts` passes unmodified in mock mode** (the critical regression guard)
- `suggestion_source` / `suggestion_model_version` populated correctly per mode
- `deterministicCrossCheck` always present in the snapshot
- a fabricated `groundingRegionId` forces `needs_engineering_judgment`
- semantic-only precedent match **cannot** yield `equivalent_by_precedent`
- no finding is auto-accepted; `reviewState` is always `proposed`

---

# Slice 7 — Agent 1, review-queue UI

**Files:** `src/app/compliance/page.tsx` + components

- "Scan for deviations" trigger wired to `POST /compliance/scan`, with in-flight state.
- **"AI suggestion — needs human review"** badge wherever `suggestion_source = "model"`.
- Clause-vs-line diff panel: requirement citation one side, target the other, each deep-linked.
- Two-source conflict panel when `sourceConflict` is true — document type, hierarchy rank, revision
  date, both sides shown, **never silently resolved**.
- Collapsed "what the deterministic comparator said" row from `deterministicCrossCheck`.

---

# Slice 8 — Agent 4, lively signals + LLM mitigations

**Files:** `src/lib/predictive-risk/clients.ts`, `src/lib/predictive-risk/engine.ts`,
`src/lib/predictive-risk/mitigations.ts` (new)

> Recurring orchestration is **already built** — `registerPollSchedules` (`jobs/scheduler.ts:14-29`)
> registers `risk.poll.all` as a BullMQ repeatable job every `POLL_INTERVAL_MS`, and
> `scripts/worker.ts` calls it on start. The README's "recurring orchestration remains" is stale;
> correct it. No scheduling work is needed.

### Work

1. **Lively synthetic signals** (`clients.ts:16-20`). Today `SyntheticSignalClient` returns
   `probability: 0.1, estimatedDelayHours: 0` for every task forever — against thresholds of
   `0.5`/`8h` it **structurally can never fire**. Replace with:
   ```
   seed  = sha256(taskId + signalType + floor(Date.now() / POLL_INTERVAL_MS))
   prob  = 0.15 + (seed → [0,1)) * 0.70          // straddles the 0.5 threshold
   delay = round((seed' → [0,1)) * 36)           // straddles the 8h threshold
   if (task.isCritical) prob = min(1, prob * 1.15)
   ```
   ~15 lines, **no DB queries**. Deterministic *within* a cycle, varying *across* cycles — so risks
   organically appear, persist, and self-resolve on screen, exercising the dedup, materiality-hash,
   and auto-resolution paths at `engine.ts:73-84` live during a demo.

   Occasionally emit `dataAvailable: false` (~1 cycle in 8) so the **explicit data-unavailable**
   state required by ADR-020 is visible rather than theoretical.

2. **LLM mitigations** (`src/lib/predictive-risk/mitigations.ts`) — replace the 8 hardcoded strings
   (`engine.ts:23-43`):
   ```ts
   z.object({ options: z.array(z.object({
     id: z.string(), label: z.string().max(120), description: z.string().max(600)
   })).min(1).max(3) })
   ```
   - `mock` payload = today's static `mitigations(type)` array → `verify-risk-http.ts` passes
     unmodified
   - prompt carries task name, signal type, probability, delay hours, criticality, deadline breach
   - **only called on material risks** (`engine.ts:81`, after the materiality gate), so cost stays
     bounded to a handful per cycle
   - on model failure, **fall back to the static options** — a mitigation-generation failure must
     never break the poll loop
   - record the model version into the risk's audit payload

3. Advisory boundary unchanged: mitigations are proposals, never applied; the engine still never
   moves a schedule date (`engine.ts:92` already asserts `solverInvoked: false`).

### Tracer
Two consecutive poll cycles produce a material risk with LLM-written mitigations, then clear it —
visible in `/schedule/risks`.

### Verify — extend `scripts/verify-risk-mitigations-http.ts`
- `verify-risk-http.ts` and `verify-risk-autopoll-http.ts` pass **unmodified** in mock mode
- across simulated cycle buckets, signals vary and at least one crosses materiality
- a forced model failure falls back to static options without failing the poll
- `data_unavailable` signals still produce **no** risk
- self-resolution still fires when a risk stops being material

---

# Slice 9 — Wiring, docs, and the full matrix

- `scripts/verify-all.ts`: register `verify:model-provider`, `verify:retrieval-service`,
  `verify:knowledge-rerank-http`, `verify:knowledge-synthesis-http`, `verify:compliance-scan-http`,
  `verify:compliance-llm-http`, `verify:risk-mitigations-http`. Add matching `package.json` scripts.
- `next.config.ts`: no change needed — embeddings run out-of-process, so there is **no**
  `onnxruntime-node` native-module problem.
- `.env.example`: all new vars with safe defaults (`MODEL_PROVIDER=mock`, `EMBEDDING_PROVIDER=mock`).
- `README.md`: correct the stale Agent 4 orchestration claim; update the status table; document the
  three-service run order.
- `docker-compose.yml`: `retrieval` in `depends_on` for `core-api` and `worker`.

### Full-matrix acceptance
1. `MODEL_PROVIDER=mock EMBEDDING_PROVIDER=mock npm run verify:all` — green, **no containers, no
   keys, no network**.
2. `docker compose up` + `MODEL_PROVIDER=gemini EMBEDDING_PROVIDER=service npm run verify:all` — green.
3. Same with `MODEL_PROVIDER=nim`.
4. `npm run typecheck` and `npm run build` clean.

---

## Run order

```bash
docker compose up -d postgres redis minio ingestion solver retrieval
npm run db:migrate
npm run db:seed
npm run worker          # separate terminal — hosts the repeatable poll jobs
npm run dev             # or: npm run build && npm run system:run
```

## Environment reference

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `MODEL_PROVIDER` | `mock` \| `gemini` \| `nim` | `mock` | Generation |
| `EMBEDDING_PROVIDER` | `mock` \| `service` | `mock` | Embeddings |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | — | `gemini-2.5-flash` | Gemini |
| `NIM_BASE_URL` | URL | `https://integrate.api.nvidia.com/v1` | Hosted or self-hosted NIM |
| `NIM_API_KEY` / `NIM_MODEL` | — | `meta/llama-3.3-70b-instruct` | NIM |
| `RETRIEVAL_SERVICE_URL` | URL | `http://localhost:8003` | Python retrieval service |
| `KNOWLEDGE_SIMILARITY_THRESHOLD` | 0–1 | `0.2` | Cosine floor (existing) |
| `AI_RATE_LIMIT` | int | `60` | Per-window AI call cap (existing) |

## Risk register

| Risk | Mitigation |
| --- | --- |
| NIM returns non-JSON | Repair-retry + schema-in-prompt (Slice 0); hard-fail only after retry |
| Mixed embedding spaces silently corrupt ranking | `embedding_model` column + filter on active model (Slice 1) |
| LLM verdicts break the compliance tracer | `compareCompliance` as mock-supplier keeps mock mode byte-identical (Slice 6) |
| Bulk scan floods the LLM | Durable jobs + idempotency keys + `enforceAiRateLimit` (Slice 5) |
| Model fabricates citations | Deterministic groundedness filter; drop claims, force downgrade (Slices 3, 6) |
| Mitigation generation breaks the poll loop | Static-options fallback on any model failure (Slice 8) |
| `sentence-transformers` image is large / slow to start | Pre-download weights at Docker build; healthcheck gates dependents (Slice 1) |
