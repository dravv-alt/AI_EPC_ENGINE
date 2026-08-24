import { zodToJsonSchema } from "zod-to-json-schema";
import type { CopilotTool, CopilotToolCatalogueEntry } from "@/lib/copilot/types";

import { tools as readProjectTools } from "@/lib/copilot/registry/read-project";
import { tools as readScheduleTools } from "@/lib/copilot/registry/read-schedule";
import { tools as readSupplyTools } from "@/lib/copilot/registry/read-supply";
import { tools as readCxComplianceTools } from "@/lib/copilot/registry/read-cx-compliance";
import { tools as writeFindingsTools } from "@/lib/copilot/registry/write-findings";
import { tools as writeRecordsTools } from "@/lib/copilot/registry/write-records";
import { tools as writeUploadsTools } from "@/lib/copilot/registry/write-uploads";
import { tools as writeExportsTools } from "@/lib/copilot/registry/write-exports";
import { tools as writeSupplyTools } from "@/lib/copilot/registry/write-supply";
import { tools as writeCxComplianceTools } from "@/lib/copilot/registry/write-cx-compliance";
import { tools as writeScheduleTools } from "@/lib/copilot/registry/write-schedule";
import { tools as writeSiteAnalysisTools } from "@/lib/copilot/registry/write-site-analysis";

/**
 * The complete registry index. Written once (Wave 1, A1-1) and never edited
 * again — every later-wave module is imported here already, most as stubs
 * that later agents fill in place. Add a new registry MODULE FILE, not a new
 * import here, if a future slice ever needs one this list doesn't cover.
 */
const allModules: CopilotTool[][] = [
  readProjectTools,
  readScheduleTools,
  readSupplyTools,
  readCxComplianceTools,
  writeFindingsTools,
  writeRecordsTools,
  writeUploadsTools,
  writeExportsTools,
  writeSupplyTools,
  writeCxComplianceTools,
  writeScheduleTools,
  writeSiteAnalysisTools
];

export const copilotTools: Record<string, CopilotTool> = {};

for (const moduleTools of allModules) {
  for (const tool of moduleTools) {
    if (copilotTools[tool.name]) {
      throw new Error(`Duplicate copilot tool name: "${tool.name}" is registered by more than one registry module.`);
    }
    copilotTools[tool.name] = tool;
  }
}

/**
 * `names` narrows the catalogue to a subset (see tool-selection.ts for why —
 * the full 50-tool catalogue alone can exceed a hosted provider's per-request
 * token budget). Omit it for the full catalogue.
 */
export function toolCatalogue(names?: readonly string[]): CopilotToolCatalogueEntry[] {
  const tools = names ? names.map((name) => copilotTools[name]).filter((tool): tool is CopilotTool => Boolean(tool)) : Object.values(copilotTools);
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    // No name arg: this is the only consumer (loop.ts, embedded directly in
    // a char-budgeted prompt) and doesn't need a $ref/definitions wrapper —
    // an inline schema is materially smaller for the same information, which
    // matters a lot at 50 tools (measured: ~24K vs ~38K chars pretty-printed
    // for the full catalogue).
    inputJsonSchema: zodToJsonSchema(tool.input)
  }));
}
