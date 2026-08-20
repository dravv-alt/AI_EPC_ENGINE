# UI Reskin Ledger

Date: 2026-08-21

## Scope

This is a presentation-only refurbishment. No route, API endpoint, database schema, permission check, state transition, form submission, polling interval, or data source was changed.

## Shared system applied across the application

- Swappable display and body font tokens, with `Numero`/`Geist` fallbacks.
- Warm neutral background, deep-teal primary accent, muted amber secondary accent, and accessible status colors.
- Luminous butter-to-peach-to-teal ambient gradient drawn from the supplied visual reference, with selective lime, peach, and dark spotlight summary cards. Those accents are reserved for information grouping; gate and alert states still use explicit labels and status treatment.
- Glass-panel treatment for shared cards, forms, tables, shell controls, mobile navigation, and status pills.
- Rounded, high-contrast primary actions and layered glass secondary controls.
- Improved table row density, input focus states, hover states, responsive spacing, and disclosure surfaces.
- Full-screen glass treatments for credentials login, Clerk sign-in/pending screens, offline, and 404 routes.

## Control Center changes

- Current gate and current blocker are now the primary decision block.
- Supporting readiness, evidence, work, and alert metrics remain immediately below it.
- The six-tile direct-controls strip was removed from the dashboard only; all underlying actions remain available through their original routes and page-header actions.
- The requirement review and owned-work queue are the next priority row.
- The decorative gate circles were replaced by a factual state-and-detail gate path.
- The 7-day activity chart and lower operational modules are retained under an explicit **Operational detail** disclosure to avoid an endless default scroll.

## Alert Center changes

- Active alerts are shown first as the primary triage surface.
- Cleared alerts are retained in a disclosure for traceability.
- The live event feed is a stable, scroll-contained side panel rather than an additional page-length stream.

## Shared primitives

`src/components/ui/glass.tsx` adds reusable `GlassCard`, `Pill`, `IconButton`, `PrimaryButton`, and `StatCard` components for incremental reuse without replacing working feature components.

## Verification

- `npm run typecheck` passes.
- `npm run build` passes.
- All existing dynamic page routes are included in the production build output.
