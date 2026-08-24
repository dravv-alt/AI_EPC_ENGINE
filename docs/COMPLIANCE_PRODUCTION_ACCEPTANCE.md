# Specification and Quality Compliance: Production Acceptance

## Scope

This release slice covers the problem-statement capability that compares accepted requirements from controlled specifications, standards, and client requirements against controlled procurement and implementation evidence: vendor submittals, purchase orders, shop drawings, and drawings.

The platform is advisory. It can propose a conformity result or deviation and create a proposed finding, but an authorized engineer must record the final disposition.

## Implemented authority controls

- Only accepted requirements may be checked.
- Requirement and target citations must belong to the active project.
- Both citations must come from completed, approved document versions.
- A requirement cannot be compared with its own source document.
- Targets are restricted to `submittal`, `po`, `shop_drawing`, and `drawing` document types.
- A pending requirement-target comparison cannot be duplicated.
- Every stored comparison includes immutable requirement and target snapshots, document revision provenance, source-region hash, selected-excerpt hash, model/provider identity, and deterministic cross-check.
- A deterministic deviation cannot be downgraded by a generative model.
- A qualitative comparison cannot be machine-certified as conforming.
- Accepted precedents require an exact normalized target hash and independent review.
- Proposed checks, proposed findings, and hash-chain audit records commit atomically.
- Final dispositions use optimistic concurrency and require reviewer rationale.

## Deterministic comparison coverage

The comparator supports:

- equality with tolerances;
- minimum and maximum constraints;
- pressure, electrical current, voltage, power, frequency, temperature, percentage, rotation, length, and common flow units;
- Celsius/Fahrenheit and common engineering-unit conversion;
- explicit presence/absence checks;
- exact categorical checks;
- IP enclosure-rating comparisons;
- fail-closed handling of ambiguous multiple measurements, unsupported dimensions, and narrative criteria.

For page-sized PDF extraction regions, the system selects the most relevant exact source fragment before comparing values. The original region remains the citation authority, and both the region content hash and exact excerpt hash are retained.

## Reproducible evaluation

Run the bundled controlled fixture:

```powershell
npm.cmd run verify:compliance-golden
```

The report is written to `output/evaluation/compliance-golden-report.json` and contains:

- exact-verdict accuracy;
- deviation precision, recall, and F1;
- true-positive, false-positive, false-negative, and true-negative counts;
- per-modality totals;
- every failed case;
- deterministic safety assertions.

The bundled set is deliberately labelled `controlled_fixture`. Its score demonstrates regression behavior only and must not be presented as production field accuracy.

Run the authority and QMS invariants:

```powershell
npm.cmd run verify:compliance-authority
npm.cmd run verify:audit
```

## Expert-labelled release dataset

For an actual production accuracy claim, create a JSON file matching [the controlled fixture](../fixtures/compliance-golden-set.json) and set:

```json
"labelSource": "expert_reviewed"
```

Each case must be independently labelled from the exact controlled requirement and exact target excerpt. Record the reviewer, document revisions, labelling protocol, disagreements, and adjudication outside the dataset or in the governed evidence register.

Run it with:

```powershell
npm.cmd run verify:compliance-golden -- C:\controlled-evaluation\expert-compliance-set.json
```

Minimum release gates:

- at least 200 representative cases;
- coverage of every supported comparison modality and target document type;
- at least two qualified reviewers for critical/high-severity cases;
- at least 95% exact-verdict accuracy;
- zero unreviewed false negatives on critical/high-severity deterministic deviations;
- precision and recall reported separately, never accuracy alone;
- failures retained and triaged, not removed to improve the score;
- dataset separated from prompt/model development data.

## Remaining external acceptance evidence

The implementation is ready to consume an expert-labelled dataset, but the repository cannot manufacture professional engineering ground truth. Before a production claim or unattended deployment, the project owner must supply or authorize:

- representative approved client specifications;
- corresponding approved vendor submittals, POs, shop drawings, and drawings;
- independently adjudicated expected outcomes;
- licensed standards content where standards clauses are required;
- reviewer sign-off and an agreed severity policy.

Until that evidence exists, the UI correctly labels the bundled metric as controlled validation and prohibits treating it as a production accuracy claim.
