import Link from "next/link";
import { Bell, Grid2X2, Menu, Search } from "lucide-react";
import { WorkspaceNavigation } from "@/components/workspace-navigation";

export function FeatureShell({ projectName, eyebrow, title, description, children }: { projectName: string; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="app-shell">
    <WorkspaceNavigation projectName={projectName} />
    <section className="workspace">
      <header className="topbar"><button className="icon-button mobile-only" aria-label="Open navigation"><Menu size={20} /></button><label className="search-box"><Search size={18} /><input aria-label="Search this project" placeholder="Search sources, assets, findings…" /></label><div className="topbar-actions"><Link className="icon-button" href="/command-center" aria-label="Notifications"><Bell size={19} /><span className="notification-dot" /></Link><span className="sync-state"><span />Database connected</span></div></header>
      <div className="content"><section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subhead">{description}</p></div><Link className="button button-secondary" href="/"><Grid2X2 size={17} /> Overview</Link></section>{children}</div>
    </section>
    <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/"><Grid2X2 size={20} /><span>Home</span></Link><Link href="/knowledge"><Search size={20} /><span>Search</span></Link><Link href="/settings"><Menu size={20} /><span>More</span></Link></nav>
  </main>;
}
