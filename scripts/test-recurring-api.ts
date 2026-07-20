import assert from "node:assert/strict";
import { db } from "../src/lib/db/client";
import { systems, projects } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const base = process.env.CX_TEST_URL ?? "http://localhost:4173";
  try {
    const project = await db.query.projects.findFirst({ where: (p, { eq }) => eq(p.id, developmentProjectId) });
    assert.ok(project);

    console.log("Starting recurring risk poll job...");
    const startResult = await request(`${base}/api/schedule/risks/recurring`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        action: "start",
        intervalMinutes: 1,
      }),
    });
    console.log("Start Result:", startResult);

    console.log("Stopping recurring risk poll job...");
    const stopResult = await request(`${base}/api/schedule/risks/recurring`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        action: "stop",
      }),
    });
    console.log("Stop Result:", stopResult);
  } catch(e) {
    console.error(e);
  }
}

main().then(() => {
  setTimeout(() => process.exit(0), 100);
});
