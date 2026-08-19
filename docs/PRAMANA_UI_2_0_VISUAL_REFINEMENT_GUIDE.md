Haan bhai — **README + `Demo_images` ke current UI screenshots dekh liye**. Project visually bad nahi hai; actually base identity kaafi solid hai: dark green sidebar, warm off-white canvas, serif display typography, restrained orange/red/green status accents. CSS bhi explicitly `#2d463e` primary green, `#fdfbf7` paper, `#efede8` canvas, IBM Plex Serif + Hanken Grotesk + JetBrains Mono use karta hai. **Yeh identity retain karni chahiye.** ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/src/app/globals.css))

Problem kuch aur hai:

> **Almost every page looks like the same white-card workbench with different text inside it.**

Overview, Graph, Readiness, Schedule, Risk, Cx, Compliance, Sources, Command Center, Turnover — functionally different hain, but visual grammar bahut similar ho jaata hai. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20222626.png?raw=true))

And that is exactly where refinement ka biggest opportunity hai.

# 1. Don't redesign the brand. Build **Pramana UI 2.0** around it

Current design ko modern SaaS blue/purple gradient bana dena mistake hoga.

Keep:

- dark Pramana green
- warm paper background
- serif page titles
- mono provenance/technical metadata
- restrained status colors
- industrial/engineering feel

Change the **hierarchy and components**.

Current CSS has several secondary/meta elements around 9–10px, while primary body content is usually 11–13px. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/src/app/globals.css)) On your screenshots, information becomes visibly tiny once a page gets dense. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20223002.png?raw=true))

I'd establish:

```text id="1kj2n8"
Display title       42–48px
Section heading     22–26px
Card heading        16–18px
Primary body        14px
Table/control       13–14px
Metadata            11–12px
Technical/hash      10–11px only
```

That alone will make the application feel significantly more finished.

---

# 2. Give EVERY major page a different visual identity

This is probably the **single biggest visual change I would make**.

Right now:

```text id="j1p7mf"
PAGE
 ↓
Heading
 ↓
White card
White card
White card
 ↓
forms/tables
```

Instead:

```text id="t89i2k"
OVERVIEW       → Control room
GRAPH          → Spatial network
READINESS      → Gate progression
SCHEDULE       → Timeline
RISKS          → Risk landscape
SHIPMENTS      → Geospatial operations
CX             → Execution workflow
COMPLIANCE     → Comparison workspace
SOURCES        → Document library
COMMAND CENTER → Event stream
TURNOVER       → Handover manifest
```

Same design system.

**Different information visualization.**

---

# 3. Overview → proper **Project Control Room**

Current Overview is already one of the better pages: KPI cards, gate progress, evidence donuts, finding severity, delivery pulse. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20222626.png?raw=true))

But I'd change the top section to this:

```text id="miuv3u"
MUMBAI DC-07                                       19 AUG • LIVE

┌──────────────────────────────────────────────────────────────┐
│ PROJECT STATE                                                │
│                                                              │
│  L5 FIRE SUPPRESSION                   ⛔ BLOCKED             │
│  Commissioning Readiness               67%                   │
│                                                              │
│  Primary blocker                                             │
│  Missing accepted proof for requirement REQ-184              │
│                                                              │
│  [View blocker]                     [Open My Work →]          │
└──────────────────────────────────────────────────────────────┘

 Readiness        Evidence       Open Work       Schedule
    67%             24/31           7             +3d
  ↑ +8%             +4 today       2 high        At risk
```

Basically **one dominant decision block**, then metrics.

Right now all four metric cards have equal visual importance. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20222626.png?raw=true))

They shouldn't.

The user should know within ~3 seconds:

> **What is wrong? What matters most? What do I do?**

---

# 4. Graph & Timeline → turn it into an ACTUAL visual graph

This is one of the biggest missed visual opportunities.

Current Graph screen is essentially a searchable grid of entity cards + relation panel. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20222803.png?raw=true))

You already have typed edges in the product model. The README explicitly describes the graph as the authority graph connecting assets, gates, requirements, evidence and audit context. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE))

Render it visually:

```text id="q1fy82"
                 ┌───────────────┐
                 │    GATE L4    │
                 │   IN REVIEW   │
                 └──────┬────────┘
                        │ requires
             ┌──────────┴──────────┐
             │                     │
             ▼                     ▼
      ┌────────────┐        ┌────────────┐
      │ REQ-184    │        │ REQ-203    │
      └─────┬──────┘        └──────┬─────┘
            │ proven by             │
         ┌──┴──┐                    ▼
         ▼     ▼               ⚠ Missing
       EV-23  EV-29

            │
            ▼

          ASSET
        CHWP-02
```

Then:

- pan/zoom
- minimap
- node filtering
- type colors
- faded irrelevant relations
- hover edge explanation
- select node → right drawer
- “Trace to source”
- “Trace to gate”
- “Show impact path”

**Backend doesn't need changing.**

This is almost entirely a new visualization over existing graph data.

This could become one of the project screenshots people remember.

---

# 5. Schedule → proper engineering Gantt

Current schedule display is extremely restrained: horizontal bars with task labels and one AI explanation box. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20222934.png?raw=true))

Make it substantially richer:

```text id="ukyus3"
                 AUG 12      AUG 16       AUG 20       AUG 24
                    │           │             │
TODAY ──────────────┼───────────┼─────────────┼──────────

CHWP Install      ███████████████
                            ▲
                         DELAY +4D

Pre-functional          ░░░░████████
                                   ↘

L3 Execution                    ████████
                                CRITICAL

L4 IST                              █████████████
                                     ⚠ resource risk

Turnover                                           ◆
```

Add:

- **Today line**
- milestones `◆`
- critical path highlighting
- baseline as translucent/outline/ghost bar
- current plan as solid bar
- risk icons
- shipment dependency icon
- gate markers
- zoom Day / Week / Month
- collapse system groups
- hover task inspector

You already have immutable schedule versions and schedule assignments according to the README's data model. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE))

So even **Baseline vs Current** can be an extremely strong UI visualization without touching scheduler authority.

And later your Recovery Simulator can naturally slot into this:

```text id="zc0uhh"
BASELINE       ░░░░░░░░
CURRENT          █████████
SCENARIO A        ─────────
SCENARIO B       ───────
```

That would look fantastic.

---

# 6. Risk page → stop using a giant wall of cards

This screenshot is the page I'd change most aggressively. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20223002.png?raw=true))

Currently it becomes:

```text id="stad0i"
Risk card
Risk card
Risk card

text
text
text

buttons
textarea
```

Lots of cognitive load.

Instead:

### Risk Intelligence

```text id="5pz4tz"
                  IMPACT
            LOW    MED     HIGH
        ┌───────┬───────┬────────┐
 HIGH   │       │ R-14  │ R-21   │
 P      ├───────┼───────┼────────┤
 R MED  │ R-31  │ R-18  │        │
 O      ├───────┼───────┼────────┤
 B LOW  │       │       │        │
        └───────┴───────┴────────┘
```

Below:

```text id="snjojk"
ACTIVE RISKS
────────────────────────────────────────────────────────

● Procurement delay        CHWP-02       72%      +120h
● Workforce availability   L4 IST        68%       +24h
● Weather                  Delivery      37%        +2h
```

Click one → right detail drawer.

Massively easier to scan.

---

# 7. Keep Shipments visually special

Your shipment screen is currently probably the **strongest distinctive page** because map + weather makes it immediately different from every other screen. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20223035.png?raw=true))

Don't card-ify it further.

I'd go:

```text id="mxx5ry"
┌──────────────────────────────────────────────┬──────────────┐
│                                              │ CHWP-02      │
│                                              │              │
│                  MAP                         │ AquaFlow     │
│                                              │ IN TRANSIT   │
│                                              │              │
│       Shanghai ───────●──────→ Mumbai        │ ETA 7 Aug    │
│                                              │ -2h change   │
│                                              │              │
│                                              │ ● Factory    │
│                                              │ ● Vessel     │
│                                              │ ● Customs    │
│                                              │ ○ Site       │
└──────────────────────────────────────────────┴──────────────┘

 [Route] [Weather] [Congestion] [Risk]
```

Instead of **route map beside separate weather map**, consider one primary map and turn weather/congestion/risk into map layers.

Cleaner.

And much more control-room-like.

---

# 8. Cx Tests → visual commissioning sequence

Current screen feels more like an admin form:

> ingest standards → select system → select gate → select equipment → generate. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20223152.png?raw=true))

Change the presentation to a workflow:

```text id="honis4"
01 STANDARD
   ASHRAE 90.1
      │
      ▼
02 CHECKLIST
   12 cited steps
      │
      ▼
03 EXECUTION
   8 / 12 complete
      │
      ▼
04 REVIEW
   2 awaiting engineer
      │
      ▼
05 EVIDENCE
   Pending acceptance
```

Then when running a test:

```text id="zye53f"
STEP 04 OF 12

Verify chilled-water flow

┌─────────────────────────────────────┐
│ Requirement                         │
│ ≥ 450 LPM                           │
│                                     │
│ Source                              │
│ ASHRAE ... Page 32                  │
└─────────────────────────────────────┘

Measured
┌─────────────┐
│ 462 LPM     │           ✓ PASS
└─────────────┘

[Previous]                        [Next]
```

This will feel like an **actual commissioning tool**, not a database UI.

---

# 9. Compliance → make it a side-by-side comparison workspace

Current compliance screen has a lot of unused horizontal space and form controls. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20223231.png?raw=true))

This is begging for:

```text id="22ikfn"
ACCEPTED REQUIREMENT                  CONTROLLED CLAUSE

CHW pumps shall maintain              Primary and standby CHW
design flow of 450 LPM...             pumps shall maintain...

450 LPM                               425 LPM
████████                              ████████
             ▲ DIFFERENCE

                  ↓

       POSSIBLE DEVIATION

       Flow requirement differs
       by 25 LPM.

       Advisory • confidence 0.87

 [Reject proposal]      [Review finding]
```

Add text highlighting:

```text id="xw8z6w"
450 LPM
^^^

425 LPM
^^^
```

No backend change.

Just **present the intelligence properly**.

---

# 10. Sources → turn it into a real Document Library

Current Sources screen is a very clean but basic table. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20223303.png?raw=true))

Add file identity.

```text id="arledv"
DOCUMENTS                                    + Upload

┌──────────────────────────────────────────────┐
│ 📕 CHW Plant Commissioning Procedure         │
│                                              │
│ REV C                CONTROLLED              │
│ 31 Jul 2026          47 citation regions     │
│                                              │
│ Previous: Rev B  →  6 affected regions       │
└──────────────────────────────────────────────┘
```

Click:

```text id="pze2yy"
┌──────────── PDF VIEWER ──────────┬──────────────┐
│                                  │ REVISION     │
│                                  │              │
│         page 14                  │ Rev C        │
│                                  │              │
│      highlighted region          │ Regions 47   │
│                                  │              │
│                                  │ Requirements │
│                                  │ 12 linked    │
└──────────────────────────────────┴──────────────┘
```

This is one of those features that makes the **existing backend suddenly look much more sophisticated**.

---

# 11. Command Center → actual operational event rail

Current event feed + cards works, but again it resembles a feed of large white containers. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20223330.png?raw=true))

I'd redesign as:

```text id="ej5am3"
COMMAND CENTER

ALL 12       CRITICAL 2       WARN 4       RESOLVED 6

TODAY
│
├── 10:32   🔴 SCHEDULE
│           CHWP-02 projected +4d
│           affects L4 IST
│
├── 10:17   🟡 SHIPMENT
│           ETA revised
│
├── 09:42   🟢 EVIDENCE
│           EV-203 accepted
│           Gate readiness 58 → 67%
│
└── 09:12   ⚪ AUDIT
            Requirement revision recorded
```

That's much more natural for event history.

Add filter chips:

`Schedule` `Shipment` `Evidence` `Cx` `Gate` `Compliance`

---

# 12. Turnover → make it feel like you're assembling a controlled package

Current Turnover is basically:

select gate → button → evidence cards. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE/blob/main/Demo_images/Screenshot%202026-07-30%20223414.png?raw=true))

This deserves something much more ceremonial because it is the **final product of the entire system**.

```text id="roq1xi"
                   TURNOVER PACK

                L4 Integrated Systems

                    92% READY
                 █████████████░

──────────────────────────────────────────────────

✓ Gate decision approved
✓ 31 accepted requirements
✓ 28 evidence objects
✓ 12 Cx reports
✓ Compliance review complete
⚠  2 documents pending inclusion

──────────────────────────────────────────────────

PACK CONTENTS

▾ 01 Controlled Requirements           31
▾ 02 Commissioning Reports             12
▾ 03 Evidence                          28
▾ 04 Compliance                         6
▾ 05 Gate Decisions                     4
▾ 06 Audit Manifest                     1

──────────────────────────────────────────────────

SHA-256
cc4c2b...7280ac             VERIFIED ✓

                    [Generate immutable pack]
```

This could become a **killer screenshot** for README/demo.

---

# 13. Add a universal **Record Inspector Drawer**

This is probably my favourite cross-project UI improvement.

Whenever user clicks:

- requirement
- equipment
- gate
- finding
- task
- evidence
- risk
- shipment

don't navigate away immediately.

Open:

```text id="ckz1ie"
                         ┌──────────────────────┐
                         │ CHWP-02              │
                         │ Primary Pump         │
                         │                      │
                         │ OVERVIEW             │
                         │ Status     Accepted  │
                         │ System     CHW       │
                         │ Gate       L4        │
                         │                      │
                         │ EVIDENCE  4          │
                         │ FINDINGS  1          │
                         │ RISKS     2          │
                         │ SHIPMENT  Delivered  │
                         │                      │
                         │ ───────────────────  │
                         │ Relations            │
                         │ Provenance           │
                         │ Audit history        │
                         │                      │
                         │ [Open full record →] │
                         └──────────────────────┘
```

This makes the **entire application feel connected**.

And it can be introduced gradually without changing authority logic.

---

# 14. Collapsible sidebar instead of deleting routes immediately

README describes a huge surface area, and screenshots show the full Control / Deliver / Investigate sidebar. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE))

Don't immediately delete navigation/routes.

Do:

```text id="srw6kl"
▾ CONTROL
   Overview
   Sources
   Requirements
   Systems
   Evidence
   Readiness

▾ DELIVER
   Schedule
   Actions
   Cx
   Shipments

▸ INVESTIGATE

────────────────
⌘  Quick switch
```

Plus **compact sidebar mode**:

```text id="m3vxaq"
P
─
⌂
▣
✓
◫
⚡
```

Hover expands it.

That gives more horizontal room to Graph, Schedule and Maps.

---

# 15. Add a `Cmd/Ctrl + K` command palette

Visually small change.

Perceived polish: huge.

```text id="mu366r"
⌘K  Search Pramana...

> Go to Schedule
> Open L4 Integrated Systems Test
> Find requirement 184
> View active risks
> Open CHWP-02
> Go to Turnover
```

Phase 1 can literally just navigate routes and existing known records.

No new agent needed.

---

# 16. Standardize all status language visually

Right now there are many statuses:

```text id="w9o4t0"
accepted
pending
completed
active
resolved
blocked
approved
in review
not started
cleared
```

Create one shared:

```text id="8alm9v"
<StatusPill status="approved" />
```

with semantics:

```text id="ikw9yj"
POSITIVE
● Accepted
● Approved
● Completed
● Resolved

ATTENTION
● Pending
● In review

DANGER
● Blocked
● Failed
● Critical

NEUTRAL
● Draft
● Not started

INFORMATION
● Active
● Advisory
```

Same shape.

Same colors.

Same iconography.

Everywhere.

Tiny implementation.

**Huge visual consistency improvement.**

---

# 17. Add micro-interactions, but keep them restrained

Not Framer-Motion madness.

Just:

- card hover 1–2px elevation
- drawer slide-in
- status change crossfade
- number count transition
- skeleton loaders
- progress-bar transition
- map marker pulse for active event
- highlighted graph path animation
- table row hover
- toast after controlled actions
- button loading state

And respect:

```css id="8ylfr3"
@media (prefers-reduced-motion: reduce)
```

Industrial UI should feel **responsive**, not flashy.

---

# 18. One cool visual addition: **Project Pulse strip**

Persistent below header:

```text id="dge5c8"
● ONLINE      L5 GATE 67%      ⚠ 2 BLOCKERS      ▲ +3D      4 REVIEWS
```

Same strip across the application.

So whether user goes into Compliance, Shipments, Graph or Sources, they retain project context.

Click each stat → relevant page.

This gives the whole product a common nervous system.

---

# 19. README itself should get a visual upgrade too

Your README correctly explains that Pramana spans the governed lifecycle from controlled sources through evidence, schedule, Cx, compliance and turnover. ([github.com](https://github.com/dravv-alt/AI_EPC_ENGINE)) But for a recruiter/judge, **11 individual screenshots are less powerful than a designed product story**.

I'd eventually make README start like:

```text id="u00c26"
                         PRAMANA CX

         Evidence-backed commissioning intelligence
              for mission-critical EPC delivery

                  [HERO SCREENSHOT]

 Sources → Requirements → Execute → Resolve → Approve → Handover
```

Then **6 hero screenshots only**:

1. Control Room
2. Graph
3. Schedule + Recovery Scenario
4. Commissioning Execution
5. Shipment Intelligence
6. Turnover

Not every page.

And put each screenshot inside the same fake browser/window frame.

Also add one 20–30 sec GIF:

```text id="rpzf7h"
Overview
   ↓
Blocked gate
   ↓
trace blocker
   ↓
open evidence
   ↓
review
   ↓
readiness changes
```

That communicates more than 20 static screenshots.

---

# If I separate these by **production risk**

## 🟢 Almost entirely visual — do these freely

- typography scale
- spacing/token cleanup
- status pill system
- buttons/input styling
- cards/surfaces
- collapsible sidebar
- compact navigation mode
- micro-interactions
- skeleton states
- table styling
- README visual overhaul
- Turnover visualization
- Cx stepper
- Command Center timeline
- Source document cards
- risk list/matrix
- Schedule visual Gantt
- graph renderer using existing edge API

These can mostly leave your authoritative behavior untouched.

## 🟡 Requires reading existing data but shouldn't modify authority

- universal record drawer
- Project Pulse
- baseline/current schedule comparison
- blocker visualization
- linked source preview
- interactive graph traversal
- risk heat map
- route layer toggles

Still quite safe.

## 🔴 Don't mix into the visual-refinement branch

- Work Engine DB changes
- actual schedule state
- Cost Engine
- new gate logic
- automatic evidence linking
- permission changes
- solver mutation
- AI autonomous actions

Those belong in core feature work.

---

## If I were doing the **visual refinement sprint right now**

I wouldn't redesign 27 pages individually.

I'd build **10 reusable UI primitives first**:

```text id="71rmcz"
AppShellV2
PageHeader
ProjectPulse
DecisionStrip
StatusPill
MetricTile
DataTable
DetailsDrawer
Timeline
EntityLink
```

Then convert pages in this order:

```text id="qmknch"
1. Overview
       ↓
2. Graph & Timeline
       ↓
3. Schedule
       ↓
4. Risk
       ↓
5. Command Center
       ↓
6. Cx
       ↓
7. Compliance
       ↓
8. Sources
       ↓
9. Shipments
       ↓
10. Turnover
```

And there is one visual principle I'd enforce across the entire repo:

> **Every page should have one hero interaction/visualization unique to its job.**

Not another card grid.

That, combined with the isolated features we discussed — **Recovery Simulator, Multimodal Evidence, BIM Viewer and Telemetry** — would make the project look *dramatically* more mature without destabilizing the governed production core.