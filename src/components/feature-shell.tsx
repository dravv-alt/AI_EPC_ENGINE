import Link from "next/link";
import { Bell, CircleHelp, Grid2X2, Menu, Search } from "lucide-react";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { ConnectionStatus } from "@/components/connection-status";
import { MobileRouteMenu } from "@/components/mobile-route-menu";
import { ProjectSearchForm } from "@/components/project-search-form";
import { ClerkAccountControl } from "@/components/clerk-account-control";
import { ThemeToggle } from "@/components/theme-toggle";
import { clerkIsConfigured } from "@/lib/env";

export function FeatureShell({ projectName, projectId, eyebrow, title, description, children }: { projectName: string; projectId?: string; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="app-shell">
    <WorkspaceNavigation projectName={projectName} />
    <section className="workspace">
      <header className="topbar"><MobileRouteMenu /><ProjectSearchForm /><div className="topbar-actions"><Link className="icon-button" href="/command-center" aria-label="Open notifications"><Bell size={19} /><span className="notification-dot" /></Link><ThemeToggle /><Link className="help-button" href={{ pathname: "/help" }} aria-label="Open help"><CircleHelp size={18} /></Link>{clerkIsConfigured && <ClerkAccountControl />}<ConnectionStatus projectId={projectId} /></div></header>
      <div className="content"><section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subhead">{description}</p></div><Link className="button button-secondary" href="/"><Grid2X2 size={17} /> Control Center</Link></section>{children}</div>
    </section>
    <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/"><Grid2X2 size={20} /><span>Home</span></Link><Link href="/knowledge"><Search size={20} /><span>Search</span></Link><Link href="/settings"><Menu size={20} /><span>Settings</span></Link></nav>
  </main>;
}
