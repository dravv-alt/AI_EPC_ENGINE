export type RouteSeo = { title: string; description: string };

const defaultSeo: RouteSeo = {
  title: "Pramana Cx | EPC commissioning intelligence",
  description: "Evidence-backed readiness, delivery coordination, and governed commissioning intelligence for mission-critical EPC projects."
};

const routeSeo: Record<string, RouteSeo> = {
  "/": { title: "Project Overview", description: "A governed view of EPC readiness, delivery signals, open actions, and controlled evidence." },
  "/projects": { title: "Projects", description: "Select and manage governed EPC commissioning workspaces." },
  "/site-analysis": { title: "Site Analysis", description: "Structure the technical, operational, and delivery basis for a mission-critical site." },
  "/readiness": { title: "Readiness", description: "Trace each gate decision to controlled requirements, evidence, tests, and accountable approvals." },
  "/actions": { title: "Issues & Actions", description: "Own, resolve, and audit the issues affecting commissioning readiness." },
  "/sources": { title: "Controlled Documents", description: "Manage controlled EPC source documents, revisions, extraction, and traceable requirements." },
  "/requirements": { title: "Requirements", description: "Turn controlled source material into reviewable, evidence-backed EPC requirements." },
  "/systems": { title: "Systems & Assets", description: "Map commissioning systems and assets to readiness, evidence, and delivery decisions." },
  "/rack-model": { title: "Digital Rack Model", description: "Model data-centre rack layouts and governed equipment relationships." },
  "/evidence": { title: "Evidence", description: "Capture, review, and trace field evidence used in EPC commissioning decisions." },
  "/field-capture": { title: "Capture Evidence", description: "Capture accountable field evidence for governed commissioning workflows." },
  "/schedule": { title: "Delivery Schedule", description: "Understand schedule versions, dependencies, risks, and commissioning impact." },
  "/cx": { title: "Commissioning Tests", description: "Execute controlled commissioning checklists, record measurements, and prepare reviewable reports." },
  "/shipments": { title: "Shipments & Logistics", description: "Track shipment plans, route risk, ETA impact, and delivery-linked actions." },
  "/compliance": { title: "Compliance", description: "Compare accepted requirements with controlled targets using cited, reviewable proposals." },
  "/changes": { title: "Change Control", description: "Review document change impact across requirements, evidence, tests, and readiness." },
  "/graph": { title: "Traceability", description: "Explore the traceable relationship between sources, requirements, evidence, assets, and decisions." },
  "/turnover": { title: "Turnover & Closeout", description: "Assemble verifiable closeout packs with evidence, approvals, and commissioning provenance." },
  "/financial-modeler": { title: "Financial Modeler", description: "Model commercial delivery scenarios for EPC programme decisions." },
  "/technology-drafts": { title: "Technology Draft Studio", description: "Create governed technology and engineering draft material from structured project context." },
  "/knowledge": { title: "Knowledge Search", description: "Ask cited questions across controlled project knowledge without treating AI output as authority." },
  "/command-center": { title: "Alert Center", description: "Triage EPC delivery signals, project alerts, and linked actions." },
  "/settings": { title: "Settings", description: "Configure your Pramana Cx workspace preferences." },
  "/profile": { title: "Profile & Security", description: "Manage identity, access, and account security." },
  "/help": { title: "Help", description: "Learn how to operate governed commissioning workflows in Pramana Cx." }
};

export function getRouteSeo(pathname: string | null): RouteSeo {
  if (!pathname) return defaultSeo;
  if (routeSeo[pathname]) return routeSeo[pathname];
  if (pathname.startsWith("/actions/")) return { title: "Issue Detail", description: "Review a governed commissioning issue, its evidence, decision context, and accountable next actions." };
  if (pathname.startsWith("/sources/regions/")) return { title: "Source Region", description: "Review the controlled source region supporting an EPC requirement or decision." };
  return defaultSeo;
}
