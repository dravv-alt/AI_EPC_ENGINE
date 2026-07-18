import assert from "node:assert/strict";

async function main() {
  const base = process.env.POLL_TEST_URL ?? "http://localhost:4173";

  // The recurring poll loop must be observable: after the worker starts, a
  // heartbeat is recorded and surfaced on the health endpoint without any
  // manual trigger. Poll health for up to ~15s for the first heartbeat.
  let health: any;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`${base}/api/health`, { cache: "no-store" });
    health = await response.json();
    if (health?.dependencies?.poll?.status === "ok") break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const poll = health?.dependencies?.poll;
  assert.ok(poll, "Health must surface a `poll` dependency for the recurring poll loop.");
  assert.equal(poll.status, "ok", `Poll loop is not healthy: ${JSON.stringify(poll)}`);
  assert.equal(typeof poll.lastHeartbeatAt, "string", "Poll health must report the last heartbeat time.");
  assert.ok(!Number.isNaN(Date.parse(poll.lastHeartbeatAt)), "lastHeartbeatAt must be a valid ISO timestamp.");
  assert.equal(typeof poll.intervalMs, "number", "Poll health must report the configured interval.");
  assert.ok(poll.intervalMs >= 1_000, "Poll interval must be at least 1000ms.");

  const heartbeatAgeMs = Date.now() - Date.parse(poll.lastHeartbeatAt);
  assert.ok(heartbeatAgeMs >= 0, "Heartbeat cannot be in the future.");

  console.log(`Poll loop is observable: last heartbeat ${poll.lastHeartbeatAt}, interval ${poll.intervalMs}ms.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
