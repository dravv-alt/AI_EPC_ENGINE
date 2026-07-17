"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Bell, Boxes, CalendarRange, ChevronDown, CircleAlert, ClipboardCheck, FileCheck2, FolderOpen, GitCompareArrows, Grid2X2, ListChecks, Search, Settings, ShieldCheck, Ship, Sparkles } from "lucide-react";

const links = [
  [Grid2X2, "Overview", "/"],
  [FolderOpen, "Sources", "/sources"],
  [ListChecks, "Requirements", "/requirements"],
  [Archive, "Evidence", "/evidence"],
  [ClipboardCheck, "Readiness", "/readiness"],
  [CalendarRange, "Schedule", "/schedule"],
  [CircleAlert, "Actions", "/actions"],
  [GitCompareArrows, "Changes", "/changes"],
  [Boxes, "Cx tests", "/cx"],
  [Ship, "Shipments", "/shipments"],
  [FileCheck2, "Compliance", "/compliance"],
  [Search, "Knowledge", "/knowledge"],
  [Bell, "Command center", "/command-center"],
  [ShieldCheck, "Turnover", "/turnover"]
] as const;

export function WorkspaceNavigation({ projectName }: { projectName: string }) {
  const pathname = usePathname();
  return <aside className="sidebar" aria-label="Primary navigation">
    <Link className="brand" href="/"><span className="brand-mark">P</span><span>pramana<span className="brand-muted">.cx</span></span></Link>
    <div className="project-switcher"><span className="project-dot" /><span>{projectName}</span><ChevronDown size={15} /></div>
    <nav className="nav-list">
      {links.map(([Icon, label, href]) => <Link className={`nav-item ${pathname === href ? "is-active" : ""}`} href={href} key={href}><Icon size={18} /><span>{label}</span></Link>)}
    </nav>
    <div className="sidebar-footer">
      <div className="dev-badge"><Sparkles size={14} /> Development mode</div>
      <Link className={`nav-item ${pathname === "/settings" ? "is-active" : ""}`} href="/settings"><Settings size={18} /><span>Settings</span></Link>
      <Link className="user-card" href="/profile"><span className="avatar">AM</span><span><b>Aarav Mehta</b><small>Open profile</small></span><ChevronDown size={15} /></Link>
    </div>
  </aside>;
}
