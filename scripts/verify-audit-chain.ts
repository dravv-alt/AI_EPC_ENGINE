import { verifyAuditChain } from "../src/lib/audit/verify-chain";
import { developmentProjectId } from "../src/lib/demo";

async function main() {
  const projectId = process.argv[2] ?? developmentProjectId;
  const result = await verifyAuditChain(projectId);
  if (!result.valid) throw new Error(result.errors.join(" "));
  console.log(`Audit chain valid for ${result.eventCount} event(s): ${result.verifiedEvents} canonical, ${result.legacyEvents} legacy; head ${result.headHash?.slice(0, 16) ?? "none"}.`);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
