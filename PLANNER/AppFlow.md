# Pramana Cx Application Flow

## Primary User Flows

### Flow: Create Project and Configure Access
**Entry point:** Project List
1. The administrator opens `Create Project` and enters project name, code, timezone, and retention policy.
2. The app validates required fields and checks the project code for duplicates.
3. The administrator creates the project and lands on `Project Settings`.
4. The administrator invites members and assigns project roles.
5. The app records membership changes and shows the `Project Dashboard`.
**Exit point:** Project Dashboard with configured members.

```mermaid
flowchart TD
  A([Entry: Project List]) --> B[Create Project]
  B --> C{Valid project details?}
  C -- No --> D[Validation error]
  D --> B
  C -- Yes --> E[Project Settings]
  E --> F[Invite Members]
  F --> G{Invitation accepted by service?}
  G -- No --> H[Pending invitation / retry]
  H --> F
  G -- Yes --> I([Exit: Project Dashboard])
  E --> J{Session valid?}
  J -- No --> K([Exit: Login])
```

### Flow: Ingest and Review Requirements
**Entry point:** Project Dashboard
1. A reviewer opens `Source Library` and selects `Upload Source`.
2. The app validates file type, size, project membership, and revision metadata.
3. The upload enters `Processing Status` while the source is stored and extracted.
4. The reviewer opens `Requirement Review Queue` and selects a proposal.
5. The reviewer accepts, edits, or rejects the proposal with its source citation visible.
6. Accepted requirements appear in `Requirement Detail` and can be related to systems, assets, gates, and evidence.
**Exit point:** Accepted requirement available to the readiness engine, or rejected proposal retained for audit.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Source Library]
  B --> C[Upload Source]
  C --> D{File and revision valid?}
  D -- No --> E[Upload validation error]
  E --> C
  D -- Yes --> F[Processing Status]
  F --> G{Processing completed?}
  G -- No --> H[Pending / retry / failed status]
  H --> F
  G -- Yes --> I[Requirement Review Queue]
  I --> J[Requirement Detail]
  J --> K{Reviewer decision}
  K -- Accept --> L([Exit: Accepted Requirement])
  K -- Edit --> M[Edited Proposal]
  M --> J
  K -- Reject --> N([Exit: Rejected Proposal])
  J --> O{Session expired?}
  O -- Yes --> P([Exit: Login])
```

### Flow: Review Gate Readiness and Resolve Blockers
**Entry point:** Project Dashboard
1. The commissioning manager opens `Readiness Board` and selects a system and gate.
2. The app loads the current rules version and displays `READY`, `BLOCKED`, `IN_REVIEW`, or `UNKNOWN`.
3. The manager opens a blocker to view `Evidence Detail`, source citations, related assets, and owner.
4. The manager creates or updates an action in `Finding Detail` and assigns an owner and due date.
5. The owner uploads evidence or records a test result through `Field Capture` or `Test Run Detail`.
6. The readiness engine recalculates after processing and shows the changed blocker set.
7. The manager may also open the gate's linked `Schedule & Critical Path Board` context panel to see whether a feeding critical-path task is delayed; this is informational only and never changes the readiness state shown in step 2.
**Exit point:** The gate is ready for approval, or remains visibly blocked with assigned actions.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Readiness Board]
  B --> C[Select System and Gate]
  C --> D{Readiness state}
  D -- Ready --> E[Gate Review]
  D -- Blocked --> F[Blocker Detail]
  D -- In Review --> G[Review Queue]
  D -- Unknown --> H[Missing Source / Configuration]
  F --> I[Finding Detail]
  I --> J[Assign Owner and Due Date]
  J --> K[Field Capture or Test Run Detail]
  K --> L{Evidence processed?}
  L -- No --> M[Pending sync / processing]
  M --> K
  L -- Yes --> B
  C --> S[Schedule Status Panel on Gate View]
  S --> B
  E --> N{Approver authorized?}
  N -- No --> O([Exit: Await authorized approver])
  N -- Yes --> P([Exit: Gate ready for decision])
  H --> Q([Exit: Configuration action required])
```

### Flow: Approve or Reject a Gate
**Entry point:** Gate Review
1. The approver opens `Gate Review` and verifies the readiness explanation and evidence baseline.
2. The app checks the approver's project role and TOTP-enabled session.
3. The approver selects approve, reject, or waive and enters a reason.
4. The app stores the evidence baseline, rule version, actor, and decision timestamp.
5. The app updates the gate status and sends the user to `Decision History`.
**Exit point:** Recorded decision with an immutable audit event.

```mermaid
flowchart TD
  A([Entry: Gate Review]) --> B{Authorized session?}
  B -- No --> C[Login / TOTP]
  C --> B
  B -- Yes --> D{Current blockers absent?}
  D -- No --> E([Exit: Cannot approve; blockers shown])
  D -- Yes --> F[Decision Form]
  F --> G{Action selected?}
  G -- None --> H[Validation error]
  H --> F
  G -- Approve / Reject / Waive --> I[Save Decision]
  I --> J{Save succeeded?}
  J -- No --> K[Conflict or retry error]
  K --> F
  J -- Yes --> L([Exit: Decision History])
```

### Flow: Capture Evidence Offline and Sync
**Entry point:** Field Capture
1. The field engineer opens `Field Capture` and selects an asset or gate.
2. The engineer records a photo, observation, measurement, or test result.
3. The app validates required fields and stores the item as `Pending Sync` when offline.
4. When connectivity returns, the app uploads the item and shows `Processing`.
5. The server validates the source and assigns `Accepted`, `Rejected`, or `Needs Review`.
**Exit point:** Evidence is visible with an explicit server-confirmed state.

```mermaid
flowchart TD
  A([Entry: Field Capture]) --> B[Select Asset or Gate]
  B --> C[Record Evidence]
  C --> D{Required fields valid?}
  D -- No --> E[Validation error]
  E --> C
  D -- Yes --> F{Network available?}
  F -- No --> G[Pending Sync]
  G --> H{Connection restored?}
  H -- No --> G
  H -- Yes --> I[Upload and Processing]
  F -- Yes --> I
  I --> J{Server validation}
  J -- Accepted --> K([Exit: Accepted Evidence])
  J -- Rejected --> L([Exit: Rejected Evidence])
  J -- Needs review --> M([Exit: Review Queue])
```

### Flow: Export Turnover Evidence Pack
**Entry point:** Project Dashboard
1. The operations-readiness lead opens `Exports` and selects a system and gate.
2. The app previews included accepted evidence, decisions, audit history, and source references.
3. The user requests an export and the app creates an `Export Job`.
4. The exporter builds the pack and hash manifest from a versioned evidence baseline.
5. The user downloads the pack through a short-lived signed URL or retries a failed job.
**Exit point:** Downloadable pack with manifest hash and verification metadata.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Exports]
  B --> C[Select System and Gate]
  C --> D[Export Preview]
  D --> E{Scope valid?}
  E -- No --> F[Scope validation error]
  F --> C
  E -- Yes --> G[Export Job]
  G --> H{Export completed?}
  H -- No --> I[Retry / failed job details]
  I --> G
  H -- Yes --> J[Manifest Verification]
  J --> K([Exit: Download Evidence Pack])
```

### Flow: Generate Baseline Schedule (US-09)
**Entry point:** Project Dashboard
1. The project scheduler opens `Schedule Baseline Setup` and selects `Upload Schedule Source`.
2. The scheduler uploads vendor contracts, mobilization timelines, purchase orders, and government approval documents.
3. The app validates file type, size, and project membership, then queues an extraction job shown as `Extraction Processing Status`.
4. The extraction job proposes task records (name, duration, dependencies, vendor, lead time, resource requirement, deadline type) and resource-capacity records (crew/equipment counts), each with confidence and a source-region citation.
5. The scheduler opens `Task Record Review Queue`; ambiguous or missing fields are flagged and cannot be auto-accepted.
6. The scheduler accepts, edits, or rejects each proposed record in `Task Record Detail`.
7. Once the scheduler confirms the accepted record set is a complete DAG, the app runs `Dependency Graph Validation`; a detected cycle blocks solving with a clear error.
8. The scheduler triggers `Baseline Solve Job`; the CP-SAT solver computes a feasible schedule respecting precedence, single-mode durations, resource capacity, and deadlines.
9. The app stores the result as immutable `Schedule Version v1` and opens the `Schedule & Critical Path Board` with the critical path highlighted.
**Exit point:** Baseline schedule version v1 available on the Schedule & Critical Path Board, cross-linked into the typed-edges graph.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Schedule Baseline Setup]
  B --> C[Upload Schedule Source]
  C --> D{File and membership valid?}
  D -- No --> E[Upload validation error]
  E --> C
  D -- Yes --> F[Extraction Processing Status]
  F --> G{Extraction completed?}
  G -- No --> H[Pending / retry / failed status]
  H --> F
  G -- Yes --> I[Task Record Review Queue]
  I --> J[Task Record Detail]
  J --> K{Field ambiguous or missing?}
  K -- Yes --> L[Flagged for mandatory review]
  L --> J
  K -- No --> M{Reviewer decision}
  M -- Accept --> N[Accepted Task Record]
  M -- Edit --> J
  M -- Reject --> O[Rejected Task Record]
  N --> P[Dependency Graph Validation]
  O --> P
  P --> Q{Cycle detected?}
  Q -- Yes --> R([Exit: Cycle error; solve blocked])
  Q -- No --> S[Baseline Solve Job]
  S --> T{Solver completed?}
  T -- No / timeout --> U[SOLVE_FAILED state]
  U --> S
  T -- Yes --> V[Schedule Version v1]
  V --> W([Exit: Schedule and Critical Path Board])
```

### Flow: Review Proposed Task and Resource Records
**Entry point:** Task Record Review Queue
1. The reviewer opens `Task Record Review Queue` and filters by document, vendor, or confidence level.
2. The reviewer selects a proposed record and opens `Task Record Detail`, viewing the extracted fields, confidence score, and exact source-region citation.
3. Fields the extractor marked ambiguous or missing are visually flagged and block a one-click accept.
4. The reviewer accepts the record as-is, edits a field before accepting, or rejects it with a reason.
5. The app records the reviewer's decision, actor, and timestamp for audit.
**Exit point:** Accepted record available to the baseline or re-solve pipeline; rejected record retained for audit and excluded from solving.

```mermaid
flowchart TD
  A([Entry: Task Record Review Queue]) --> B[Filter by document / vendor / confidence]
  B --> C[Task Record Detail]
  C --> D{Field flagged ambiguous or missing?}
  D -- Yes --> E[Manual field resolution required]
  E --> C
  D -- No --> F{Reviewer decision}
  F -- Accept --> G([Exit: Accepted Task Record])
  F -- Edit --> H[Edited Record]
  H --> C
  F -- Reject --> I([Exit: Rejected Task Record])
  C --> J{Session expired?}
  J -- Yes --> K([Exit: Login])
```

### Flow: Event-Triggered Rescheduling (US-10)
**Entry point:** Schedule & Critical Path Board
1. A user or integration opens `Event Log / Trigger Entry` and logs a shipment delay, approval granted/rejected, or weather-delay event against a task.
2. The app validates the event against the current schedule version and referenced task.
3. The `Delta Detector` evaluates whether the event affects the critical path or a downstream dependency.
4. If it does not, the app updates only the task's actual status/date and returns to the `Schedule & Critical Path Board`; no new schedule version is created.
5. If it does, the app triggers a `Re-solve Job`; the CP-SAT solver is warm-started with completed tasks held fixed.
6. On success, the app stores a new immutable `Schedule Version vN` and updates the `Schedule & Critical Path Board`.
7. If the deadline is infeasible, the solver still returns a complete schedule and the board shows the minimum overrun and bottleneck constraint explicitly.
8. The app generates a `Re-solve Explainer` describing the triggering event, shifted tasks, and net deadline impact.
**Exit point:** Updated schedule version (or unchanged status-only update) visible on the Schedule & Critical Path Board, with an explainer available for any re-solve.

```mermaid
flowchart TD
  A([Entry: Schedule and Critical Path Board]) --> B[Event Log / Trigger Entry]
  B --> C{Event references valid task in current version?}
  C -- No --> D([Exit: Explicit error; event rejected])
  C -- Yes --> E[Delta Detector]
  E --> F{Critical path or downstream dependency affected?}
  F -- No --> G[Update task status/date only]
  G --> H([Exit: Schedule and Critical Path Board unchanged version])
  F -- Yes --> I[Re-solve Job - warm start]
  I --> J{Solver completed?}
  J -- No / timeout --> K[SOLVE_FAILED state]
  K --> I
  J -- Yes, feasible --> L[Schedule Version vN]
  J -- Yes, infeasible deadline --> M[Schedule Version vN with min overrun and bottleneck shown]
  L --> N[Re-solve Explainer]
  M --> N
  N --> O([Exit: Schedule and Critical Path Board updated])
```

### Flow: View Schedule History and Explainer (US-11)
**Entry point:** Schedule & Critical Path Board
1. The owner's representative opens `Schedule Version History` from the Schedule & Critical Path Board.
2. The user browses prior `Schedule Version` entries, each timestamped and immutable.
3. The user selects a version to open its `Re-solve Explainer`, showing the triggering event, tasks whose dates shifted, and the net deadline impact, clearly labelled as AI-generated.
4. The user may optionally compare two versions in a `Schedule Version Diff` view.
**Exit point:** User understands what changed and why, without any schedule date being altered by the explanation.

```mermaid
flowchart TD
  A([Entry: Schedule and Critical Path Board]) --> B[Schedule Version History]
  B --> C[Select Schedule Version]
  C --> D[Re-solve Explainer]
  D --> E{Compare with another version?}
  E -- Yes --> F[Schedule Version Diff]
  F --> B
  E -- No --> G([Exit: Explainer reviewed])
  B --> H{Session expired?}
  H -- Yes --> I([Exit: Login])
```

## Edge Cases in Flow

- Any authenticated screen redirects to `Login` after session expiry and returns the user to the original route after reauthentication.
- A `403` response shows an access-denied state and does not reveal whether an inaccessible record exists.
- Network failures preserve unsent field evidence locally as `Pending Sync`; authoritative readiness never changes from a local-only capture.
- Concurrent edits show a conflict state and require reload before a review or decision can be saved.
- Empty projects show setup tasks and `UNKNOWN` readiness, never `READY`.
- Failed jobs expose a retry action and job identifier; retries are idempotent.

### Schedule Module Edge Cases

- Unauthenticated or unauthorized access to `Schedule Baseline Setup`, `Task Record Review Queue`, `Schedule & Critical Path Board`, `Event Log / Trigger Entry`, or `Re-solve Explainer` redirects to `Login` or shows an access-denied state without revealing record existence.
- A network failure, validation error, or API timeout during upload, extraction, or event logging shows a retryable error and preserves the prior valid state; retries are idempotent.
- A solver timeout on either the baseline solve or a re-solve enters an explicit `SOLVE_FAILED` state with a retry action and job identifier; the prior schedule version remains untouched until a retry succeeds.
- Session expiry mid-flow (e.g., mid-review in the `Task Record Review Queue` or mid-event-entry) redirects to `Login` and returns the user to the same screen and unsaved-safe state after reauthentication.
- An infeasible deadline after a re-solve never fails silently: the solver returns a complete schedule with the minimum unavoidable overrun and the bottleneck constraint identified, surfaced directly on the `Schedule & Critical Path Board` and in the `Re-solve Explainer`.
- An ambiguous or missing extracted field (task or resource-capacity) is flagged in the `Task Record Review Queue` and blocks one-click auto-accept; the reviewer must resolve or explicitly reject it.
- A dependency cycle detected among accepted task records blocks the CP-SAT solve at `Dependency Graph Validation` with a clear, human-actionable error rather than silently dropping an edge.
- Two events logged concurrently against the same task are serialized through the delta-detector/solve pipeline; the second event's re-solve runs against the already-updated schedule state rather than racing the first.
- An event reported against a task that no longer exists in the current schedule version is rejected with an explicit error and never silently ignored or misapplied.
- A Gemini API extraction or explanation failure/timeout leaves the prior schedule version and status untouched and surfaces a retryable error rather than a partially-applied schedule.
- Schedule delay or critical-path status shown in the `Schedule Status Panel` on the gate view never alters the deterministic `READY`/`BLOCKED`/`IN_REVIEW`/`UNKNOWN` computation.

## Navigation Map

- `Login`
- `Project List`
  - `Create Project`
  - `Project Dashboard`
    - `Project Settings`
    - `Source Library`
      - `Upload Source`
      - `Processing Status`
      - `Requirement Review Queue`
        - `Requirement Detail`
    - `Readiness Board`
      - `Gate Review`
        - `Schedule Status Panel` (linked schedule/critical-path context, read-only)
      - `Blocker Detail`
        - `Finding Detail`
      - `Evidence Detail`
      - `Test Run Detail`
    - `Field Capture`
    - `Schedule Baseline Setup`
      - `Upload Schedule Source`
      - `Extraction Processing Status`
      - `Task Record Review Queue`
        - `Task Record Detail`
      - `Dependency Graph Validation`
      - `Baseline Solve Job`
    - `Schedule & Critical Path Board`
      - `Event Log / Trigger Entry`
      - `Re-solve Job Status`
      - `Schedule Version History`
        - `Re-solve Explainer`
        - `Schedule Version Diff`
    - `Exports`
      - `Export Preview`
      - `Export Job`
      - `Manifest Verification`
    - `Decision History`
