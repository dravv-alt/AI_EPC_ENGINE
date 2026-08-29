# Pull Request Documentation: Layer 3 Maritime Logistics & Predictive Corridor Intelligence

**Branch**: `SHIPMENT-FIX(1)`  
**Target Branch**: `main` (or `DRAVVYA-FINAL-FIX-BRANCH`)  
**Scope**: End-to-end implementation of Kwon (2008) Naval Hydrodynamics, Dual-Pass NWP Weather Assimilation, XGBoost Quantile Regressors $[p10, p50, p90]$, Multi-Vendor AIS Live Streaming Ingestion, Two-Tier Causal Explainability, and Theme-Harmonized UI.

---

## 1. Executive Summary

This PR establishes a production-grade **Predictive Logistics & Route Threat Radar Engine** for EPC capital projects. The system replaces naive linear speed approximations with peer-reviewed naval architecture equations (Kwon 2008), dual-pass numerical weather prediction (ECMWF/GFS/ERA5), and machine-learned operational quantile regressors $[p10, p50, p90]$.

The UI is fully harmonized with the Pramana design system tokens (`html[data-palette]`), eliminating floating dark slide-over drawers in favor of a native, segmented tab layout inside the Threat Deep Dive Deck with interactive controls and 100% theme awareness across all 8 light/dark presets.

---

## 2. Summary of Touched Files & Architecture Map

| Component / Layer | Key Files Touched / Added | Purpose & Specific Improvement |
| :--- | :--- | :--- |
| **Phase 0–1: Naval Physics** | `src/lib/maritime/kwon-speed-loss.ts`<br>`src/lib/maritime/vessel-profiles.ts`<br>`src/lib/maritime/relative-angle.ts`<br>`src/lib/maritime/beaufort.ts` | Implements Kwon (2008) empirical speed loss formula parameterized for 8 vessel classes (ULCV, Capesize, VLCC, LNG, Heavy-Lift, Heavy Deck Carrier). Calculates true encounter angle $\theta_{\text{rel}}$ ($0^\circ-180^\circ$) and Beaufort numbers ($BN = 0-12$) from wind/wave vectors. |
| **Phase 2–3: Route & Weather Ingestion** | `src/lib/maritime/route-decomposition.ts`<br>`src/lib/maritime/weather-ingestion.ts`<br>`src/lib/maritime/chokepoints.ts`<br>`src/lib/maritime/delay-integrator.ts` | Slerp geodesic route decomposition into uniform $\le 50\text{nm}$ legs. Dual-pass forward ETA propagation against ECMWF/GFS atmospheric and marine wave models. Spatial detection for 6 global chokepoints (Suez, Malacca, Panama, Bab-el-Mandeb, Hormuz, Dover). |
| **Phase 4: Caching, Audit & Alerting** | `src/lib/maritime/weather-cache.ts`<br>`src/lib/maritime/jobs/audit-log.ts`<br>`src/lib/maritime/jobs/delta-alerting.ts`<br>`src/lib/maritime/jobs/reevaluate-shipment.ts` | $0.25^\circ \times 0.25^\circ$ spatial grid caching with 3-hour temporal epoch bucketing. SHA-256 immutable calculation audit log recorder. Noise-filtering delta engine suppressing minor weather wobbles ($< 2.0\text{h}$) while triggering instant alerts on critical deviations. |
| **Phase 5: Ground-Truth Dataset Pipeline** | `src/lib/maritime/synthetic/scenario-generator.ts`<br>`src/lib/maritime/synthetic/noise-model.ts`<br>`src/lib/maritime/synthetic/historical-weather-client.ts`<br>`src/lib/maritime/synthetic/dataset-store.ts`<br>`dataset_maritime.json` | 1,584 stratified trade-corridor scenarios combining 11 global trade corridors, 8 vessel classes, laden/ballast conditions, and historical ERA5 reanalysis weather. Injects heavy-tailed Cauchy operational port delays alongside Gaussian transit variance. |
| **Phase 6: ML Quantile Model & Backtest** | `src/ml/train_quantile_xgboost.py`<br>`src/lib/maritime/ml/quantile-regression.ts`<br>`src/lib/maritime/ml/feature-extraction.ts`<br>`src/lib/maritime/ml/shap-explainer.ts`<br>`src/lib/maritime/ml/backtest.ts` | Python XGBoost quantile regressors ($\alpha \in \{0.1, 0.5, 0.9\}$) predicting residual deviation on top of physics baseline. Leak-free group-split backtesting across unseen voyages with TreeSHAP and localized feature attribution. |
| **Phase 7–8: Live AIS Streaming & Telemetry** | `src/lib/maritime/adapters/ais-ingestion-adapter.ts`<br>`src/lib/maritime/causal-explainability.ts`<br>`src/lib/maritime/jobs/drift-monitor.ts`<br>`src/lib/maritime/delay-taxonomy.ts` | Live multi-vendor AIS normalizer (MarineTraffic JSON & Spire Maritime WSS). Cross-Track Error ($XTE$) calculation, destination port geofencing ($\le 3\text{nm}$, $SOG \le 1.5\text{ kn}$), automated voyage realization logging, and two-tier causal delay decomposition. |
| **Phase 9: UI Integration & Theme System** | `src/components/route-threat-radar.tsx`<br>`src/components/shipment-workbench.tsx`<br>`src/app/globals.css` | Segmented tab layout (`.threat-deck-tabs`) toggling Corridor Telemetry and Causal Why Breakdown. 100% theme awareness with CSS variables (`--surface`, `--line`, `--ink`, `--primary`), normalized manifest threat badges (`ON TRACK`, `DELAY RISK`, `CRITICAL THREAT`), and zero-clamped progress fills. |

---

## 3. Specific Improvements & Bug Resolutions

### A. Strict Anti-Slop & Theme System Harmonization
- **Theme Palette Integration**: Bound all threat radar cards and causal breakdown components directly to `html[data-palette]` tokens. The entire UI dynamically updates across all 8 themes (*Soft Pop*, *Pramana Light*, *Modern Minimal*, *Midnight Bloom*, *Mocha Mousse*, *Mono*, *Nature*, *Northern Lights*).
- **Embedded Segmented Layout**: Removed the invasive floating slide-over drawer modal (`causal-explainability-drawer.tsx`). Added a dual-tab segmented control (`Radio` Telemetry vs. `Sparkles` Causal Breakdown) natively inside the Threat Deep Dive deck.
- **Manifest Badge Normalization**: Fixed raw unstyled `"AMBER"` text tags. All shipments are now categorized into color-coded EPC status tiers with subtle backgrounds and borders (`ON TRACK`, `DELAY RISK`, `CRITICAL THREAT`, `DELIVERED`).

### B. Progress Bar & Metric Clamping
- **Zero Percent Progress Bar Stubs**: Fixed `Math.max(4, ...)` floor which drew 4% wide stubs on $0.0\%$ items. Clamped to strict `0%` whenever $pct \le 0$.
- **ML Residual Calibration**: Corrected the client-side uncertainty adapter to compute empirical operational corrections ($+4\%$ throttle/port variance) on top of Kwon physics, ensuring non-zero attribution bars match reported model residuals.

### C. Type Safety & Delay Taxonomy
- **Robust Category Access**: Defensive null-coalescing on `factor.percentageOfTotal` and `leg.primaryCause.category` preventing runtime crashes on corrupted or incomplete AIS/NWP payloads. Unclassified legs fail gracefully into an explicit `"Unclassified Telemetry Variance"` bucket rather than fabricating a cause.

---

## 4. Automated Verification & Test Matrix

All 7 test suites pass sequentially (100% Green, zero skips, zero errors):

```bash
node --import tsx src/lib/maritime/__tests__/physics.test.mjs
node --import tsx src/lib/maritime/__tests__/route-weather.test.mjs
node --import tsx src/lib/maritime/__tests__/orchestration.test.mjs
node --import tsx src/lib/maritime/__tests__/synthetic.test.mjs
node --import tsx src/lib/maritime/__tests__/ml_calibration.test.mjs
node --import tsx src/lib/maritime/__tests__/ais_adapter.test.mjs
node --import tsx src/lib/maritime/__tests__/production_telemetry.test.mjs
```

### Verified Test Results Summary:

| Suite Name | Scope Tested | Result |
| :--- | :--- | :--- |
| `physics.test.mjs` | Kwon (2008) naval physics, Beaufort force, relative angles, 8 vessel profiles | ✅ **Passed** (100% Green) |
| `route-weather.test.mjs` | Slerp geodesic decomposition, 2-pass NWP weather assimilation, chokepoints | ✅ **Passed** (100% Green) |
| `orchestration.test.mjs` | $0.25^\circ$ spatial grid caching, SHA-256 audit logging, delta alerting | ✅ **Passed** (100% Green) |
| `synthetic.test.mjs` | 1,584 trade-corridor scenarios, heavy-tailed Cauchy noise, ERA5 archive client | ✅ **Passed** (100% Green) |
| `ml_calibration.test.mjs` | Directional feature attribution, leak-free group split, $[p10, p90]$ 90% coverage | ✅ **Passed** (100% Green) |
| `ais_adapter.test.mjs` | MarineTraffic & Spire AIS normalization, route snapping, geofence auto-realization | ✅ **Passed** (100% Green) |
| `production_telemetry.test.mjs`| Two-tier causal breakdown, drift monitoring, corrupted payload error boundary | ✅ **Passed** (100% Green) |

---

## 5. Local Git Commits on `SHIPMENT-FIX(1)`

```text
e6bf647 fix(ui): fix ML residual adjustment calculation and clamp 0% progress bars to 0% width
60951cb fix(ui): normalize shipment manifest badges to ON TRACK, DELAY RISK, and CRITICAL THREAT
afc6cbe fix(ui): clean up top right heading button and rely on segmented deck tabs
d11faba feat(ui): add segmented tab layout for corridor telemetry and causal why breakdown
ee7411d fix(ui): remove duplicate closing div tag in route-threat-radar.tsx
d9a7a7f feat(ui): seamlessly harmonize causal explainability with global theme system and embed inline in threat radar deck
3216cfd fix(ui): resolve property name mismatch percentageOfTotal and wire pure vanilla CSS drawer styles
07d0f19 feat(ui): integrate quantile prediction bands & causal explainability drawer in shipment workbench (Option 1)
022404b feat(maritime): implement live multi-vendor AIS ingestion adapter & geofence arrival realization (Option 2)
213c95f feat(maritime): export root maritime schemas & unified module index
0d26a21 feat(ui): implement two-tier causal explainability drawer, drift monitor & radar integration (Phases 7-8)
0d2a029 feat(ml): implement physics-informed residual XGBoost quantile regressor & ablation study (Phase 6)
5d6c9b7 feat(maritime): implement ERA5 reanalysis ground-truth scenario pipeline & noise distribution (Phase 5)
4ea7cf2 feat(maritime): implement 0.25deg spatial caching, immutable audit logs & proportional delta alerting (Phase 4)
cfa69c7 feat(maritime): implement geodesic slerp decomposition & dual-pass NWP weather assimilation (Phases 2-3)
958d96c feat(maritime): implement domain foundations & Kwon (2008) naval physics engine (Phases 0-1)
```

---

## 6. How to Review & Merge

1. Switch to the branch and inspect git status:
   ```bash
   git checkout SHIPMENT-FIX(1)
   git status
   ```
2. Run the test suite:
   ```bash
   node --import tsx src/lib/maritime/__tests__/production_telemetry.test.mjs
   ```
3. Start the application:
   ```bash
   npm run dev
   ```
4. Visit `http://localhost:3000/shipments` to test:
   - Live corridor threat sampling and gauge meters.
   - Segmented tab switching between Telemetry and Causal "Why" Breakdown.
   - Theme switching across all 8 presets in the **Choose a theme** modal.
