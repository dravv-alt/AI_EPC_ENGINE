x# Compliance Page Testing Guide

## Purpose

This guide verifies the complete Compliance page demo workflow at:

`http://localhost:3000/compliance`

The page compares an accepted requirement against an approved implementation target such as a submittal, purchase order, shop drawing, or drawing. Every generated result is a proposal until an engineer records a disposition.

Important authority rules:

- Specifications, standards and procedures establish requirements.
- Drawings, shop drawings, submittals and purchase orders are comparison targets.
- RFIs provide clarification context.
- A Justification & Approval (J&A) document is procurement authority context, not a purchase order.
- Do not accept a proposal unless the displayed requirement, target citation and reason support that decision.

## Before Testing

1. Confirm `http://localhost:3000/compliance` opens.
2. Confirm the server status in the header says connected.
3. Confirm the page has accepted requirements and eligible target lines.
4. Use a project member with permission to run and review compliance checks.
5. Keep the browser console open if you need to capture failed network requests.

## Fields and Valid Example Text

### Find a controlled target line

This field filters the target dropdown. Useful values include:

- `CHWP-02`
- `410 LPM`
- `MCC-01`
- `IP55`
- `FM-200`
- `6.5%`
- `UPS-01`
-    `8 ms`
- `Project Drawings`

### Mandatory engineer rationale

The rationale must contain at least 10 characters. Use a statement that records what was reviewed.

Accept example:

`Reviewed both exact citations. The target value satisfies the stated controlled requirement.`

Edit example:

`Reviewed the cited values. The proposed verdict requires correction because the target is outside the permitted tolerance.`

Reject example:

`Rejected because these citations refer to different equipment and are not a valid compliance comparison.`

### Edited final verdict

Available values:

- `Conforms`
- `Deterministic flag`
- `Possible mismatch`

Select the final verdict only after checking both citations.

### Precedent title

The title must contain at least 5 characters.

Example:

`Approved IP55 equivalence for indoor MCC enclosure`

### Cited engineering rationale

The rationale must contain at least 20 characters.

Example:

`IP55 exceeds the cited IP54 minimum for this exact MCC enclosure and project scope. The equivalence is limited to these cited records.`

### Precedent reviewer rationale

Example for acceptance:

`Verified against both exact citations; this project-scoped equivalence is technically justified.`

Example for rejection:

`The rationale does not establish equivalence for the exact equipment and cited target line.`

## Test Case 1: Detect a Numeric Flow Deviation

Objective: verify deterministic numeric comparison and exact citations.

1. Under **Accepted requirement**, select:
   `Primary and standby CHW pumps shall maintain design flow of 450 LPM...`
2. In **Find a controlled target line**, enter:
   `410 LPM`
3. Under **Controlled target line**, select:
   `AquaFlow CHWP-02 Vendor Submittal (Controlled Demo)` containing `410 LPM`.
4. Leave **Accepted equality precedent** set to `No precedent`.
5. Click **Run cited comparison**.

Expected result:

- A new proposed compliance check appears.
- The requirement citation shows 450 LPM with its tolerance.
- The target citation shows 410 LPM.
- The result indicates a deviation, deterministic flag, or possible mismatch.
- Nothing is automatically accepted.
- The target text remains inside its internally scrollable area.
- Both exact citation links remain visible below the text.

Review-path verification:

1. Enter this engineer rationale:
   `The cited target is 410 LPM and falls below the accepted 450 LPM requirement and permitted tolerance.`
2. Select `Deterministic flag` as the edited final verdict.
3. Click **Edit disposition**.

Expected review result:

- Review state changes from proposed to accepted/edited according to the API response.
- The final verdict is `deterministic flag`.
- Reviewer rationale and reviewer identity are displayed.
- Any proposed finding remains traceable from the check.

## Test Case 2: Verify a Conforming IP Rating

Objective: verify controlled categorical comparison and engineer review.

1. Select the accepted requirement:
   `Electrical panels serving mechanical equipment shall be rated IP54 minimum...`
2. Search for:
   `IP55`
3. Select the target from:
   `MCC-01 Panel Shop Drawing (Controlled Demo)` containing `IP55`.
4. Leave precedent set to `No precedent`.
5. Click **Run cited comparison**.

Expected result:

- A proposed comparison appears.
- Requirement side shows IP54 minimum.
- Target side shows IP55.
- The result should indicate conformity or require engineer judgment; it must not silently accept itself.

Accept-path verification:

1. Enter:
   `Reviewed both citations. IP55 meets or exceeds the cited IP54 minimum for this controlled MCC target.`
2. Click **Accept proposal**.

Expected review result:

- The proposal leaves the pending review queue.
- Engineer rationale is retained.
- The accepted result remains linked to both exact source regions.

## Test Case 3: Detect an FM-200 Concentration Mismatch

Objective: verify another numeric comparison with matching units and timing context.

1. Select the accepted requirement:
   `FM-200 agent concentration shall reach ≥ 7.0% v/v within 10 seconds...`
2. Search for:
   `6.5%`
3. Select:
   `FM-200 Suppression Vendor Submittal (Controlled Demo)` containing `6.5% v/v within 10 seconds`.
4. Click **Run cited comparison**.

Expected result:

- Requirement and target use compatible concentration units.
- The target value is visibly below the 7.0% requirement.
- A mismatch/deviation proposal appears.
- The reason references the controlled values rather than making an uncited assertion.

Reject-invalid-pair verification:

If you intentionally choose an unrelated target, enter:

`Rejected because the selected target is unrelated to the FM-200 requirement and cannot support this comparison.`

Then click **Reject proposal**.

Expected result:

- Review state changes to rejected.
- The rejected check remains available for audit history.
- No equivalence precedent is created automatically.

## Test Case 4: Scan Real Indexed Drawings

Objective: verify candidate discovery against the ingested Minneapolis drawing set.

1. Clear the target search field.
2. Click **Scan for deviations**.
3. Wait for the completion message.

Expected result:

- The message reports accepted requirements scanned and candidates found.
- Candidate jobs are queued or processed inline; the infrastructure mode is reported honestly.
- Proposed checks appear after processing/refresh.
- At least one target may cite `Project Drawings — Minneapolis MCR Update` when a relevant controlled line is found.
- J&A procurement authority content must not appear as a PO target.
- Specifications, standards, procedures and RFIs must not appear as implementation targets.

Known demo behavior:

- When deterministic mock embeddings are configured, discovery uses a project- and document-type-scoped lexical fallback if mock vectors produce no threshold-qualified candidate.
- This fallback is deterministic and labelled by configuration; it does not claim production semantic-model accuracy.

## Test Case 5: Propose and Review an Equality Precedent

Objective: verify the human-controlled teach-back workflow.

Use only a proposed check whose verdict allows engineering judgment or possible mismatch.

1. In **Precedent title**, enter:
   `Approved IP55 equivalence for indoor MCC enclosure`
2. In **Cited engineering rationale**, enter:
   `IP55 exceeds the cited IP54 minimum for this exact MCC enclosure and project scope. The equivalence is limited to these cited records.`
3. Click **Propose equality precedent**.

Expected proposal result:

- The precedent is created in proposed state.
- It has no authority yet.
- It remains tied to the same requirement and exact normalized target content.

Review the precedent:

1. Enter:
   `Verified against both exact citations; this project-scoped equivalence is technically justified.`
2. Click **Accept precedent**.

Expected review result:

- The precedent changes to accepted.
- It appears in the accepted-equality dropdown only for the matching workflow.
- It does not apply globally to unrelated requirements or target lines.

## Negative Validation Checks

Verify these protections:

1. Submit an engineer rationale shorter than 10 characters.
   Expected: browser/API validation prevents submission.
2. Try to compare a requirement against its own source document through the API.
   Expected: request is rejected.
3. Try to use a standard, specification, procedure, RFI or J&A as the target through the API.
   Expected: request is rejected with a target-type validation error.
4. Search for text that does not exist, such as:
   `ZZZ-NO-SUCH-CONTROLLED-LINE`
   Expected: zero target lines are shown and **Run cited comparison** is disabled.
5. Disconnect or stop the application and attempt an action.
   Expected: an inline server-unreachable message appears and the button does not remain permanently stuck in a saving state.

## Pass Criteria

The Compliance page passes the demo test when:

- The page loads without horizontal overflow on desktop and mobile.
- Long target text scrolls internally without stretching the complete proposal card.
- Target search narrows the eligible controlled lines.
- Only approved implementation document types are selectable as targets.
- Manual comparisons produce cited proposals.
- Scan discovery finds project-scoped candidates.
- Every proposal requires explicit human review.
- Accept, edit and reject actions retain reviewer rationale.
- Equality precedents require a separate explicit review.
- J&A is never represented as a purchase order.
- Errors and empty states are visible and understandable.

## Recording Test Evidence

For each test, record:

- Date and time
- Tester name and role
- Requirement citation URL
- Target citation URL
- Generated check ID
- Initial verdict
- Final engineer disposition
- Screenshot before and after review
- Any browser console or API error

Do not use the controlled-demo records as proof of legal or contractual compliance. They validate application behavior only.
