# Navigation Reconsolidation Ledger

Date: 2026-08-21

This ledger records the complete before-to-after navigation migration. It is the acceptance checklist for the reconsolidation: every original workspace destination is mapped, every route is retained, and no feature is deferred or discarded.

## Starting state

The desktop sidebar exposed 17 destinations simultaneously in three ambiguous groups:

- Control: Overview, Sources, Requirements, Systems, Evidence, Field capture, Readiness
- Deliver: Schedule, Actions, Cx tests, Shipments
- Investigate: Compliance, Knowledge, Graph & timeline, Command center, Changes, Turnover
- Footer: Development mode, Settings & audit, Profile

## Final structure

- Always visible: Control Center, Readiness, Issues & Actions
- Engineering: Documents, Requirements, Systems & Assets, Evidence, Capture Evidence
- Delivery: Schedule, Commissioning Tests, Shipments & Logistics
- Assurance: Compliance, Change Control, Traceability, Turnover & Closeout
- Project Tools: Knowledge Search and Alert Center; both also retain their global header controls
- Capture Evidence: visible under Engineering and retained as a Control Center shortcut
- Footer: Settings and Profile; the environment indicator is compacted into Profile

## Complete route mapping

| # | Original group | Original label | Route | Final label | Final location | Treatment |
|---|---|---|---|---|---|---|
| 1 | Control | Overview | `/` | Control Center | Always visible | Renamed; absorbs the operational command-center summary role |
| 2 | Control | Sources | `/sources` | Documents | Engineering | Renamed and regrouped |
| 3 | Control | Requirements | `/requirements` | Requirements | Engineering | Regrouped |
| 4 | Control | Systems | `/systems` | Systems & Assets | Engineering | Renamed and regrouped |
| 5 | Control | Evidence | `/evidence` | Evidence | Engineering | Regrouped |
| 6 | Control | Field capture | `/field-capture` | Capture Evidence | Engineering; Control Center CTA | Integrated beside Evidence as its field workflow; route retained for online/offline capture |
| 7 | Control | Readiness | `/readiness` | Readiness | Always visible | Promoted |
| 8 | Deliver | Schedule | `/schedule` | Schedule | Delivery | Regrouped and page title simplified |
| 9 | Deliver | Actions | `/actions` | Issues & Actions | Always visible | Renamed and promoted |
| 10 | Deliver | Cx tests | `/cx` | Commissioning Tests | Delivery | Expanded jargon and regrouped |
| 11 | Deliver | Shipments | `/shipments` | Shipments & Logistics | Delivery | Renamed and regrouped |
| 12 | Investigate | Compliance | `/compliance` | Compliance | Assurance | Regrouped |
| 13 | Investigate | Knowledge | `/knowledge` | Knowledge Search | Project Tools; global project search | Kept visibly mapped and integrated with the header search form |
| 14 | Investigate | Graph & timeline | `/graph` | Traceability | Assurance | Renamed around the user outcome |
| 15 | Investigate | Command center | `/command-center` | Alert Center | Project Tools; notification bell | Control Center displays the alert summary; detailed alert triage remains independently visible |
| 16 | Investigate | Changes | `/changes` | Change Control | Assurance | Renamed and regrouped |
| 17 | Investigate | Turnover | `/turnover` | Turnover & Closeout | Assurance | Renamed and regrouped |

## Footer and utility mapping

| Original | Final | Treatment |
|---|---|---|
| Settings & audit (`/settings`) | Settings (`/settings`) | Audit-chain verification remains fully present inside Settings; no capability was split or removed |
| Development mode badge | Development status inside Profile card | Compacted to remove a full navigation row |
| Profile (`/profile`) | Profile (`/profile`) | Retained independently |
| Help (`/help`) | Header help control | Retained independently |
| Project switcher | Sidebar header | Retained independently |

## Validation contract

- `workspaceLinks` remains an explicit 17-route inventory in `src/components/workspace-navigation.tsx`.
- Desktop navigation uses three primary links and four single-level groups. Its default collapsed rail keeps every icon visible; the explicit toggle reveals all labels and the selected state persists locally.
- Mobile navigation mirrors the same hierarchy and includes all three contextual tools.
- Active desktop links expose `aria-current="page"`; every destination remains available in both icon-rail and expanded modes.
- Hovering or focusing the profile exposes a compact identity, provider, access, and project-role summary.
- The brand, toggle, project selector, navigation icons, Settings, and Profile share one centered rail grid. Only the navigation list scrolls; Settings and Profile remain locked to the sidebar bottom.
- No URLs, APIs, stored records, permissions, or feature implementations are removed by this migration.
