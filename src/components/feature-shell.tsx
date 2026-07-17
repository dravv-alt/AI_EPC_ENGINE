import Link from "next/link";
import { Bell, Grid2X2, Menu, Search } from "lucide-react";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { ConnectionStatus } from "@/components/connection-status";
import { MobileRouteMenu } from "@/components/mobile-route-menu";

export function FeatureShell({ projectName, eyebrow, title, description, children }: { projectName: string; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="app-shell">
    <WorkspaceNavigation projectName={projectName} />
    <section className="workspace">
      <header className="topbar"><MobileRouteMenu /><form className="search-box" action="/knowledge"><Search size={18} /><input name="q" aria-label="Search this project" placeholder="Search sources, assets, findings…" /></form><div className="topbar-actions"><Link className="icon-button" href="/command-center" aria-label="Notifications"><Bell size={19} /><span className="notification-dot" /></Link><ConnectionStatus /></div></header>
      <div className="content"><section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subhead">{description}</p></div><Link className="button button-secondary" href="/"><Grid2X2 size={17} /> Overview</Link></section>{children}</div>
    </section>
    <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/"><Grid2X2 size={20} /><span>Home</span></Link><Link href="/knowledge"><Search size={20} /><span>Search</span></Link><Link href="/settings"><Menu size={20} /><span>More</span></Link></nav>
  </main>;
}
