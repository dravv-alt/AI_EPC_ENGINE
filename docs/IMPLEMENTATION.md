# Pramana Cx — UI 2.0 + Feature Implementation Specification

> **Purpose:** This is the direct-code execution specification for refining the existing `dravv-alt/AI_EPC_ENGINE` repository.  
> It is not a mockup brief, not a Stitch prompt, and not a product brainstorming document.  
> Every task below is written so that it can be handed to a coding model **one task at a time** and implemented directly against the existing application.

**Repository:** https://github.com/dravv-alt/AI_EPC_ENGINE  
**Primary target branch:** `main` unless a task explicitly says to inspect another branch as a donor/reference.  
**Product:** Pramana Cx  
**Current stack:** Next.js 16, React 19, TypeScript, PostgreSQL/Drizzle, Redis/BullMQ, React-Leaflet, Three.js, existing FastAPI ingestion/solver/retrieval services.

---

# 0. What this document controls

This document defines the target implementation for:

1. Global Pramana UI 2.0 visual system.
2. Overview / Project Control Room.
3. Graph & Timeline.
4. Readiness & Gate Decisions.
5. Schedule / Engineering Gantt.
6. Predictive Risk.
7. Shipment Intelligence.
8. Commissioning Tests.
9. Compliance.
10. Controlled Sources.
11. Command Center.
12. Turnover.
13. Universal Record Inspector.
14. Collapsible sidebar.
15. `Cmd/Ctrl + K` command palette.
16. Project Pulse.
17. Requirements refinement.
18. Systems refinement.
19. Evidence refinement.
20. Field Capture refinement.
21. Actions / Findings refinement.
22. Knowledge refinement.
23. Changes refinement.
24. Settings/Profile consistency pass.
25. Recovery / What-If Simulator.
26. Multimodal Evidence Intelligence.
27. BIM / IFC Viewer.
28. Telemetry / Digital Commissioning sidecar.
29. Final integration, responsiveness, accessibility, and README screenshots.

The current application already contains real domain behavior. The goal is **not** to create visual replicas with dead controls. Every visible control introduced by this specification must either:

- execute a real existing action;
- navigate to a real existing destination;
- change a real local visualization state;
- open real data already loaded into the page;
- or be visibly disabled with an explicit reason when the required backend capability does not yet exist.

**There must be no decorative fake functionality.**

---

# 1. Non-negotiable product contract

Pramana is a governed EPC commissioning application.

The current product already follows these authority boundaries:

- AI can extract, retrieve, rank, draft, summarize, and explain.
- Deterministic services own readiness calculation, schedule solving, and deterministic Cx verdicts.
- Human review owns requirement acceptance, evidence acceptance, compliance disposition, Cx approval, finding lifecycle decisions, and gate decisions.
- Predictive risk does not directly alter schedule dates.
- Turnover is generated from approved/accepted governed state.
- PostgreSQL remains the business authority.
- Existing project/RBAC scoping remains the security boundary.

## Implementation rule

**UI refinement must not silently convert advisory data into authoritative state.**

For example:

Bad:

```text
Risk detected
→ UI automatically clicks "Apply mitigation"
→ schedule changes
```

Correct:

```text
Risk detected
→ risk is visualized
→ mitigation is shown
→ user reviews it
→ any schedule change remains a separate governed action
```

Likewise:

```text
Vision model sees gauge = 4.8 bar
```

does **not** mean:

```text
Evidence accepted = true
```

It means:

```text
Suggested extracted observation = 4.8 bar
→ human can review/use it
```

---

# 2. Execution protocol for coding models

Every task in this document is intentionally bounded.

When implementing one task:

1. Work only on the requested task plus shared primitives that are strictly required by it.
2. Inspect the current implementation before replacing JSX.
3. Preserve current route behavior and deep links.
4. Reuse existing server queries, API routes, domain types, and mutations.
5. Do not replace real data with mocked data to make the redesign easier.
6. Do not delete currently working actions merely because they do not fit the new layout.
7. Move existing controls into the new hierarchy rather than dropping them.
8. Any newly added action must have a real handler before the task is considered complete.
9. Add loading, empty, unavailable, success, and error states for the changed surface.
10. The task is not complete until its responsive layout is usable.
11. The task is not complete if visual design exists but the old functionality is only accessible through hidden or abandoned code.
12. Do not claim a check passed unless it was actually run.

## Required handoff after every task

The implementing model must return:

```text
TASK:
STATUS:

FILES CHANGED:
- ...

FUNCTIONALITY PRESERVED:
- ...

FUNCTIONALITY ADDED:
- ...

VISUAL CHANGES:
- ...

KNOWN LIMITATIONS:
- ...

VALIDATION ACTUALLY RUN:
- ...

MANUAL FLOWS VERIFIED:
1. ...
2. ...
```

---

# 3. Pramana UI 2.0 design system

The visual identity already works. Do not replace it.

## 3.1 Keep

- dark forest-green navigation;
- cream/off-white page canvas;
- paper-like white content surfaces;
- IBM Plex Serif for display/title typography;
- Hanken Grotesk for body/interface copy;
- JetBrains Mono for technical metadata;
- restrained Pramana green;
- restrained amber/orange;
- restrained burgundy/red;
- industrial engineering tone;
- thin borders;
- compact but readable information density.

Existing brand colors should remain the base:

```text
Primary green      #2D463E
Secondary amber    #B5651D
Tertiary burgundy  #583935
Paper              #FDFBF7
```

Do not globally replace these with generic SaaS blue/purple.

## 3.2 Typography target

Do not use 7–9px text for routine operational information.

Target:

| Usage | Size |
| --- | --- |
| Major page title | 40–48px |
| Hero/state title | 24–30px |
| Section title | 20–24px |
| Card/subsection title | 16–18px |
| Primary body | 14px |
| Table/control text | 13–14px |
| Metadata | 11–12px |
| Hash/ID-only technical text | 10–11px |

Mono uppercase labels remain compact, but must stay readable.

## 3.3 Spacing

Use an 8px-derived spacing rhythm:

```text
4  = micro spacing
8  = tight
12 = compact
16 = normal
24 = section internal
32 = section separation
48 = major section separation
```

Do not rely on giant empty areas to create hierarchy.

## 3.4 Surfaces

Use three levels:

### Canvas

Warm application background.

### Working surface

Primary section/table/panel.

### Emphasis surface

Only for the primary decision state or selected context.

Avoid:

- cards nested inside cards inside cards;
- heavy drop shadows;
- glass blur;
- decorative gradients;
- neon;
- over-rounded everything.

## 3.5 Shared status semantics

Create one reusable visual mapping component.

Suggested file:

```text
src/components/ui/status-pill.tsx
```

Suggested API:

```ts
type StatusTone =
  | "positive"
  | "attention"
  | "danger"
  | "neutral"
  | "information";

type StatusPillProps = {
  status: string;
  tone?: StatusTone;
  compact?: boolean;
};
```

Mapping must cover current application values such as:

```text
positive
- accepted
- approved
- completed
- resolved
- cleared

attention
- pending
- proposed
- in review
- waiting

danger
- blocked
- failed
- critical
- overdue

neutral
- draft
- not started
- unavailable

information
- active
- advisory
- processing
```

Do not mutate stored statuses just to fit the component.

## 3.6 Shared interaction rules

Interactive records must have a consistent affordance:

- hover = subtle background/border change;
- selected = visible border + background state;
- keyboard focus = visible outline;
- loading button = spinner + stable width;
- destructive/rejection action = clearly distinct;
- no icon-only button without accessible label/title;
- no status encoded only through color.

## 3.7 Loading

Prefer skeletons that match the final layout.

Avoid showing a blank giant card with “Loading...”.

## 3.8 Empty state

Every redesigned section must answer:

- what is missing;
- why this area is empty if known;
- what the user can do next if they have permission.

## 3.9 Responsive rules

Desktop remains the strongest environment.

### Desktop >= 1280px

Use full visual workbench layouts.

### Tablet 768–1279px

Stack secondary detail panes below or make them drawers.

### Mobile < 768px

Prioritize:

1. current state;
2. selected work item;
3. primary action;
4. compact facts.

Complex graph authoring/Gantt editing can remain desktop-first, but reading must not break.

---

# 4. Shared component architecture

Create shared components only when at least two pages benefit.

Recommended structure:

```text
src/components/ui/
├── status-pill.tsx
├── page-header.tsx
├── metric-tile.tsx
├── decision-strip.tsx
├── details-drawer.tsx
├── entity-link.tsx
├── empty-state.tsx
├── loading-state.tsx
├── segmented-control.tsx
├── progress-bar.tsx
├── timeline.tsx
└── project-pulse.tsx
```

Do not move all existing page logic into this folder.

Feature-specific components remain feature-specific.

Use CSS Modules for substantial feature-specific styling where practical.

Keep `src/app/globals.css` focused on:

- tokens;
- fonts;
- document/body defaults;
- shared app shell;
- common primitive classes.

Do not continue growing it into the only styling file for every page.

---

# TASK 01 — Overview → Project Control Room

## Existing areas to inspect

Likely primary files:

```text
src/app/page.tsx
src/components/dashboard-insights.tsx
src/components/dashboard-shell.tsx
src/components/feature-shell.tsx
src/app/globals.css
```

## Objective

Turn Overview from several equal KPI cards into the main project control room.

The first viewport must answer:

1. What gate/stage matters now?
2. Is the project healthy, at risk, or blocked?
3. Why?
4. What should the user open next?

## Target layout

```text
PAGE HEADER
↓
PROJECT STATE / PRIMARY DECISION STRIP
↓
COMPACT PROJECT METRIC STRIP
↓
GATE PROGRESSION
↓
EVIDENCE HEALTH + FINDINGS HEALTH
↓
DELIVERY PULSE
```

## 01.1 Project header

Use real current project name.

Keep existing brief/upload actions if they currently exist.

Do not move them into an overflow menu unless both remain immediately discoverable.

Header:

```text
COMMISSIONING CONTROL ROOM

Project overview
<current project description/context>         [View brief] [Upload source]
```

## 01.2 Project State strip

Create:

```text
src/components/overview/project-state-strip.tsx
```

Data input should be a presentation-only model derived from already loaded overview/readiness data.

Suggested shape:

```ts
type ProjectStateView = {
  gateId?: string;
  gateName?: string;
  gateStatus?: string;
  readinessPercent?: number;
  primaryBlocker?: {
    type: "requirement" | "finding" | "prerequisite" | "evidence" | "schedule";
    id: string;
    label: string;
    href: string;
  };
};
```

Do not create another authoritative state table.

### Functional behavior

- gate name click → current readiness deep link if available;
- blocker click → exact related record/deep link;
- “View blocker” → exact blocker;
- if no blocker, render “No active blocking condition found” rather than inventing one;
- readiness bar reflects real value;
- status pill uses shared component.

## 01.3 Metric strip

Replace four large same-weight cards with a unified strip.

Metrics:

- readiness;
- accepted evidence;
- open actions/findings;
- active alerts or delivery status.

Each metric must navigate to its corresponding real surface.

No fake deltas such as “+8% this week” unless an actual historical comparison is available.

## 01.4 Gate progression

Create:

```text
src/components/overview/gate-progression.tsx
```

Display gates in order.

States:

- completed/approved;
- active/in review;
- blocked;
- not started.

Clicking a gate must open:

```text
/readiness?gate=<id>
```

or whatever existing deep-link contract is already supported.

Use a horizontal connected progression on desktop.

Use a vertical progression on narrow screens.

## 01.5 Evidence health

Do not use multiple decorative donuts if a single coverage representation communicates better.

Show:

- accepted;
- pending;
- stale/failed;
- missing if actually computable.

Use counts already returned by the overview.

## 01.6 Findings health

Show severity counts as compact rows.

Every row should either:

- filter/navigate to Actions;
- or be non-clickable if no filter route exists.

Do not pretend filtering works.

## 01.7 Delivery pulse

Use existing schedule/delivery information.

If the page only has accepted task count and delayed shipment count, render those accurately.

If baseline vs current schedule dates are available, use a compact baseline/current visual.

Do not calculate new schedule authority in the browser.

## Completion criteria

- [ ] Primary state is the highest visual priority.
- [ ] Every metric is linked or clearly static.
- [ ] Gate progression works.
- [ ] No fabricated historical deltas.
- [ ] Existing View Brief / Upload Source behavior remains.
- [ ] Loading and empty states implemented.
- [ ] Tablet/mobile stack implemented.
- [ ] No existing overview information is silently removed.

---

# TASK 02 — Graph & Timeline → Interactive Authority Graph

## Existing areas

```text
src/app/graph/page.tsx
src/components/graph-workbench.tsx
```

Current screen displays searchable entity cards and a relation inspector.

## Objective

Make the graph itself the primary hero interaction while preserving the current list/search/relationship functionality.

## Dependency

Use React Flow for the interactive graph:

```bash
npm install @xyflow/react
```

Import its base styles according to the library's current package contract.

Do not implement custom pan/zoom physics from scratch.

## Target layout

```text
┌────────────────────────────────────────────────────┬───────────────────────┐
│ GRAPH CANVAS                                       │ SELECTED RECORD       │
│                                                    │                       │
│ gate → requirement → evidence                      │ metadata              │
│ system → asset → evidence                          │ neighbors             │
│ task → risk → alert                                │ documents             │
│                                                    │ audit                 │
│ search / filters / trace mode                      │ actions               │
└────────────────────────────────────────────────────┴───────────────────────┘
```

## 02.1 Graph adapter

Create a pure adapter:

```text
src/components/graph/graph-adapter.ts
```

It must convert existing authoritative entities/edges into React Flow nodes/edges.

No mutation.

Suggested UI node categories:

```text
gate
requirement
evidence
system
asset
finding
schedule_task
risk
shipment
document
source_region
cx
compliance
```

Do not invent categories not present in current records.

## 02.2 Custom node visual

Create:

```text
src/components/graph/authority-node.tsx
```

Node shows:

```text
TYPE
Primary label
Status
optional relation count
```

Selected node becomes visually stronger.

Node colors must stay within Pramana palette.

Do not use rainbow colors for every type.

Differentiate categories using:

- accent border;
- small type label;
- icon;
- shape/status.

## 02.3 Edges

Display existing typed relationship label.

Examples depend on current graph data:

```text
PROVES
AFFECTS
PRECEDES
RELATES_TO
...
```

Do not rename the actual relationship semantics.

Hovering an edge should reveal the full relation label.

## 02.4 Canvas controls

Required:

- pan;
- zoom;
- fit view;
- minimap;
- search;
- entity type filter;
- reset;
- selected-node centering.

## 02.5 Search

Typing must filter/highlight real loaded nodes.

Selecting a search result:

1. clears irrelevant highlight;
2. centers the node;
3. selects it;
4. opens its right inspector.

## 02.6 Trace modes

Add local visualization modes:

```text
Trace to source
Trace to gate
Show direct neighbors
Show impact path
Reset trace
```

### Important

A trace mode must only visualize paths that exist in the loaded graph.

Do not infer edges.

If a requested path is absent:

```text
No connected path exists in the loaded project graph.
```

## 02.7 Right inspector

Preserve current tabs:

- neighbors;
- documents;
- supply where present;
- audit.

Improve layout.

The relation creation form remains available, but move it below the selected-record inspector or behind an explicit “Connect records” action so it does not dominate reading mode.

## 02.8 Timeline mode

Add a `Graph | Timeline` view toggle.

Timeline uses existing audit events for the selected record/project.

Do not generate fake events from `updatedAt`.

Use actual audit/event records only.

## Completion criteria

- [ ] Graph canvas is primary.
- [ ] Search centers selected node.
- [ ] Filters work.
- [ ] Right inspector still provides existing relation data.
- [ ] Creating a relationship still works if currently allowed.
- [ ] Timeline is backed by real audit/event data.
- [ ] No graph data mutation occurs merely by dragging visual nodes.
- [ ] Node positions are local UI state unless explicit layout persistence is added later.

---

# TASK 03 — Readiness & Gate Decisions

## Existing areas

```text
src/app/readiness/page.tsx
src/components/gate-decision-form.tsx
src/components/evidence-entropy-panel.tsx
```

## Objective

Turn the current dense gate record into a clear gate-decision workspace.

## Target structure

```text
GATE NAVIGATOR
↓
GATE STATE HEADER
↓
PROOF COVERAGE
↓
BLOCKERS / PREREQUISITES / SCHEDULE CONTEXT
↓
DECISION HISTORY            AUTHORIZED DECISION PANEL
```

## 03.1 Gate navigator

Show all gates as a compact horizontal/vertical progression.

Click changes selected gate using existing deep-link/query behavior.

Selection must survive refresh through URL state where supported.

## 03.2 Gate state header

Show:

- gate name;
- system/discipline context;
- status;
- readiness %;
- rule version;
- last evaluation timestamp if real.

## 03.3 Proof lanes

Preserve categories:

- accepted proof;
- missing proof;
- pending review;
- stale proof;
- failed proof.

Instead of five equal giant boxes, use a compact summary strip plus detailed list below.

Example:

```text
Accepted  4     Missing 2     Pending 1     Stale 0     Failed 0
```

Clicking a category filters the proof list.

Each proof/requirement row must deep-link to evidence/requirement context.

## 03.4 Blocker summary

Create three blocks:

```text
BLOCKING FINDINGS
PREREQUISITES
SCHEDULE CONTEXT
```

Each item must be clickable if a real destination exists.

“No blocker” states should be explicit and calm.

## 03.5 Decision history

Display actual controlled decisions chronologically.

Each entry:

- decision;
- actor;
- timestamp;
- reason;
- rule/baseline identifier where currently available.

## 03.6 Authorized decision panel

Keep the existing decision mutation exactly functional.

Layout:

```text
Decision
[select]

Reason
[textarea]

[MFA/step-up state if required]

[Record controlled decision]
```

Do not move this action into a hidden overflow menu.

If user lacks permission, show read-only state and explain why action is unavailable.

## Completion criteria

- [ ] Gate selection is easy.
- [ ] Missing proof is immediately obvious.
- [ ] Every blocker points somewhere useful if possible.
- [ ] Decision form remains fully functional.
- [ ] Decision history remains visible.
- [ ] No readiness calculation is moved client-side.
- [ ] URL deep links still select the correct gate.

---

# TASK 04 — Schedule → Engineering Gantt

## Existing areas

```text
src/app/schedule/page.tsx
src/components/schedule-workbench.tsx
```

Current schedule workbench already has tabs such as Inputs & Review, Current Schedule, History & Diff, Event Log.

Keep these conceptual areas.

## Objective

Replace minimalist horizontal bars with a real project Gantt while preserving schedule control workflows.

## 04.1 Current Schedule layout

```text
VERSION HEADER + REBASELINE ACTION
↓
GANTT TOOLBAR
↓
TASK LABEL COLUMN | TIMELINE CANVAS
↓
SELECTED TASK INSPECTOR / AI EXPLANATION
```

## 04.2 Gantt date model

Calculate visual positions from immutable schedule assignments already returned by the server.

Create a pure helper:

```text
src/components/schedule/gantt-layout.ts
```

Functions:

```ts
getTimelineBounds(assignments)
dateToPercent(date, bounds)
durationToPercent(start, end, bounds)
```

This is presentation math only.

## 04.3 Task rows

Each row shows:

```text
Task name
status / critical path
resource if available
```

Timeline shows current assignment bar.

## 04.4 Today marker

Draw a thin vertical line at current date if it falls inside timeline range.

## 04.5 Critical path

Use the backend-provided `critical`/critical-path information.

Do not determine criticality based on bar color or browser heuristics.

## 04.6 Milestones

Zero-duration or milestone records render as diamonds if such records exist.

Do not convert arbitrary tasks into milestones.

## 04.7 Baseline vs current

When two real schedule versions are available:

- baseline/previous = thin ghost/outline bar;
- selected/current = solid bar.

History & Diff should let the user pick two versions and visualize moved tasks.

If current API does not support arbitrary pair comparison, retain existing diff behavior and use its data.

## 04.8 Zoom

Add:

```text
Day
Week
Month
Fit
```

Zoom changes only timeline scale.

## 04.9 Grouping

If system/gate grouping is available from task metadata, support collapsible groups.

Do not create random groups based only on task-name parsing.

## 04.10 Task selection

Clicking a row/bar opens a task inspector.

Show existing:

- task ID/name;
- start/end;
- critical state;
- dependencies;
- resources;
- risk context;
- version provenance.

## 04.11 AI explanation

Current advisory explanation remains visible but becomes a secondary explanatory panel.

Label provider/provenance as currently supported.

## Completion criteria

- [ ] Gantt correctly visualizes schedule assignments.
- [ ] Critical tasks use backend truth.
- [ ] Version/rebaseline functions preserved.
- [ ] History/diff remains functional.
- [ ] Event log remains functional.
- [ ] Tabs are not removed.
- [ ] No drag-to-reschedule unless a governed mutation workflow is explicitly implemented.
- [ ] Clicking a bar does not mutate dates.

---

# TASK 05 — Predictive Risk → Risk Landscape

## Existing area

```text
src/components/predictive-risk-workbench.tsx
```

## Objective

Replace the large wall of mitigation cards with a scan-first risk landscape and selected-risk detail panel.

## 05.1 Page structure

```text
RISK SUMMARY
↓
PROBABILITY × DELAY-IMPACT MATRIX
↓
ACTIVE RISK TABLE
↓
SELECTED RISK DRAWER/PANEL
```

## 05.2 Risk matrix

Use existing numeric fields:

- probability/confidence;
- estimated delay hours.

Do not invent financial impact.

Define display-only bins in one helper:

```ts
probability:
  low    < 0.40
  medium 0.40–0.69
  high   >= 0.70

delay impact:
  low    <= 8h
  medium >8h and <=48h
  high   >48h
```

If current values are stored in percentages rather than decimals, normalize before display.

Document these as UI categorization thresholds, not authority/business logic.

Each risk appears as a marker in one matrix cell.

Click marker → select risk.

## 05.3 Risk table

Columns:

```text
Status
Risk type
Affected task
Probability
Estimated delay
Last update
```

Filters:

```text
Active
Resolved
All
Type
Probability
Delay impact
```

## 05.4 Selected risk panel

Show:

- status;
- source type;
- affected task;
- probability;
- estimated delay;
- source/provenance;
- advisory mitigation options;
- review rationale;
- existing Acknowledge/Dismiss actions.

Do not duplicate mitigation controls on every list item.

## 05.5 Risk actions

Existing actions must continue to execute real review mutations.

After success:

- update selected risk;
- update list status;
- update filters/counts;
- show success feedback.

## Completion criteria

- [ ] All existing risks remain reachable.
- [ ] Review actions still work.
- [ ] Matrix uses real probability/delay.
- [ ] No fake cost/severity score introduced.
- [ ] Resolved items can be viewed.
- [ ] Page is dramatically more scannable than current card wall.

---

# TASK 06 — Shipment Intelligence → Unified Geospatial Operations

## Primary current files

```text
src/app/shipments/page.tsx
src/components/shipment-map-loader.tsx
src/components/shipment-map.tsx
src/components/shipment-workbench.tsx
```

## Branch strategy

**Build from current `main`.**

Use `Updated-Refinement` only as a donor/reference for:

- transport-specific vehicle SVG markers;
- route interpolation;
- position snapping to route;
- endpoint visual treatment.

Do not replace current main with the old branch.

Do not port the separate Windy iframe architecture.

## Existing main capability to preserve

Current main already provides:

- React-Leaflet;
- route polyline;
- origin/destination;
- shipment position;
- weather observations;
- weather threat overlays;
- route/weather refresh;
- roughly 30-second polling;
- provenance notices;
- manual congestion context;
- shipment navigator controls.

## Objective

Replace:

```text
Route map | Weather map
```

with:

```text
ONE MAP
├── Route
├── Shipment position
├── Weather
├── Risk
└── Congestion
```

## 06.1 Component split

Refactor into:

```text
src/components/shipment/
├── unified-shipment-map.tsx
├── layers/
│   ├── route-layer.tsx
│   ├── shipment-position-layer.tsx
│   ├── weather-layer.tsx
│   ├── risk-layer.tsx
│   └── congestion-layer.tsx
├── markers/
│   ├── ship-marker.tsx
│   ├── plane-marker.tsx
│   ├── truck-marker.tsx
│   └── endpoint-marker.tsx
├── map-layer-controls.tsx
├── map-legend.tsx
└── route-utils.ts
```

The exact folder naming may be adjusted, but split the current monolithic map responsibilities.

## 06.2 Layer state

```ts
type ShipmentLayerState = {
  route: boolean;
  weather: boolean;
  risk: boolean;
  congestion: boolean;
};
```

Default:

```text
route       on
weather     on
risk        on
congestion  on when relevant
```

Layer controls must be Pramana-styled controls, not the default Leaflet layer UI.

## 06.3 Route layer

Preserve mode-specific route behavior:

- sea;
- air;
- land.

Keep current safe fallback/provenance behavior.

Route layer displays:

- origin marker;
- destination marker;
- path;
- route provenance where relevant.

## 06.4 Shipment position

Use transport-specific marker.

For simulated/interpolated positions:

- explicitly keep “simulated”/synthetic provenance visible;
- do not label as live AIS.

If safe donor logic exists in `Updated-Refinement`, port its interpolation and snap-to-route utilities after comparing data contracts.

## 06.5 Weather layer

Use current native weather observations.

Each observation:

- geographic marker/circle;
- weather condition;
- wind;
- precipitation;
- update time;
- estimated delay where existing.

No iframe.

## 06.6 Risk layer

Visualize current weather/route threats independently from normal weather observations.

Marker treatment should communicate:

```text
minor
moderate
severe
```

based on existing threat state.

Popup must show the real underlying data.

## 06.7 Congestion layer

Current data includes a shipment-level manual `portCongestion` state.

V1 behavior:

If congestion is true:

- draw a visible but restrained halo around the applicable destination/port;
- show `Congestion reported` in popup/legend;
- retain manual provenance.

Do not fabricate a global congestion heatmap.

Later live port congestion data can replace this without redesigning the layer component.

## 06.8 Right navigator

Keep shipment navigator but compact it.

Selected shipment card shows:

- equipment/shipment label;
- vendor;
- route;
- current provenance;
- ETA;
- weather factor;
- congestion state;
- schedule/risk linkage if already available;
- current actions.

Required existing controls remain:

- date/time adjustment where current;
- congestion toggle where current;
- recalculate;
- assess route;
- complete shipment where current permission allows.

## 06.9 Map fitting

When selected shipment changes:

- fit map bounds to its route;
- do not reset zoom every 30-second poll unless route extent actually changes materially.

## 06.10 Polling

Keep current polling behavior.

Do not replace with WebSockets during this task.

Avoid re-creating the map instance on every poll.

Update layers/data only.

## 06.11 Legend

Legend must explain:

- sea/air/land route;
- simulated vs live position;
- weather;
- risk;
- congestion;
- unavailable data.

## 06.12 Empty state

No coordinates:

```text
This shipment does not yet have sufficient coordinates to render a route.
```

Do not show a blank map and make it look broken.

## Completion criteria

- [ ] One map only.
- [ ] Route toggle works.
- [ ] Weather toggle works.
- [ ] Risk toggle works.
- [ ] Congestion toggle works.
- [ ] Selection fits route.
- [ ] Polling still works.
- [ ] Existing shipment actions still work.
- [ ] No Windy iframe.
- [ ] Synthetic/live provenance remains explicit.
- [ ] Deep link selects correct shipment.

---

# TASK 07 — Cx Tests → Commissioning Execution Workflow

## Existing area

```text
src/app/cx/page.tsx
src/components/cx-workbench.tsx
```

Current screen presents several large forms at once.

## Objective

Convert the Cx workspace into a visible commissioning lifecycle:

```text
1 Standards
→
2 Checklist
→
3 Execution
→
4 Review
→
5 Evidence
```

Do not turn this into a superficial wizard that hides existing capabilities.

## 07.1 Top workflow stepper

Tabs/steps:

```text
Standards
Checklist
Execution
Review
Evidence
```

The active step should derive from user selection/local route state.

Existing records remain accessible regardless of wizard progression.

## 07.2 Standards step

Move current:

- ingest standard;
- title;
- type;
- revision;
- file upload;
- extract;
- controlled standards list

into one coherent screen.

Show standards library beneath upload or in a right/secondary pane.

Clicking a standard selects it and exposes:

- revision;
- extraction status;
- citation-region count;
- open source action.

## 07.3 Checklist step

Use existing generation controls:

- title;
- system;
- gate;
- equipment;
- governing standard versions;
- generate draft.

After generation, immediately display generated cited checklist instead of forcing the user to search for it lower on the page.

## 07.4 Checklist record UI

Each step shows:

```text
Step number
Instruction
Expected value/type
Citation
Review state
```

Click citation → exact source region.

## 07.5 Execution step

Create an operator-first layout:

```text
STEP 04 OF 12
Verify chilled-water flow

Requirement / expected condition
Source citation

Measured value / observation
[control]

Deterministic result
PASS / FAIL / HUMAN REVIEW

[Previous] [Save result] [Next]
```

Use current step/result types.

Numeric and boolean deterministic behavior remains unchanged.

Narrative result remains human-review routed.

## 07.6 Review step

Show submitted test record/report.

Sections:

- passed checks;
- failed checks;
- narrative review;
- resulting findings if existing;
- evidence materialization status.

Existing approval action must remain functional.

## 07.7 Evidence step

Show when/if an approved report generated evidence.

Provide real evidence deep link.

## Completion criteria

- [ ] Standard ingestion still works.
- [ ] Draft generation still works.
- [ ] Citations remain exact.
- [ ] Test recording remains functional.
- [ ] Deterministic verdicts unchanged.
- [ ] Narrative judgment remains human.
- [ ] Report approval still works.
- [ ] Resulting evidence can be reached.

---

# TASK 08 — Compliance → Side-by-Side Comparison Workbench

## Existing area

```text
src/app/compliance/page.tsx
src/components/compliance-workbench.tsx
```

## Objective

Make actual comparison the hero interaction.

## Target layout

```text
SCAN / FILTER BAR

┌──────────────────────────────┬──────────────────────────────┐
│ ACCEPTED REQUIREMENT         │ CONTROLLED TARGET LINE       │
│                              │                              │
│ ...                          │ ...                          │
│ highlighted values           │ highlighted values           │
└──────────────────────────────┴──────────────────────────────┘

COMPARISON RESULT
↓
REVIEW QUEUE
```

## 08.1 Discovery control

Keep existing semantic scan action.

Display operation state:

- idle;
- scanning;
- results found;
- no candidates;
- failed.

## 08.2 Direct comparison controls

Keep:

- accepted requirement selector;
- target controlled line;
- equality precedent;
- Run cited comparison.

Do not hide these.

## 08.3 Comparison hero

After a comparison exists, show the two authoritative text blocks side by side.

Use exact text from existing result/source.

Highlight differences that are explicitly returned by deterministic comparison.

For simple numeric values, highlight normalized mismatch.

Do not invent semantic equivalence highlighting.

## 08.4 Result summary

Display:

- proposal type;
- numeric/boolean/qualitative category;
- confidence if existing;
- proposed deviation;
- citation;
- precedent state.

## 08.5 Review queue

Transform proposals into a compact queue.

Columns:

```text
State
Requirement
Target line/source
Type
Confidence
Created
```

Click opens selected proposal inspector.

All existing review actions remain available.

## Completion criteria

- [ ] Semantic scan still works.
- [ ] Direct cited comparison still works.
- [ ] Exact requirement/source text visible together.
- [ ] Review queue still works.
- [ ] No automatic compliance acceptance introduced.
- [ ] Proposed status remains visibly advisory.

---

# TASK 09 — Controlled Sources → Document Library

## Existing area

```text
src/app/sources/page.tsx
src/components/source-upload-form.tsx
```

## Objective

Make Sources feel like a governed document library, not only a table/upload form.

## 09.1 Main library

Use a polished table/list, not necessarily large cards for every file.

Columns:

```text
Document
Revision
Type if available
Processing status
Citation regions
Last controlled date
Actions
```

Primary row content:

```text
CHW Plant Commissioning Procedure
Rev C
47 citation regions
COMPLETED
```

## 09.2 Selected document panel

Clicking document opens either:

- existing full source route;
- or a side inspector backed by already available document data.

Show:

- title;
- revision;
- immutable/hash context;
- region count;
- previous revisions where currently available;
- linked requirements count only if existing query supports it;
- open first/source region action.

## 09.3 Region access

Existing Page/Region chips remain clickable.

Use a consistent `SourceRegionLink`/`EntityLink`.

## 09.4 Upload

Move upload into a clear top action:

```text
[Upload controlled source]
```

Click opens a panel/drawer or expands upload form.

Fields remain:

- title;
- revision;
- file;
- current supported metadata.

After upload:

- show progress;
- processing state;
- extraction success/error;
- update library without full confusion.

## Completion criteria

- [ ] Current source uploads still work.
- [ ] Existing source-region links work.
- [ ] Revision remains visible.
- [ ] Processing state remains visible.
- [ ] No fake PDF preview is added if object bytes cannot be loaded.
- [ ] Empty/no-source project is handled.

---

# TASK 10 — Command Center → Unified Event Rail

## Existing areas

```text
src/app/command-center/page.tsx
src/components/live-feed.tsx
```

## Objective

Remove duplication between giant alert cards and a separate repetitive feed.

Make one scan-first operational event stream.

## Target layout

```text
STATUS COUNTS / FILTERS
↓
EVENT TIMELINE                      SELECTED EVENT
```

## 10.1 Filter row

Filters:

```text
All
Active
Critical/attention if real
Cleared
Schedule
Shipment
Evidence
Gate
Finding
Compliance
```

Only show category filters represented by actual alert/event types.

## 10.2 Event timeline

Group:

```text
Today
Yesterday
Earlier
```

Each row:

```text
time
event type
human title
status
affected entity
```

Example structure only:

```text
10:32  SCHEDULE  Predicted schedule delay requires review
                  CHWP-02 Mechanical Installation
```

Do not display raw event enum as the primary title.

Keep enum as mono metadata.

## 10.3 Selected event panel

Show:

- full message;
- state;
- timestamp;
- affected entities;
- mitigation/advisory context;
- deep link;
- clear/dismiss/review action if currently available.

## 10.4 Live polling

Keep current live polling behavior.

Update rows without resetting user scroll/selection unnecessarily.

Show actual last-polled time.

## Completion criteria

- [ ] Live updates continue.
- [ ] Existing alerts all appear once.
- [ ] Deep links still route correctly.
- [ ] Cleared alerts are viewable.
- [ ] Selection does not disappear on every poll.
- [ ] Raw enum is secondary metadata.

---

# TASK 11 — Turnover → Handover Manifest Workspace

## Existing area

```text
src/app/turnover/page.tsx
src/components/turnover-actions.tsx
```

## Objective

Make turnover feel like the final controlled output of the entire system.

## 11.1 Gate selection header

Keep gate selector and real approved state.

When gate changes, load/display corresponding turnover eligibility.

## 11.2 Readiness summary

Use real eligibility data.

Example structure:

```text
TURNOVER PACK
L4 Integrated Systems Test

READY FOR PACK / NOT ELIGIBLE
```

Do not show 92% unless such readiness is actually available.

## 11.3 Prerequisite checklist

From available pack/gate data, show only verifiable checks.

Potential categories if current data supports them:

- gate approved;
- accepted evidence;
- Cx reports;
- schedule provenance;
- audit manifest;
- required controlled records.

Do not fabricate counts.

## 11.4 Pack contents

After pack exists, group manifest items by actual type.

Accordion:

```text
Controlled requirements
Evidence
Cx reports
Gate decisions
Schedule provenance
Audit/provenance
```

Only show sections backed by actual manifest fields.

## 11.5 Hash verification

Display:

- canonical hash;
- verification state;
- generated time;
- artifact action if real URL exists.

Long hash can be truncated in primary view with full copy/details control.

## 11.6 Generate pack

Keep existing authority restriction.

If selected gate is not eligible:

- disable;
- display exact reason.

Do not render enabled button that will inevitably fail.

## Completion criteria

- [ ] Eligible approved gate can generate.
- [ ] Ineligible gate clearly explains why.
- [ ] Generated pack contents are inspectable.
- [ ] Hash/provenance visible.
- [ ] Existing independent verification/download path preserved if available.

---

# TASK 12 — Universal Record Inspector Drawer

## Objective

Create one shared interaction language for project records.

Clicking a contextual record should often inspect it without forcing immediate navigation.

## File

```text
src/components/ui/details-drawer.tsx
src/components/records/record-inspector.tsx
```

## V1 architecture

Do **not** create a new universal backend endpoint yet.

Use page-specific adapters from data already loaded on each page.

Example:

```ts
type RecordInspectorModel = {
  type: string;
  id: string;
  title: string;
  status?: string;
  metadata: Array<{ label: string; value: ReactNode }>;
  relations?: InspectorLink[];
  evidence?: InspectorLink[];
  history?: InspectorEvent[];
  actions?: InspectorAction[];
  fullRecordHref?: string;
};
```

## Standard tabs

Only render tabs that have data:

```text
Overview
Relations
Evidence
History
Actions
```

## Behavior

- Escape closes.
- close button.
- focus management.
- desktop right drawer.
- mobile full-width sheet.
- “Open full record” preserves existing deep link.

## Initial integrations

Implement on:

1. Graph;
2. Schedule;
3. Risk;
4. Shipment;
5. Command Center.

Then extend to Requirements/Evidence/Systems.

## Completion criteria

- [ ] No new authority is stored.
- [ ] Drawer is reusable.
- [ ] Empty tabs are hidden.
- [ ] Focus/accessibility correct.
- [ ] Deep links remain available.

---

# TASK 13 — Collapsible Sidebar

## Existing areas

```text
src/components/workspace-navigation.tsx
src/components/mobile-route-menu.tsx
src/components/dashboard-shell.tsx
```

## Objective

Gain horizontal space without deleting existing destinations.

## Desktop states

### Expanded

Existing sections:

```text
CONTROL
DELIVER
INVESTIGATE
...
```

### Collapsed

Icon rail.

Width must collapse consistently.

Show tooltip on icons.

## Group behavior

Sections can collapse independently.

Persist UI preference only if an existing safe client preference mechanism exists; otherwise keep it per-session/local component state.

Do not write layout preference into project DB.

## Active route

Must remain obvious in both modes.

## Mobile

Keep/use dedicated mobile route menu.

Do not attempt to make the icon rail the mobile nav.

## Completion criteria

- [ ] Every current route remains reachable.
- [ ] Collapsed mode usable by keyboard.
- [ ] Active route clear.
- [ ] Main content reflows.
- [ ] Graph/Schedule/Shipment gain width.

---

# TASK 14 — `Cmd/Ctrl + K` Command Palette

## Objective

Add a fast navigation layer without building another AI agent.

## File

```text
src/components/command-palette.tsx
```

## Keyboard

```text
Cmd+K on macOS
Ctrl+K elsewhere
Escape closes
Arrow keys navigate
Enter selects
```

## Phase 1 commands

Static route commands:

```text
Go to Overview
Go to Sources
Go to Requirements
Go to Systems
Go to Evidence
Go to Readiness
Go to Schedule
Go to Actions
Go to Cx
Go to Shipments
Go to Compliance
Go to Knowledge
Go to Graph
Go to Command Center
Go to Changes
Go to Turnover
Go to Settings
```

## Phase 2 record search

Reuse existing project search/knowledge search infrastructure where appropriate.

Do not issue a full semantic RAG query on every keystroke.

Use a debounced lightweight project entity search if already available; otherwise leave Phase 2 until a safe endpoint exists.

## Completion criteria

- [ ] Keyboard opens everywhere inside app shell.
- [ ] Route navigation fully works.
- [ ] No duplicate route definitions: commands derive from shared navigation config.
- [ ] Mobile can open through visible search/quick-switch control.

---

# TASK 15 — Project Pulse

## Objective

Create persistent project context under/within the application header.

## Example

```text
● Connected   L4 67%   2 blockers   5 alerts
```

Only show values available truthfully.

## Data

Do not create duplicate readiness/risk logic.

Factor existing server-side project summary read logic into a reusable read helper if necessary.

Potential data:

- connection status;
- current/selected gate;
- readiness;
- blocker count;
- active alert count.

Do not show “+3 days” globally unless the schedule delta is truly available.

## Actions

Each metric click:

- gate/readiness → Readiness;
- blockers → Readiness/Actions;
- alerts → Command Center.

## Completion criteria

- [ ] Same component across major pages.
- [ ] No duplicated authority calculation.
- [ ] Values update when page/project changes.
- [ ] Narrow width collapses to essentials.

---

# TASK 16 — Micro-interaction and state polish

Implement only after core page layouts are stable.

## Required

- subtle row hover;
- drawer transition;
- progress transitions;
- skeletons;
- button busy state;
- toast/success feedback for mutations;
- map active marker pulse;
- graph trace highlight transition.

## Reduced motion

Respect:

```css
@media (prefers-reduced-motion: reduce) {
  /* remove non-essential transitions/animations */
}
```

## Do not add

- full-page entrance animation;
- bouncing;
- glowing;
- looping decorative animation;
- animated gradients.

---

# TASK 17 — Requirements → Review Workspace Refinement

## Existing areas

```text
src/app/requirements/page.tsx
src/components/requirement-review-actions.tsx
```

## Objective

Make requirement review a source-grounded split workspace.

## Layout

```text
PROPOSAL QUEUE                  SELECTED REQUIREMENT
                               +
                               SOURCE CITATION
```

## Queue

Filters:

```text
Proposed
Accepted
Rejected
All
```

Each row:

- concise requirement;
- source document;
- region/page;
- review state.

## Selected panel

Show:

- proposed statement;
- exact citation;
- source metadata;
- current edited text if applicable;
- Accept/Edit/Reject controls.

If editing exists, edit happens inline with visible original/citation.

## Completion criteria

- [ ] Review actions unchanged.
- [ ] Exact citation always visible during authority-changing review.
- [ ] Deep link to source works.
- [ ] Accepted/rejected history remains accessible.

---

# TASK 18 — Systems → Asset Hierarchy Explorer

## Existing area

```text
src/app/systems/page.tsx
src/components/systems-workbench.tsx
```

## Objective

Show actual system → asset → gate context instead of treating every entity as equal form content.

## Layout

```text
SYSTEM TREE / LIST       SELECTED SYSTEM/ASSET DETAIL
```

System row expands to assets.

Selected entity shows:

- name/type;
- related gate(s);
- evidence/readiness counts if existing;
- shipment/Cx relation if existing;
- actions currently supported.

Do not add fake digital-twin data here; BIM is a separate task.

---

# TASK 19 — Evidence → Capture / Review / Library

## Existing areas

```text
src/app/evidence/page.tsx
src/components/evidence-workbench.tsx
```

## Objective

Separate the three jobs:

```text
Capture
Review
Library
```

## Capture

Current evidence creation/upload fields.

System/asset/gate/requirement context must be visibly confirmed.

Never hide authoritative linkage.

## Review

Queue of pending evidence.

Selected evidence displays:

- artifact;
- metadata;
- requirement statement;
- source citation;
- Accept/link or Reject actions.

**Do not automatically choose the first system or first requirement.**
User must explicitly see/confirm authoritative linkage.

## Library

Accepted/pending/stale/failed evidence searchable/filterable.

## Completion criteria

- [ ] No hidden default authoritative requirement linking.
- [ ] Reviewer sees requirement before acceptance.
- [ ] Existing evidence actions work.
- [ ] Stale/failed state is obvious.

---

# TASK 20 — Field Capture → Mobile-first Capture Flow

## Existing area

```text
src/app/field-capture/page.tsx
src/components/field-capture-workbench.tsx
```

## Objective

Optimize specifically for field use.

## Flow

```text
1 Select context
2 Capture/add artifact
3 Add observation
4 Review offline package
5 Save/sync
```

## Mobile

Large controls.

No tiny multi-column desktop form.

Persistent sync/offline state.

Clearly separate:

- stored locally;
- syncing;
- synced;
- failed.

Do not state “uploaded” until server confirms.

---

# TASK 21 — Actions / Findings → Work Queue

## Existing area

```text
src/app/actions/page.tsx
src/components/actions-workbench.tsx
```

## Objective

Make findings actionable and scannable.

## Main table

```text
Status
Severity
Finding
Owner
Due
Blocks
Updated
```

Filters:

```text
Mine if ownership exists
Open
Overdue
Blocked
Resolved
Severity
```

Selected finding opens shared inspector.

Existing lifecycle mutations:

- assign;
- in progress;
- resolved;
- reopened;

remain where currently supported.

Do not create a second status record.

---

# TASK 22 — Knowledge → Cited Research Workspace

## Existing area

```text
src/app/knowledge/page.tsx
src/components/knowledge-search.tsx
```

## Objective

Make citation grounding visually primary.

## Layout

```text
QUERY / FILTERS
↓
ANSWER
↓
CITED SOURCE REGIONS
```

Desktop selected citation can open source preview/inspector on right.

Every generated factual answer remains tied to citations as current backend requires.

Provider/model/provenance should remain visible but secondary.

Long internal debug metadata stays behind details, not in main answer.

---

# TASK 23 — Changes → Revision Impact Workspace

## Existing areas

```text
src/app/changes/page.tsx
src/components/change-assessment-list.tsx
```

## Objective

Turn source revision changes into an impact narrative.

## Layout

```text
REVISION
Old → New

Affected regions
↓
Affected requirements
↓
Stale evidence
↓
Reopened/affected gates
```

Use actual blast-radius/change-assessment data.

Do not infer impacts not present in the assessment.

Each affected item deep-links to exact context.

---

# TASK 24 — Settings / Profile consistency

Do not redesign security/admin concepts.

Only normalize:

- page header;
- readable forms;
- tabs;
- destructive action treatment;
- save feedback;
- access/member tables;
- audit presentation.

Keep auth/RBAC behavior untouched.

---

# TASK 25 — Recovery / What-If Simulator

This is a new capability and must remain isolated from production schedule authority.

## Objective

Allow the scheduler to copy the current schedule state into a non-authoritative simulation and compare alternative recovery scenarios.

## Core safety rule

```text
CURRENT SCHEDULE
       ↓ READ-ONLY SNAPSHOT
RECOVERY SIMULATOR
       ↓
SCENARIO RESULT
```

The simulator does not directly write:

- schedule assignments;
- dependencies;
- resource constraints;
- approved versions.

## 25.1 Service

Create:

```text
services/recovery/
```

Suggested structure:

```text
services/recovery/
├── app/
│   ├── main.py
│   ├── schemas.py
│   ├── scenarios.py
│   ├── scoring.py
│   └── solver_adapter.py
└── tests/
```

## 25.2 Neutral input contract

```json
{
  "scheduleVersionId": "presentation/reference only",
  "tasks": [
    {
      "id": "task-id",
      "durationHours": 24,
      "dependencies": [],
      "resources": []
    }
  ],
  "baselineAssignments": [],
  "scenario": {
    "type": "delay_injection",
    "targetTaskId": "task-id",
    "delayHours": 72
  }
}
```

Exact fields should reuse current solver contract where possible.

## 25.3 Scenario types V1

Support only defensible transformations:

### Delay injection

```text
shipment/task unavailable for X hours/days
```

### Resource capacity adjustment

```text
resource capacity +N or -N
```

### Fixed-start adjustment

Only where current solver contract supports it.

### Optional resequencing

Only through explicit dependency alternatives supplied by user; never invent removing a real dependency.

## 25.4 Outputs

For each scenario:

- feasible/infeasible;
- resulting makespan;
- completion delta from current;
- critical-path result from the corrected solver;
- changed task dates;
- resource conflicts;
- deadline violations;
- explanation generated deterministically from diff.

Do not show cost savings until a real cost model exists.

## 25.5 UI integration

Add a Schedule action:

```text
[Run recovery scenario]
```

Opens scenario workspace.

Layout:

```text
SCENARIO CONFIG
↓
CURRENT | SCENARIO A | SCENARIO B
↓
GANTT OVERLAY
↓
DIFF SUMMARY
```

## 25.6 No Apply button V1

Use:

```text
Save scenario
Export scenario
Use as reference
```

Do not write current schedule from simulator during V1.

Later a governed “Create reviewed schedule change from scenario” can be separately implemented.

## Completion criteria

- [ ] Service works from fixture JSON independently.
- [ ] Main DB not required for service unit tests.
- [ ] No schedule mutation.
- [ ] Results visually compare against current.
- [ ] Infeasibility is explicit.
- [ ] No invented cost analysis.

---

# TASK 26 — Multimodal Evidence Intelligence

## Objective

Create a standalone evidence-analysis capability that returns suggestions, not authority.

## Service

```text
services/evidence-vision/
```

## Input

```text
image/pdf page
optional asset/system context
optional expected field schema
```

## Output schema

```ts
type EvidenceVisionResult = {
  documentType?: string;
  extractedText: Array<{
    text: string;
    confidence?: number;
    bbox?: [number, number, number, number];
  }>;
  readings: Array<{
    label?: string;
    value: string | number;
    unit?: string;
    confidence?: number;
    bbox?: [number, number, number, number];
  }>;
  equipment?: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
  };
  observations: Array<{
    type: string;
    description: string;
    confidence?: number;
  }>;
  provider: string;
  model: string;
};
```

## UI

Evidence page action:

```text
[Analyze artifact]
```

Result appears in an advisory panel.

User can:

```text
Copy extracted value
Use as draft observation
Dismiss suggestion
```

User cannot:

```text
Accept evidence automatically
```

## Overlay

When bounding boxes exist:

- render them over image preview;
- click extracted field → highlight box.

## Completion criteria

- [ ] Service can run independently on fixture images.
- [ ] Output is structured.
- [ ] Provider provenance shown.
- [ ] Human must still perform real evidence review.
- [ ] No model output directly creates PROVES authority.

---

# TASK 27 — BIM / IFC Viewer

## Objective

Build a standalone 3D model explorer first, then connect it to Pramana records later.

The repo already includes Three.js.

Use the current That Open Components / Fragments ecosystem for IFC loading rather than writing an IFC parser manually.

Expected packages should be evaluated together for compatible versions:

```text
@thatopen/components
@thatopen/fragments
web-ifc
three
```

## New route

```text
/model
```

Initially it may be feature-flagged or Development Mode if desired.

## V1 workflow

```text
Upload IFC
↓
Parse/load
↓
3D viewport
↓
Select element
↓
Metadata panel
```

## Element panel

Show actual IFC properties such as:

- entity/class;
- GlobalId;
- name;
- storey if available;
- property sets available from model.

Do not map to Pramana asset automatically.

## V1 mapping

Provide an explicit local/session mapping UI:

```text
IFC element
↔
Pramana asset
```

Only persist to application DB after a separate authoritative mapping design is approved.

## Viewport

Required:

- orbit;
- pan;
- zoom;
- fit;
- selection highlight;
- isolate;
- show all;
- search by IFC property where feasible.

## Later integration

Once mapping exists:

click BIM element → Record Inspector showing:

- asset;
- readiness;
- evidence;
- findings;
- Cx;
- shipment.

But V1 is successful without production DB mutation.

---

# TASK 28 — Telemetry / Digital Commissioning Sidecar

## Objective

Create a separate telemetry engine that can be developed using synthetic streams.

## Service

```text
services/telemetry/
```

## V1 data contract

```json
{
  "assetExternalId": "CHWP-01",
  "metric": "vibration",
  "value": 7.3,
  "unit": "mm/s",
  "timestamp": "2026-08-19T12:00:00Z",
  "source": "synthetic"
}
```

## Components

```text
Synthetic generator
→ ingestion
→ time-series buffer/store
→ deterministic threshold rules
→ anomaly observations
→ UI
```

## UI route

```text
/telemetry
```

Initially Development Mode is acceptable.

## UI

Selected asset:

```text
current readings
recent history
rule thresholds
detected observations
source provenance
```

Do not automatically fail a Cx test from telemetry.

A later integration can allow:

```text
telemetry observation
→ draft Cx/evidence observation
→ human/governed review
```

## Completion criteria

- [ ] Runs without Pramana production DB.
- [ ] Synthetic source labeled.
- [ ] Deterministic threshold events reproducible.
- [ ] No Cx/evidence authority mutation.

---

# TASK 29 — Final cross-page integration

Only run this task after major page implementations are complete.

## 29.1 Visual consistency pass

Check:

- page headers;
- section labels;
- status pills;
- button hierarchy;
- fields;
- table rows;
- drawer behavior;
- empty states;
- loading states.

## 29.2 Unique hero interaction requirement

Each major page must remain visually distinct:

| Page | Hero interaction |
| --- | --- |
| Overview | Project State / Control Room |
| Graph | Interactive authority graph |
| Readiness | Gate progression + blocker/decision workspace |
| Schedule | Engineering Gantt |
| Risk | Probability × delay landscape |
| Shipments | Unified geospatial map |
| Cx | Commissioning execution workflow |
| Compliance | Side-by-side cited comparison |
| Sources | Controlled document library |
| Command Center | Live event rail |
| Turnover | Handover manifest |

Do not regress everything into generic cards.

## 29.3 Cross-feature continuity

Verify flows:

### Flow A — blocker

```text
Overview
→ primary blocker
→ Readiness exact gate
→ requirement/evidence
```

### Flow B — risk

```text
Command Center
→ exact risk/task
→ Schedule
```

### Flow C — shipment

```text
Command Center
→ exact shipment
→ map fits selected shipment
→ risk/weather context
```

### Flow D — source

```text
Requirement/Cx/Compliance
→ exact citation
→ Sources/source-region context
```

### Flow E — turnover

```text
Readiness approved gate
→ Turnover
→ generate/inspect pack
```

## 29.4 Responsive validation

At minimum manually inspect:

```text
1440px
1024px
768px
390px
```

Priority mobile flows:

- Overview/read current project;
- Evidence review;
- Field capture;
- Action/finding response;
- gate decision review where allowed.

Graph/Schedule/Map may use simplified mobile reading modes.

## 29.5 Accessibility

Check:

- keyboard navigation;
- focus;
- semantic heading order;
- labels;
- status not color-only;
- drawer focus trap/return;
- readable contrast;
- reduced motion;
- clickable area size.

## 29.6 No dead controls audit

Search the changed application manually.

Every button/chip/menu item must be one of:

```text
working
disabled with reason
navigation
local view control
```

There must be no control added only because it looked good in the design.

---

# 30. Suggested implementation order

Use this exact order to minimize rework.

## Stage A — visual primitives

```text
TASK 00  shared tokens/base styles
TASK 13  collapsible sidebar
TASK 16  base loading/status/microinteraction primitives
```

## Stage B — flagship pages

```text
TASK 01  Overview
TASK 02  Graph
TASK 03  Readiness
TASK 04  Schedule
TASK 05  Risk
TASK 06  Shipments
```

## Stage C — governed workflows

```text
TASK 07  Cx
TASK 08  Compliance
TASK 09  Sources
TASK 10  Command Center
TASK 11  Turnover
```

## Stage D — continuity

```text
TASK 12  Record Inspector
TASK 14  Command Palette
TASK 15  Project Pulse
```

## Stage E — secondary surfaces

```text
TASK 17  Requirements
TASK 18  Systems
TASK 19  Evidence
TASK 20  Field Capture
TASK 21  Actions
TASK 22  Knowledge
TASK 23  Changes
TASK 24  Settings/Profile
```

## Stage F — new isolated capabilities

These can be developed in parallel branches because they are intentionally separated.

```text
TASK 25  Recovery Simulator
TASK 26  Multimodal Evidence
TASK 27  BIM Viewer
TASK 28  Telemetry
```

## Stage G

```text
TASK 29  Final integration
```

---

# 31. File-touch guidance

This is not an exhaustive list, but prevents unnecessary repo-wide rewrites.

| Task | Primary existing files |
| --- | --- |
| Overview | `src/app/page.tsx`, `dashboard-insights.tsx` |
| App shell/nav | `dashboard-shell.tsx`, `workspace-navigation.tsx`, `mobile-route-menu.tsx` |
| Graph | `src/app/graph/*`, `graph-workbench.tsx` |
| Readiness | `src/app/readiness/*`, `gate-decision-form.tsx`, `evidence-entropy-panel.tsx` |
| Schedule | `src/app/schedule/*`, `schedule-workbench.tsx` |
| Risk | `predictive-risk-workbench.tsx` |
| Shipments | `src/app/shipments/*`, `shipment-map*.tsx`, `shipment-workbench.tsx` |
| Cx | `src/app/cx/*`, `cx-workbench.tsx` |
| Compliance | `src/app/compliance/*`, `compliance-workbench.tsx` |
| Sources | `src/app/sources/*`, `source-upload-form.tsx` |
| Command Center | `src/app/command-center/*`, `live-feed.tsx` |
| Turnover | `src/app/turnover/*`, `turnover-actions.tsx` |
| Requirements | `src/app/requirements/*`, `requirement-review-actions.tsx` |
| Systems | `src/app/systems/*`, `systems-workbench.tsx` |
| Evidence | `src/app/evidence/*`, `evidence-workbench.tsx` |
| Field Capture | `src/app/field-capture/*`, `field-capture-workbench.tsx` |
| Actions | `src/app/actions/*`, `actions-workbench.tsx` |
| Knowledge | `src/app/knowledge/*`, `knowledge-search.tsx` |
| Changes | `src/app/changes/*`, `change-assessment-list.tsx` |
| Global styles | `src/app/globals.css` |

Do not touch database migrations for a visual-only task unless a real missing product capability explicitly requires schema work.

---

# 32. Functional completeness checklist for every redesigned page

Before a page task can be marked complete:

- [ ] All old data still appears somewhere appropriate.
- [ ] All old valid actions still exist.
- [ ] New buttons have handlers.
- [ ] New filters actually filter.
- [ ] New tabs actually change content.
- [ ] New deep links point to real destinations.
- [ ] Query-param-selected records still select correctly.
- [ ] Loading state exists.
- [ ] Error state exists.
- [ ] Empty state exists.
- [ ] Permission-denied state is clear.
- [ ] Data-unavailable state is different from zero.
- [ ] Synthetic/live/advisory provenance is preserved.
- [ ] Mobile/tablet layout is not broken.
- [ ] No important copy is 8–9px.
- [ ] No fake counts.
- [ ] No fake timestamps.
- [ ] No fake progress.
- [ ] No hidden automatic authority mutation.
- [ ] No existing business logic was duplicated in display components.

---

# 33. Model task prompt template

When giving one task from this document to a coding model, use:

```text
Implement TASK XX from IMPLEMENTATION.md exactly.

Treat IMPLEMENTATION.md as the target UX/functional contract and the current repository code as the source of truth for existing data, permissions, APIs and mutations.

Complete only this task and the minimum shared primitives it requires.

Do not return a mockup or proposed code. Make the changes directly.

Do not remove existing functionality. Every new visible interaction must work.

At the end, report:
- files changed
- functionality preserved
- functionality added
- manual flows verified
- checks actually run
- any limitation caused by missing existing backend data
```

That prompt should be enough because the task itself contains the intended layout, behavior, data limits, and completion criteria.

---

# 34. Final product target

After this implementation, Pramana should no longer feel like:

```text
many technically strong modules
+
many similar white-card screens
+
user manually figuring out how the modules connect
```

It should feel like:

```text
PROJECT CONTROL ROOM
        ↓
PLAN / SCHEDULE
        ↓
EXECUTE / Cx / FIELD
        ↓
DETECT / RISK / COMPLIANCE / SHIPMENT
        ↓
RESOLVE / ACTIONS / EVIDENCE
        ↓
APPROVE / READINESS
        ↓
HANDOVER / TURNOVER
```

while retaining the governed evidence, audit, schedule, review, and authority model that already exists.

The visual refinement is successful only when the interface becomes clearer **without weakening the product's controlled behavior**.

The feature refinement is successful only when each new capability is either safely isolated or explicitly integrated through an existing governed boundary.

