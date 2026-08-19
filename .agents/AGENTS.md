# Project Design & Architecture Principles

## User Preferences & Design Standards (Strict Anti-Slop Enforcement)

1. **Zero Empty/Blank White Space:**
   - Grid layouts must be perfectly balanced across columns with zero awkward empty holes or cut-off heights.
   - Cards in grid rows must equalize heights cleanly line-for-line with rich, contextual data tuples.

2. **Logical Top-Down Information Flow:**
   - **Header / Top:** Immediate decision context & active blocker banners.
   - **Action Layer:** Direct controls & launch toolbars placed near the top for quick actionability.
   - **Main Body:** Primary operational components & connected timelines.
   - **Visual Analytics:** Rich SVG ring charts, color-coded severity bars, live delivery pulse.
   - **Footer Layer:** Historical audit logs, controlled document library with direct upload forms, and system telemetry.

3. **High Visual Density & Rich Aesthetic:**
   - Distinct tone colors for all severity levels (`critical`: `#a91f32`, `high`: `#c84b3d`, `medium`: `#c98431`, `low`: `#5b7a6e`).
   - Animated count-up metrics, smooth SVG donut charts, horizontal connected timelines.
   - Professional typography with crisp serif/sans/mono hierarchies.

4. **100% Preserved Functionality:**
   - Every single feature, button, link, modal trigger, and action handler MUST remain fully functional across refactors.
   - Interactive polish (e.g. collapsible sidebar with `localStorage` memory) should enhance experience without breaking existing contracts.

5. **Responsive Execution:**
   - Every page must render flawlessly across Mobile (< 768px), Tablet (768px - 1024px), and Desktop (>= 1024px).
