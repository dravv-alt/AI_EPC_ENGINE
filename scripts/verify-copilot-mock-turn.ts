import { config } from "dotenv";
config({ path: ".env.local" });
config();

// Slice 13 assertion 7 helper — mock determinism.
//
// `env.MODEL_PROVIDER` (src/lib/env.ts) is parsed once per process from
// `process.env` at import time, so a single script cannot exercise both the
// real configured provider (assertions 4-6) and `MODEL_PROVIDER=mock`
// (assertion 7) in the same run. `scripts/verify-copilot-http.ts` spawns this
// file as its own `tsx` process with `MODEL_PROVIDER=mock` forced in the
// child environment, so this file's own `env` import resolves to the mock
// provider independently of whatever the parent process is configured for.
//
// Reads a pre-created throwaway project/user/role from env vars (the parent
// owns setup and teardown of that project), creates and cleans up only the
// one conversation this turn needs, and prints a single JSON line the parent
// parses: `{ envelope, toolMessageCount }`.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { copilotConversations, copilotMessages } from "../src/lib/db/schema";
import { runCopilotTurn } from "../src/lib/copilot/loop";
import type { ProjectRole } from "../src/lib/auth/roles";

async function main() {
  const projectId = process.env.COPILOT_MOCK_TEST_PROJECT_ID;
  const userId = process.env.COPILOT_MOCK_TEST_USER_ID;
  const role = process.env.COPILOT_MOCK_TEST_ROLE as ProjectRole | undefined;
  if (!projectId || !userId || !role) {
    throw new Error("COPILOT_MOCK_TEST_PROJECT_ID, _USER_ID, and _ROLE must be set by the parent script.");
  }

  const conversationId = randomUUID();
  await db.insert(copilotConversations).values({ id: conversationId, projectId, userId, title: "Slice 13 mock determinism check" });

  try {
    const envelope = await runCopilotTurn({
      ctx: {
        projectId,
        userId,
        role,
        conversationId,
        cookieHeader: "",
        clientIp: "127.0.0.1",
        pathname: "/command-center",
        searchParams: {}
      },
      conversationId,
      // A prompt that would normally provoke at least one tool call under a
      // real model — under MODEL_PROVIDER=mock it must still degrade straight
      // to the deterministic `done` step without invoking anything.
      userMessage: "What is my gate readiness?"
    });

    const toolMessages = await db.select({ id: copilotMessages.id }).from(copilotMessages)
      .where(eq(copilotMessages.conversationId, conversationId));
    const toolMessageCount = toolMessages.length > 0
      ? (await db.query.copilotMessages.findMany({ where: eq(copilotMessages.conversationId, conversationId) }))
        .filter((message) => message.role === "tool").length
      : 0;

    // Print exactly one JSON line — the parent process parses stdout by line
    // and takes the last line as the result, so no other console output.
    console.log(JSON.stringify({ envelope, toolMessageCount }));
  } finally {
    await db.delete(copilotMessages).where(eq(copilotMessages.conversationId, conversationId));
    await db.delete(copilotConversations).where(eq(copilotConversations.id, conversationId));
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
