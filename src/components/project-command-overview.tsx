import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileText,
  FolderKanban,
  GanttChartSquare,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { DashboardData } from "@/lib/dashboard-data";
import { ProjectAnalytics } from "@/components/project-analytics";

const stateLabel: Record<string, string> = {
  ready: "Ready",
  review: "In review",
  blocked: "Blocked",
  unknown: "Not assessed",
};

function shortId(id: string) {
  return id.slice(0, 6).toUpperCase();
}

export function ProjectCommandOverview({ data }: { data: DashboardData }) {
  const readiness = data.metrics.find((metric) => metric.label === "Gate readiness");
  const evidence = data.metrics.find((metric) => metric.label === "Accepted evidence");
  const work = data.metrics.find((metric) => metric.label === "Open actions");
  const currentGate = data.readiness.find((gate) => gate.state === "blocked" || gate.state === "review") ?? data.readiness.at(-1);
  const readinessNumber = Number.parseInt(readiness?.value ?? "0", 10) || 0;
  const datedTasks = data.timelineTasks.filter((task) => task.earliestStart && task.deadline);
  const timelineStart = datedTasks.length ? Math.min(...datedTasks.map((task) => new Date(task.earliestStart!).getTime())) : 0;
  const timelineEnd = datedTasks.length ? Math.max(...datedTasks.map((task) => new Date(task.deadline!).getTime())) : 0;
  const timelineSpan = Math.max(1, timelineEnd - timelineStart);

  return (
    <div className="pm-overview-layout">
      <section className="pm-overview-main">
        <section className="pm-summary-grid" aria-label="Project summary">
          <article><span><ShieldCheck size={16} /> Readiness</span><strong>{readiness?.value ?? "0%"}</strong><small>{readiness?.detail}</small></article>
          <article><span><FileArchive size={16} /> Evidence</span><strong>{evidence?.value ?? "0 / 0"}</strong><small>{evidence?.detail}</small></article>
          <article><span><FolderKanban size={16} /> Open issues</span><strong>{work?.value ?? "0"}</strong><small>{work?.detail}</small></article>
          <article><span><CalendarDays size={16} /> Attention gate</span><strong className="pm-summary-name">{currentGate?.gate ?? data.gate}</strong><small>{currentGate ? stateLabel[currentGate.state] : "Not configured"}</small></article>
        </section>

        {data.siteAnalysis && <section className="pm-site-analysis-card"><div><p className="eyebrow">Site analysis · planning basis</p><h2>{data.siteAnalysis.location}</h2><p>Target {data.siteAnalysis.targetItMw} MW IT · utility {data.siteAnalysis.utilityMw} MW · {data.siteAnalysis.cooling}</p></div><div><strong>{data.siteAnalysis.progress}%</strong><small>sections reviewed</small><Link href={"/site-analysis" as Route}>Open analysis <ArrowRight size={14} /></Link></div></section>}

        <ProjectAnalytics data={data} />

        <section className="pm-delivery-card">
          <header>
            <div><p className="eyebrow">Commissioning progression</p><h2>Gate delivery path</h2></div>
            <Link href="/readiness">Inspect readiness <ArrowRight size={15} /></Link>
          </header>
          <div className="pm-confidence-row">
            <span>Deterministic readiness</span>
            <strong className={currentGate?.state === "blocked" ? "is-risk" : ""}>{currentGate?.state === "blocked" ? "At risk" : currentGate?.state === "review" ? "Under review" : "On track"}</strong>
            <span>{readinessNumber}% gates ready</span>
          </div>
          <div className="pm-gate-flow">
            {data.insights.gateBars.map((gate, index) => (
              <Link href={`/readiness?gate=${gate.id}`} className={`pm-gate-step state-${gate.state}`} key={gate.id}>
                <span>L{index + 1}</span>
                <div><i style={{ width: `${Math.max(4, gate.percent)}%` }} /></div>
                <b>{gate.label}</b>
                <small>{stateLabel[gate.state]} · {gate.evidence} evidence</small>
              </Link>
            ))}
          </div>
          <footer><AlertTriangle size={16} /><span><b>{data.openIssueCount ? `${data.openIssueCount} open issue${data.openIssueCount === 1 ? "" : "s"}` : "No open issues"}</b> across the active project.</span><Link href="/actions">Review work queue</Link></footer>
        </section>

        <nav className="pm-project-tabs" aria-label="Project views">
          <Link className="is-active" href="/">Overview</Link>
          <Link href="/actions">Issues</Link>
          <Link href="/readiness">Readiness</Link>
          <Link href="/schedule">Timeline</Link>
          <Link href="/graph">Activity</Link>
        </nav>

        <section className="pm-overview-cards">
          <article>
            <h3>Current outcome</h3>
            <p>Advance <b>{data.gate}</b> only when controlled requirements, accepted evidence, and blocking findings agree.</p>
            <Link href="/brief">Open project brief <ArrowRight size={14} /></Link>
          </article>
          <article>
            <h3>Controlled scope</h3>
            <dl>
              <div><dt>Requirements</dt><dd>{data.insights.requirements.reduce((sum, item) => sum + item.value, 0)}</dd></div>
              <div><dt>Systems</dt><dd>{data.systems.length}</dd></div>
              <div><dt>Assets</dt><dd>{data.systems.reduce((sum, system) => sum + system.assetCount, 0)}</dd></div>
              <div><dt>Active alerts</dt><dd>{data.insights.operations.activeAlerts}</dd></div>
            </dl>
          </article>
          <article>
            <h3>Health note</h3>
            <p>{currentGate?.state === "blocked" ? `${currentGate.gate} cannot advance until its blocking work is resolved and readiness is recomputed.` : currentGate?.state === "review" ? `${currentGate.gate} is collecting and reviewing controlled proof.` : "No active gate blocker is reported by the deterministic readiness rules."}</p>
            <Link href="/command-center">Open alert center <ArrowRight size={14} /></Link>
          </article>
        </section>

        <section className="pm-project-brief-block">
          <p className="eyebrow">Project brief</p>
          <p><b>{data.project}</b> contains {data.systems.length} controlled system{data.systems.length === 1 ? "" : "s"}, {data.systems.reduce((sum, system) => sum + system.assetCount, 0)} registered asset{data.systems.reduce((sum, system) => sum + system.assetCount, 0) === 1 ? "" : "s"}, and {data.insights.requirements.reduce((sum, item) => sum + item.value, 0)} requirement record{data.insights.requirements.reduce((sum, item) => sum + item.value, 0) === 1 ? "" : "s"}. The current deterministic attention gate is <b>{currentGate?.gate ?? data.gate}</b>.</p>
        </section>

        <section className="pm-project-files">
          <header><div><p className="eyebrow">Controlled files</p><h2>Source register</h2></div><Link href="/sources">View all <ArrowRight size={14} /></Link></header>
          <div>{data.sources.slice(0, 6).map((source) => <Link href={source.firstRegionId ? `/sources/regions/${source.firstRegionId}` : "/sources"} key={source.id}><FileText size={19} /><span><b>{source.title}</b><small>Revision {source.revision} · {source.detail}</small></span><span className={`pm-status-chip ${source.status === "Processed" ? "status-open" : ""}`}>{source.status}</span></Link>)}{!data.sources.length && <p className="pm-empty">No controlled source file is stored.</p>}</div>
        </section>

        <section className="pm-timeline-preview">
          <header><div><p className="eyebrow">Delivery sequence</p><h2><GanttChartSquare size={18} /> Project timeline</h2></div><Link href="/schedule">Open schedule <ArrowRight size={14} /></Link></header>
          {datedTasks.length ? <div className="pm-mini-gantt"><div className="pm-mini-gantt-axis"><span>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(timelineStart))}</span><span>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(timelineEnd))}</span></div>{datedTasks.slice(0, 8).map((task) => { const start = new Date(task.earliestStart!).getTime(); const end = new Date(task.deadline!).getTime(); const left = ((start - timelineStart) / timelineSpan) * 100; const width = Math.max(3, ((end - start) / timelineSpan) * 100); return <Link href={`/schedule?task=${task.id}`} className="pm-mini-gantt-row" key={task.id}><span><b>{task.name}</b><small>{task.durationHours} h · {task.reviewState.replaceAll("_", " ")}</small></span><div><i style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} /></div></Link>; })}</div> : <p className="pm-empty">No scheduled task has both a start and deadline.</p>}
        </section>
      </section>

      <aside className="pm-context-rail">
        <section>
          <header><h2>Open issues</h2><Link href="/actions">View all</Link></header>
          <div className="pm-rail-list">
            {data.actions.slice(0, 5).map((action) => (
              <Link href={`/actions/${action.id}`} key={action.id}>
                <span className={`pm-priority-dot priority-${action.severity}`} />
                <div><b>{action.title}</b><small>{shortId(action.id)} · {action.owner} · due {action.due}</small></div>
                <span className={`pm-status-chip status-${action.status}`}>{action.status.replaceAll("_", " ")}</span>
              </Link>
            ))}
            {!data.actions.length && <p className="pm-empty"><CheckCircle2 size={18} /> No accountable work is open.</p>}
          </div>
        </section>

        <section>
          <header><h2><UsersRound size={18} /> Contributors</h2><span>{data.members.length}</span></header>
          <div className="pm-people-list">
            {data.members.slice(0, 5).map((member) => <div key={member.id}><span className="pm-avatar">{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span><p><b>{member.name}</b><small>{member.role.replaceAll("_", " ")}</small></p></div>)}
          </div>
          <Link className="pm-rail-button" href="/settings">Manage contributors <ArrowRight size={14} /></Link>
        </section>

        <section>
          <header><h2><Clock3 size={18} /> Project context</h2></header>
          <dl className="pm-context-list">
            <div><dt>Project code</dt><dd>{data.projectCode}</dd></div>
            <div><dt>Timezone</dt><dd>{data.projectTimezone}</dd></div>
            <div><dt>Schedule baseline</dt><dd>{data.insights.operations.scheduleVersion ? `Version ${data.insights.operations.scheduleVersion}` : "Not set"}</dd></div>
            <div><dt>Last updated</dt><dd>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(data.projectUpdatedAt))}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
