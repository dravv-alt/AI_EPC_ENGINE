import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { alerts, findings, gates, projects, scheduleRisks, scheduleTasks, scheduleVersions } from "../src/lib/db/schema";

// Slice 10: every Command Center alert must deep-link to its related record.
// We seed one alert of each cross-linked type (TEST_FAILED -> finding + gate,
// SHIPMENT_DELAYED -> affected schedule task + current schedule version,
// predicted_risk_delay -> task + mitigation) against real seeded ids, then fetch
// the server-rendered Command Center HTML and assert the exact deep-link href for
// each related record renders. Expected hrefs are derived from the ids we seed,
// not from the code under test. All seeded rows are removed in finally.

async function main() {
  const base = process.env.COMMAND_LINKS_TEST_URL ?? "http://localhost:3000";
  const tag = randomUUID().slice(0, 8);
  const insertedAlertIds: string[] = [];
  const insertedRiskIds: string[] = [];
  try {
    const [project] = await db.select({ id: projects.id }).from(projects).limit(1);
    assert.ok(project, "A seeded project is required.");

    // Resolve real seeded records to link against.
    const [finding] = await db.select({ id: findings.id, gateId: findings.gateId }).from(findings).where(eq(findings.projectId, project.id)).limit(1);
    assert.ok(finding && finding.gateId, "A seeded finding with a gate is required.");
    const [gate] = await db.select({ id: gates.id }).from(gates).where(eq(gates.id, finding.gateId!)).limit(1);
    assert.ok(gate, "The finding's gate must exist.");
    const latestVersion = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, project.id), orderBy: (v, { desc }) => [desc(v.versionNumber)] });
    assert.ok(latestVersion, "A current schedule version is required.");
    const taskRows = await db.select({ id: scheduleTasks.id }).from(scheduleTasks).where(eq(scheduleTasks.projectId, project.id)).limit(2);
    assert.ok(taskRows.length >= 2, "At least two seeded schedule tasks are required.");
    const shipmentTaskId = taskRows[0].id;
    const riskTaskId = taskRows[1].id;

    // Seed a schedule risk so the predicted-risk alert can resolve task + mitigation.
    const mitigation = { id: `mit-${tag}`, label: `Expedite crew ${tag}`, description: "Advisory mitigation option seeded for cross-link verification." };
    const [risk] = await db.insert(scheduleRisks).values({
      projectId: project.id, taskId: riskTaskId, riskType: `verify_delay_${tag}`, status: "active", probability: "0.8000",
      estimatedDelayHours: 24, mitigationOptions: [mitigation], materialityHash: `hash-${tag}`, observedAt: new Date()
    }).returning({ id: scheduleRisks.id });
    insertedRiskIds.push(risk.id);

    const seeded = await db.insert(alerts).values([
      { projectId: project.id, eventType: "TEST_FAILED", dedupKey: `test:${randomUUID()}:step-${tag}`, title: `TEST_FAILED cross-link ${tag}`, payload: { testRecordId: randomUUID(), stepId: randomUUID(), findingId: finding.id, gateId: gate.id } },
      { projectId: project.id, eventType: "SHIPMENT_DELAYED", dedupKey: `shipment:verify-${tag}`, title: `SHIPMENT_DELAYED cross-link ${tag}`, payload: { shipmentId: randomUUID(), status: "amber", availableAt: new Date().toISOString(), affectedTaskIds: [shipmentTaskId] } },
      { projectId: project.id, eventType: "predicted_risk_delay", dedupKey: `risk:${risk.id}`, title: `predicted_risk_delay cross-link ${tag}`, payload: { riskId: risk.id, riskType: `verify_delay_${tag}`, sourceSignalId: randomUUID(), affectedTaskIds: [riskTaskId] } }
    ]).returning({ id: alerts.id });
    insertedAlertIds.push(...seeded.map((row) => row.id));

    const response = await fetch(`${base}/command-center`);
    assert.equal(response.status, 200, `Command Center must render (got ${response.status}).`);
    const html = await response.text();

    const expected: Array<{ label: string; href: string }> = [
      { label: "TEST_FAILED -> finding", href: `/actions?finding=${finding.id}` },
      { label: "TEST_FAILED -> gate", href: `/readiness?gate=${gate.id}` },
      { label: "SHIPMENT_DELAYED -> affected task", href: `/schedule?task=${shipmentTaskId}` },
      { label: "SHIPMENT_DELAYED -> current version", href: `/schedule?version=${latestVersion.id}` },
      { label: "predicted_risk_delay -> task", href: `/schedule?task=${riskTaskId}` },
      { label: "predicted_risk_delay -> mitigation", href: `/schedule?risk=${risk.id}` }
    ];
    for (const link of expected) assert.ok(html.includes(link.href), `Command Center must deep-link ${link.label} at href ${link.href}.`);
    // The mitigation option label must render so the risk cross-link is human-readable.
    assert.ok(html.includes(mitigation.label), `The mitigation label "${mitigation.label}" must render on the risk alert.`);

    // The Actions workbench cross-links each finding to its gate readiness.
    const actions = await fetch(`${base}/actions`);
    assert.equal(actions.status, 200, `Actions workbench must render (got ${actions.status}).`);
    const actionsHtml = await actions.text();
    assert.ok(actionsHtml.includes(`/readiness?gate=${finding.gateId}`), `Actions workbench must cross-link finding to gate readiness /readiness?gate=${finding.gateId}.`);

    console.log(`Slice 10 command-center cross-links verified: TEST_FAILED->finding+gate, SHIPMENT_DELAYED->task+version, predicted_risk_delay->task+mitigation all render (${expected.length} deep-links) plus Actions->gate cross-link.`);
  } finally {
    if (insertedAlertIds.length) await db.delete(alerts).where(inArray(alerts.id, insertedAlertIds));
    if (insertedRiskIds.length) await db.delete(scheduleRisks).where(inArray(scheduleRisks.id, insertedRiskIds));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
