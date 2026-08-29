# Pull Request Documentation: Layer 3 Maritime Logistics, 6-Phase Multimodal Freight Lifecycle & Predictive Corridor Intelligence

**Branch**: `SHIPMENT-FIX(1)`  
**Target Branch**: `main` (or `DRAVVYA-FINAL-FIX-BRANCH`)  
**Scope**: Complete 6-Phase Multimodal Supply Chain Lifecycle, Kwon (2008) Naval Hydrodynamics, Dynamic Corridor Lead-Time Engine, Dual-Pass NWP Weather Assimilation, XGBoost Quantile Regressors $[p10, p50, p90]$, Multi-Vendor AIS Live Streaming Ingestion, Two-Tier Causal Explainability, and Theme-Harmonized Universal Lucide Iconography.

---

## 1. Executive Summary

This PR delivers a production-grade **AI Engineering, Procurement, and Construction (EPC) Logistics Simulation Engine**. The system moves beyond isolated ocean-weather models to simulate the **entire door-to-site capital freight lifecycle** across all 6 real-world operational phases (from factory crating in Hyderabad to final de-stuffing at a Florida data center site).

Key capabilities added:
1. **6-Phase End-to-End Multimodal Supply Chain Pipeline**: Decomposes total pipeline lead time ($\Delta T_{\text{total}} = \sum_{i=1}^6 \Delta t_i$) across Procurement/VGM, Inland Rail/ICEGATE, Origin Port CY Cut-off, Blue-Water Ocean Transit, Destination US CBP Clearance, and Last-Mile Drayage.
2. **Dynamic Corridor Lead-Time Estimator**: Parameterizes distances, railway network factors ($1.35\times$), port dwell benchmarks (World Bank CPPI 2023), and customs regulatory regimes (India ICEGATE, US CBP ACE, EU ATLAS).
3. **Automated Target Planned Arrival & Live ROS Float Buffer**: Target planned arrival is automatically derived from the 6-phase matrix, allowing EPC managers to focus purely on the immutable **Required On-Site (ROS)** deadline.
4. **Naval Physics & ML Uncertainty Fusion**: Kwon (2008) naval hydrodynamics combined with a physics-informed GBDT operational quantile residual $[p10, p50, p90]$ and SHAP feature attributions.
5. **Universal Lucide SVG Iconography**: Unified, theme-harmonized vector icons across all journey date strips, modals, and telemetry decks.

---

## 2. Architecture Map & Touched Modules

| Component / Layer | Key Files | Purpose & Capabilities |
| :--- | :--- | :--- |
| **Multimodal Freight Architecture** | `src/lib/maritime/fcl-corridor-simulator.ts`<br>`src/lib/maritime/dynamic-freight-estimator.ts` | 6-Phase supply chain pipeline, conditional delay modifiers (Monsoon $+3\text{d}$, Hurricane $+4\text{d}$, Diwali $+5\text{d}$, CY Rollover $+7\text{d}$, CBP Exam $+5\text{d}$), and geographic corridor estimator. |
| **Naval Physics & Hydrodynamics** | `src/lib/maritime/kwon-speed-loss.ts`<br>`src/lib/maritime/vessel-profiles.ts`<br>`src/lib/maritime/relative-angle.ts`<br>`src/lib/maritime/beaufort.ts` | Implements Kwon (2008) empirical speed loss formula parameterized for 8 vessel classes. Calculates true encounter angles $\theta_{\text{rel}}$ ($0^\circ-180^\circ$) and Beaufort numbers ($BN = 0-12$). |
| **Route & Weather Ingestion** | `src/lib/maritime/route-decomposition.ts`<br>`src/lib/maritime/weather-ingestion.ts`<br>`src/lib/maritime/chokepoints.ts`<br>`src/lib/maritime/delay-integrator.ts`<br>`src/lib/weather/route-threats.ts` | Geodesic route decomposition ($\le 50\text{nm}$ legs), dual-pass forward NWP assimilation (ECMWF/GFS/ERA5), spatial chokepoint queuing, and continuous aerodynamic wind/convective rain delay formulation. |
| **Caching, Audit & Drift Monitoring** | `src/lib/maritime/weather-cache.ts`<br>`src/lib/maritime/jobs/audit-log.ts`<br>`src/lib/maritime/jobs/delta-alerting.ts`<br>`src/lib/maritime/jobs/drift-monitor.ts` | $0.25^\circ \times 0.25^\circ$ spatial grid caching with 3h temporal epoch bucketing. SHA-256 calculation audit logs and production prediction drift tracking ($MAE_{\text{physics}}$ vs $MAE_{\text{ML}}$). |
| **ML Quantile Models & Causal Explainability** | `src/lib/maritime/ml/quantile-regression.ts`<br>`src/lib/maritime/ml/shap-explainer.ts`<br>`src/lib/maritime/causal-explainability.ts`<br>`src/lib/maritime/delay-taxonomy.ts` | Two-tier causal delay waterfall: (1) 6-Phase End-to-End Multimodal Accumulation, (2) Deep-Ocean Hydrodynamic & ML Operational Feature Attribution with $[p10, p50, p90]$ quantile bands. |
| **UI Integration & Universal Icons** | `src/components/route-threat-radar.tsx`<br>`src/components/shipment-workbench.tsx`<br>`src/app/globals.css` | Native segmented deck tabs, live schedule editor with auto-computed planned ETA, live EPC float buffer calculation, and universal `lucide-react` SVG iconography. |

---

## 3. Detailed Mathematical & Operational Formulations

### A. 6-Phase End-to-End Supply Chain Lead Time
$$\Delta T_{\text{total}} = \underbrace{\Delta t_{\text{Phase 1}}}_{\text{Procurement/VGM}} + \underbrace{\Delta t_{\text{Phase 2}}}_{\text{Inland Rail/ICEGATE}} + \underbrace{\Delta t_{\text{Phase 3}}}_{\text{Origin CY Cut-off}} + \underbrace{\Delta t_{\text{Phase 4}}}_{\text{Kwon Physics + ML Residual}} + \underbrace{\Delta t_{\text{Phase 5}}}_{\text{Destination US CBP}} + \underbrace{\Delta t_{\text{Phase 6}}}_{\text{Last-Mile Drayage}}$$

1. **Phase 1: Procurement, Export Packaging & Booking** ($72\text{h} / 3\text{d}$ baseline): ASTM D3951 heavy crating, SOLAS VGM weighbridge certification, forwarder container booking lock.
2. **Phase 2: Inland Rail Haulage & ICEGATE Customs** ($168\text{h} / 7\text{d}$ baseline): $709\text{ km}$ rail corridor (Sanathnagar ICD $\rightarrow$ JNPT), CONCOR flatbed marshaling, ICEGATE Let Export Order (LEO) clearance.
3. **Phase 3: Origin Port Operations & Strict CY Cut-off** ($96\text{h} / 4\text{d}$ baseline): World Bank CPPI terminal dwell, strict 48h carrier CY cutoff deadline, gantry crane stowage.
4. **Phase 4: Blue-Water Ocean Voyage (~9,317 nm)** ($576\text{h} / 24\text{d}$ baseline): Kwon (2008) wave diffraction pitch + windage drag + Suez convoy navigation + GBDT operational residual.
5. **Phase 5: Destination Port & US CBP Clearance** ($96\text{h} / 4\text{d}$ baseline): Quayside discharge, ISF-10 automated matching, Form 7501 ACE entry, VACIS non-intrusive gamma scan.
6. **Phase 6: Last-Mile Florida Drayage & De-Stuffing** ($72\text{h} / 3\text{d}$ baseline): Highway heavy-haul drayage, site rigging/uncrating, empty container depot return within 3–5d free detention.

---

## 4. Known Weaknesses & Production Edge-Cases of the Newly Added Module

While the 6-phase multimodal engine is a major leap in capital freight simulation, the following **known limitations and edge cases** should be noted for future iterative refinement:

1. **Railway Topology Winding Approximation**:
   - *Current Design*: Inland rail distances use great-circle geodesic distances scaled by an empirical $1.35\times$ railway track tortuosity coefficient.
   - *Limitation*: Does not perform exact OpenRailwayMap graph pathfinding for dynamic junction routing or rail siding bottlenecks.
2. **Static Port Cut-Off Rules (48h Standard)**:
   - *Current Design*: Employs the industry-standard 48-hour Container Yard (CY) Cut-off before vessel berthing.
   - *Limitation*: Certain transshipment megahubs (e.g. Singapore PSA, Shanghai Yangshan) enforce dynamic 24h to 36h cutoffs depending on ocean carrier alliance agreements (2M, Ocean Alliance, THE Alliance).
3. **Single Regulatory Track per Jurisdiction**:
   - *Current Design*: Models standard commercial import entries (e.g. US CBP Form 7501 ACE Entry, India ICEGATE Shipping Bill, EU ATLAS T1).
   - *Limitation*: Does not model specialized In-Bond transits (e.g. US CBP Form 7512 IT/T&E), Foreign Trade Zones (FTZ), or bonded free-trade warehousing exemptions where customs is deferred to the site.
4. **Deterministic Physical Inspection Triggering**:
   - *Current Design*: Intensive customs examinations (e.g., CBP Intensive Physical Exam hold $+5\text{d}$) are triggered deterministically via scenario flags.
   - *Limitation*: In live production, customs examinations follow a stochastic Bernoulli random process conditioned on shipper historical compliance scoring and HS code risk weighting.
5. **Open-Meteo Spatial Mesh Resolution ($0.25^\circ \times 0.25^\circ$)**:
   - *Current Design*: Grid caching and weather sampling operate on a $0.25^\circ$ (~28 km) grid.
   - *Limitation*: Micro-scale convective marine squalls ($< 5\text{ km}$) can be slightly smoothed out compared to high-resolution coastal radar doppler.

---

## 5. Automated Verification & Test Matrix

All 4 test suites pass sequentially (100% Green, zero errors):

```bash
node --import tsx src/lib/maritime/__tests__/dynamic_freight_estimator.test.mjs
node --import tsx src/lib/maritime/__tests__/fcl_corridor_simulator.test.mjs
node --import tsx src/lib/maritime/__tests__/production_telemetry.test.mjs
node --import tsx src/lib/maritime/__tests__/ml_calibration.test.mjs
```

### Verified Test Results:

| Test Suite | Scope Covered | Status |
| :--- | :--- | :--- |
| `dynamic_freight_estimator.test.mjs` | Corridor differentiation, 44d Hyderabad $\rightarrow$ Florida FCL, regional customs (EU/USA), heavy transformer rigging | ✅ **Passed** (100% Green) |
| `fcl_corridor_simulator.test.mjs` | 45-day algorithmic target, Indian Monsoon $+3\text{d}$, Hurricane $+4\text{d}$, CY Rollover $+7\text{d}$, CBP Exam $+5\text{d}$, LCL $+10\text{d}$ | ✅ **Passed** (100% Green) |
| `production_telemetry.test.mjs` | Two-tier causal delay decomposition, drift tracking ($MAE_{\text{physics}}$ vs $MAE_{\text{ML}}$), incomplete payload fallback | ✅ **Passed** (100% Green) |
| `ml_calibration.test.mjs` | Directional feature attribution, leak-free group split, $[p10, p90]$ quantile coverage | ✅ **Passed** (100% Green) |

---

## 6. Git Commits on `SHIPMENT-FIX(1)`

```text
e341f24 style(icons): replace action button and workbench manual entry emojis with universal Lucide SVG icons
8c1576d style(icons): standardize UI on universal Lucide SVG icon system across journey date strip, schedule editor and causal breakdown
614782e fix(radar): hoist dynamicEstimate hook before leadTimeHours to eliminate ReferenceError
feed3df feat(ui): replace manual planned ETA input with engine auto-calculated Target Planned Arrival and live ROS float preview
d0abe8d feat(estimator): build dynamic multimodal corridor lead-time estimator with geographic, port dwell & customs regime differentiation
a4ff238 fix(weather): replace static 12h thunderstorm constant with continuous aerodynamic & convective delay formulation
beda1b2 feat(causal): integrate 6-phase end-to-end multimodal delay waterfall and accumulation engine into threat radar
863914f feat(maritime): add dynamic multi-phase freight lifecycle matrix to threat radar and flagship corridor preset to workbench
6ddb413 feat(maritime): add interactive schedule date editor and departure/ETA/ROS persistence to threat radar
cf1e6e7 feat(maritime): implement FCL data center equipment freight architecture matrix & simulation engine
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
