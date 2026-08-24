// Static description of the Pramana CX app, assembled once at module load from
// real exported constants so it can never hand-drift from the app it describes.
// See ChatbotHarnessPlan.md Slice 3.1. Do not hand-copy prose here that could
// go stale — derive it from the source of truth and let this module compute it.

import { primaryWorkspaceRouteMetadata, workspaceRouteGroups } from "@/lib/workspace-routes";
import { projectRoles, can, type Permission } from "@/lib/auth/roles";
import { graphEntityTypes, graphRelationshipTypes } from "@/lib/graph/entities";
import { evidenceTaxonomy } from "@/lib/evidence/taxonomy";
import { claimTaxonomy } from "@/lib/evidence/claim-taxonomy";
import { cxVerdict } from "@/lib/db/schema";

// computeReadiness (src/lib/readiness/compute.ts) returns a `ReadinessState`
// union with no accompanying runtime array to import — same situation the
// plan explicitly allows for ComplianceVerdict. Hand-transcribed from the
// type definition; keep in sync if that file changes.
const readinessStates = ["unknown", "blocked", "in_review", "ready"] as const;

// ComplianceVerdict (src/lib/compliance/compare.ts) is a type-only union with
// no runtime array alongside it. Hand-transcribed per the plan's allowance.
const complianceVerdicts = [
  "conforms",
  "deterministic_flag",
  "possible_mismatch",
  "needs_engineering_judgment",
  "equivalent_by_precedent"
] as const;

function formatRoutes(links: Array<{ label: string; href: string }>) {
  return links.map(({ label, href }) => `- ${label}: ${href}`).join("\n");
}

const routesSection = [
  "## Routes",
  "Primary:",
  formatRoutes(primaryWorkspaceRouteMetadata),
  ...workspaceRouteGroups.map((group) =>
    `${group.label}:\n${formatRoutes(group.links)}`
  )
].join("\n");

const permissions: readonly Permission[] = [
  "project:manage",
  "configuration:manage",
  "graph:manage",
  "source:upload",
  "requirement:review",
  "evidence:capture",
  "finding:manage",
  "gate:approve",
  "schedule:manage",
  "audit:view"
];

const rolesSection = [
  "## Roles and permissions",
  ...projectRoles.map((role) => {
    const granted = permissions.filter((permission) => can(role, permission));
    return `- ${role}: ${granted.join(", ")}`;
  })
].join("\n");

const vocabularySection = [
  "## Vocabulary",
  `Graph entity types: ${graphEntityTypes.join(", ")}`,
  `Graph relationship types: ${graphRelationshipTypes.join(", ")}`,
  `Evidence types: ${evidenceTaxonomy.map((item) => item.value).join(", ")}`,
  `Claim types: ${claimTaxonomy.map((item) => item.value).join(", ")}`
].join("\n");

const stateMachinesSection = [
  "## State machines",
  `Readiness states: ${readinessStates.join(", ")}`,
  `Compliance verdicts: ${complianceVerdicts.join(", ")}`,
  `Cx test verdicts: ${cxVerdict.enumValues.join(", ")}`
].join("\n");

const authoritySection = [
  "## Authority rules (non-negotiable)",
  "1. No new domain logic. Every copilot action is an existing Pramana CX operation invoked",
  "   through a thin wrapper. If the app cannot do it today, the copilot cannot either.",
  "2. AI proposes, humans dispose. Everything the copilot creates lands in its non-final state:",
  '   findings.status="open", evidence.validityState="pending", evidenceClaims.status="proposed",',
  '   cxChecklists.status="draft", complianceChecks.reviewState="proposed",',
  '   shipmentPlans.status="proposed". The copilot never writes a terminal state.',
  "3. Review routes are off-limits. Never call PATCH /api/requirements/{id}/review,",
  "   POST /api/evidence/{id}/review, PATCH /api/compliance/checks/{id}/review,",
  "   PATCH /api/compliance/precedents/{id}/review, POST /api/cx/checklists/{id}/review,",
  "   POST /api/schedule/tasks|resources/{id}/review, PATCH /api/schedule/risks/{id}/review,",
  "   or POST /api/cx/test-records/{id}/report/approve. Their GET halves are read-only and",
  "   are allowed (they return surfaceTeachbackAdvisory output).",
  "4. Gate approval is off-limits. POST /api/gates/{gateId}/decisions calls",
  "   requireFreshApprovalMfa(). Link the user to /readiness?gate={id} instead.",
  "5. Permissions are never widened. Every tool declares the same permission string its",
  "   underlying route enforces. See §2 for the one function that self-enforces and the many",
  "   that do not.",
  "6. No uncited claims about project content. If answerKnowledgeQuery returns",
  "   noResults: true, say so. Never fill the gap from the model's own knowledge.",
  "7. Render, don't generate. Tool results render as React components. The model writes the",
  "   connective sentence and picks citations. It never retypes numbers that a tool already returned."
].join("\n");

/**
 * Static, frozen description of the Pramana CX app: its routes, roles and
 * permissions, domain vocabulary, state machines, and non-negotiable
 * authority rules. Computed once at module load from real exported
 * constants — never hand-copied prose that could drift from the app.
 *
 * Imported by src/lib/copilot/context.ts as one section of the assembled
 * copilot system prompt.
 */
export const appMap: string = [
  routesSection,
  rolesSection,
  vocabularySection,
  stateMachinesSection,
  authoritySection
].join("\n\n");
