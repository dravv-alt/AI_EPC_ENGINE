import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  FileUp,
  FolderOpen,
  Grid2X2,
  ListChecks,
  Menu,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { DashboardData, ReadinessTone } from "@/lib/dashboard-data";
import { RequirementReviewActions } from "@/components/requirement-review-actions";
import { SourceUploadForm } from "@/components/source-upload-form";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { MobileRouteMenu } from "@/components/mobile-route-menu";
import { ProjectSearchForm } from "@/components/project-search-form";
import { DashboardInsights } from "@/components/dashboard-insights";
import { ClerkAccountControl } from "@/components/clerk-account-control";
import { clerkIsConfigured } from "@/lib/env";

const navigation = [
  [Grid2X2, "Overview"],
  [FolderOpen, "Sources"],
  [ListChecks, "Requirements"],
  [ClipboardCheck, "Readiness"],
  [CircleAlert, "Actions"],
  [ShieldCheck, "Turnover"]
] as const;

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
          <div className="topbar-actions"><Link className="icon-button" href="/command-center" aria-label="Open notifications"><Bell size={19} /><span className="notification-dot" /></Link><Link className="help-button" href={{ pathname: "/help" }} aria-label="Open help">?</Link>{clerkIsConfigured && <ClerkAccountControl />}<span className="sync-state"><span />Synced</span></div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div><p className="eyebrow">Commissioning control room</p><h1>Project overview</h1><p className="subhead">Evidence-backed readiness for <b>{data.gate}</b>.</p></div>
            <div className="heading-actions"><Link className="button button-secondary" href={{ pathname: "/brief" }}><BookOpen size={17} /> View brief</Link><a className="button button-primary" href="#source-upload"><FileUp size={17} /> Upload source</a></div>
          </section>

          <DashboardInsights data={data} />

          <section className="readiness-layout" id="readiness">
            <article className="surface readiness-card">
              <div className="section-heading"><div><p className="eyebrow">Readiness board</p><h2>Gate status</h2></div><Link className="text-button" href="/readiness">Open board <ArrowUpRight size={15} /></Link></div>
              <div className="gate-list">
                {data.readiness.map((item) => <div className="gate-row" key={item.gateId}><span className={`status-dot ${item.state}`} /><div><b>{item.gate}</b><small>{item.system}</small></div><div className="gate-state"><span className={`status-pill ${item.state}`}>{toneLabel[item.state]}</span><small>{item.detail}</small></div></div>)}
              </div>
              <div className="readiness-note"><ShieldCheck size={18} /><span>Readiness is deterministic. Every state is backed by controlled evidence and review history.</span></div>
            </article>

            <article className="surface action-card" id="actions">
              <div className="section-heading"><div><p className="eyebrow">Action queue</p><h2>Needs attention</h2></div><Link className="text-button" href="/actions">All actions <ArrowUpRight size={15} /></Link></div>
              <div className="action-list">
                {data.actions.map((action) => <div className="action-row" key={action.id}><span className={`severity ${action.severity}`} /><div><b>{action.title}</b><small>{action.owner} · Due {action.due}</small></div></div>)}
              </div>
            </article>
          </section>

          <section className="two-column" id="sources">
            <article className="surface source-card">
              <div className="section-heading"><div><p className="eyebrow">Source library</p><h2>Recent controlled sources</h2></div><Link className="text-button" href="/sources">Open library <ArrowUpRight size={15} /></Link></div>
              <div className="table-wrap"><table><thead><tr><th>Source</th><th>Revision</th><th>Processing</th></tr></thead><tbody>{data.sources.map((source) => <tr key={source.id}><td>{source.firstRegionId ? <Link className="source-table-link" href={`/sources/regions/${source.firstRegionId}`}><b>{source.title}</b><small>{source.detail} · open first citation</small></Link> : <><b>{source.title}</b><small>{source.detail}</small></>}</td><td><span className="mono">{source.revision}</span></td><td><span className={`source-status ${source.status === "Processed" ? "processed" : "pending"}`}>{source.status}</span></td></tr>)}</tbody></table></div>
              <SourceUploadForm projectId={data.projectId} />
            </article>

            <article className="surface review-card" id="requirements">
              <div className="section-heading"><div><p className="eyebrow">Requirement review</p><h2>{data.proposal ? "One proposal needs you" : "Review queue clear"}</h2></div><span className="review-count">{data.proposal ? "01" : "00"}</span></div>
              {data.proposal ? <><div className="requirement"><span className="mono clause">Proposed requirement</span><div className="requirement-statement"><ListChecks size={18} aria-hidden="true" /><p>{data.proposal.statement}</p></div><div className="citation"><BookOpen size={15} /> {data.proposal.citation}</div></div><RequirementReviewActions requirement={{ id: data.proposal.id, statement: data.proposal.statement, numericValue: null, unit: null, tolerance: null }} acceptedTargets={[]} /></> : <p className="empty-copy">All extracted requirements have been reviewed.</p>}
            </article>
          </section>
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/"><Grid2X2 size={20} /><span>Home</span></Link><Link href="/knowledge"><Search size={20} /><span>Search</span></Link><Link href="/settings"><Menu size={20} /><span>More</span></Link></nav>
    </main>
  );
}
