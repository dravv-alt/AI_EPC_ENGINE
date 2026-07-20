import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
async function source(file: string) { return readFile(path.join(root, file), "utf8"); }
function requires(contents: string, expected: string, label: string) { assert.ok(contents.includes(expected), `${label} must contain ${expected}`); }

async function main() {
  const [readiness, actions, schedulePage, schedule, risks, shipments, dashboard, locationSearch] = await Promise.all([
    source("src/app/readiness/page.tsx"),
    source("src/components/actions-workbench.tsx"),
    source("src/app/schedule/page.tsx"),
    source("src/components/schedule-workbench.tsx"),
    source("src/components/predictive-risk-workbench.tsx"),
    source("src/components/shipment-workbench.tsx"),
    source("src/lib/dashboard-data.ts"),
    source("src/components/location-search.tsx")
  ]);

  requires(readiness, "href={`/actions?finding=${finding.id}`}", "Readiness finding deep-link");
  requires(readiness, "id={`gate-${context.gate.id}`}", "Readiness target");
  requires(actions, "id={`finding-${finding.id}`}", "Actions target");
  requires(actions, "target?.closest(\"details\")?.setAttribute(\"open\", \"\")", "Closed finding focus");
  requires(schedulePage, "initialRiskId={focus.risk}", "Schedule risk hand-off");
  requires(schedule, "id={`task-${item.taskId}`}", "Schedule task target");
  requires(schedule, "id={`version-${version.id}`}", "Schedule version target");
  requires(risks, "id={`risk-${risk.id}`}", "Risk target");
  requires(shipments, "id={`shipment-${shipment.id}`}", "Shipment target");
  requires(dashboard, "href: `/shipments?shipment=${payload.shipmentId}`", "Command Center shipment deep-link");
  requires(locationSearch, "allowPublicSearch", "Explicit public-geocoder consent");
  requires(locationSearch, "NOMINATIM_TIMEOUT_MS", "Public-geocoder deadline");
  requires(locationSearch, "abortRef.current?.abort()", "Public-geocoder cancellation");
  console.log("Deep-link target and public-geocoder safety contracts verified.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
