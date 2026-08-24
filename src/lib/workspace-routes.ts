/** Server-safe route metadata shared by navigation-derived prompt context. */
export type WorkspaceRouteMetadata = { label: string; href: string };

export const primaryWorkspaceRouteMetadata: WorkspaceRouteMetadata[] = [
  { label: "Projects", href: "/projects" }, { label: "Overview", href: "/" }, { label: "Site Analysis", href: "/site-analysis" }, { label: "Readiness", href: "/readiness" }, { label: "Issues", href: "/actions" }
];

export const workspaceRouteGroups: Array<{ label: string; links: WorkspaceRouteMetadata[] }> = [
  { label: "Project records", links: [{ label: "Documents", href: "/sources" }, { label: "Requirements", href: "/requirements" }, { label: "Systems & Assets", href: "/systems" }, { label: "Evidence", href: "/evidence" }, { label: "Capture Evidence", href: "/field-capture" }] },
  { label: "Delivery", links: [{ label: "Schedule", href: "/schedule" }, { label: "Commissioning Tests", href: "/cx" }, { label: "Shipments & Logistics", href: "/shipments" }] },
  { label: "Assurance", links: [{ label: "Compliance", href: "/compliance" }, { label: "Change Control", href: "/changes" }, { label: "Traceability", href: "/graph" }, { label: "Turnover & Closeout", href: "/turnover" }] },
  { label: "Commercial", links: [{ label: "Financial Modeler · Beta", href: "/financial-modeler" }, { label: "Technology Draft Studio", href: "/technology-drafts" }] },
  { label: "Project Tools", links: [{ label: "Knowledge Search", href: "/knowledge" }, { label: "Alert Center", href: "/command-center" }] }
];
