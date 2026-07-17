import Link from "next/link";
import { Archive, Bell, Boxes, CalendarRange, CircleAlert, ClipboardCheck, FileCheck2, FolderOpen, GitCompareArrows, Grid2X2, ListChecks, Menu, Network, ScanLine, Search, ShieldCheck, Ship, UserRound, Wrench } from "lucide-react";

const mobileLinks = [
  [Grid2X2, "Overview", "/"], [FolderOpen, "Sources", "/sources"], [ListChecks, "Requirements", "/requirements"],
  [Wrench, "Systems", "/systems"], [Archive, "Evidence", "/evidence"], [ScanLine, "Field capture", "/field-capture"],
  [ClipboardCheck, "Readiness", "/readiness"], [CalendarRange, "Schedule", "/schedule"], [CircleAlert, "Actions", "/actions"],
  [GitCompareArrows, "Changes", "/changes"], [Boxes, "Cx tests", "/cx"], [Ship, "Shipments", "/shipments"],
  [FileCheck2, "Compliance", "/compliance"], [Search, "Knowledge", "/knowledge"], [Network, "Graph & timeline", "/graph"],
  [Bell, "Command center", "/command-center"], [ShieldCheck, "Turnover", "/turnover"]
] as const;

export function MobileRouteMenu() {
  return <details className="mobile-route-menu mobile-only">
    <summary className="icon-button" aria-label="Open navigation"><Menu size={20} /></summary>
    <nav aria-label="Responsive navigation">
      {mobileLinks.map(([Icon, label, href]) => <Link href={href} key={href}><Icon size={17} /><span>{label}</span></Link>)}
      <Link href="/settings"><Menu size={17} /><span>Settings & audit</span></Link>
      <Link href="/profile"><UserRound size={17} /><span>Profile & security</span></Link>
    </nav>
  </details>;
}
