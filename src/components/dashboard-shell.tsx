import {
  Bell,
  BookOpen,
  Camera,
  FileUp,
  Grid2X2,
  Menu,
  Search,
} from "lucide-react";
import type { DashboardData, ReadinessTone } from "@/lib/dashboard-data";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { MobileRouteMenu } from "@/components/mobile-route-menu";
import { ProjectSearchForm } from "@/components/project-search-form";
import { ProjectCommandOverview } from "@/components/project-command-overview";
import { ClerkAccountControl } from "@/components/clerk-account-control";
import { ThemeToggle } from "@/components/theme-toggle";
import { clerkIsConfigured } from "@/lib/env";

const toneLabel: Record<ReadinessTone, string> = {
  ready: "Ready",
  review: "In review",
  blocked: "Blocked",
  unknown: "Unknown"
};

export function DashboardShell({ data }: { data: DashboardData }) {
  return (
    <main className="app-shell">
      <WorkspaceNavigation projectName={data.project} />

      <section className="workspace">
        <header className="topbar">
          <MobileRouteMenu />
          <ProjectSearchForm />
          <div className="topbar-actions"><Link className="icon-button" href="/command-center" aria-label="Open notifications"><Bell size={19} /><span className="notification-dot" /></Link><ThemeToggle /><Link className="help-button" href={{ pathname: "/help" }} aria-label="Open help">?</Link>{clerkIsConfigured && <ClerkAccountControl />}<span className="sync-state"><span />Synced</span></div>
        </header>

        <div className="content">
          <div className="pm-breadcrumbs"><Link href="/projects">Projects</Link><span>/</span><span>{data.projectCode}</span><span>/</span><b>Overview</b></div>
          <section className="page-heading pm-project-heading">
            <div><p className="eyebrow">Active commissioning project</p><h1>{data.project}</h1><div className="pm-heading-meta"><span className="pm-status-chip status-open">Active</span><span>{data.projectCode}</span><span>{data.members.length} contributor{data.members.length === 1 ? "" : "s"}</span><span>{data.gate}</span></div></div>
            <div className="heading-actions">
              <Link className="button button-secondary" href={{ pathname: "/brief" }}><BookOpen size={17} /> View brief</Link>
              <Link className="button button-secondary" href={{ pathname: "/field-capture" }}><Camera size={17} /> Capture evidence</Link>
              <Link className="button button-primary" href="/sources"><FileUp size={17} /> Upload source</Link>
            </div>
          </section>

          <ProjectCommandOverview data={data} />
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/"><Grid2X2 size={20} /><span>Home</span></Link><Link href="/knowledge"><Search size={20} /><span>Search</span></Link><Link href="/settings"><Menu size={20} /><span>More</span></Link></nav>
    </main>
  );
}
