import Link from "next/link";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const projectId = await getActiveProjectId();
  const data = await getDashboardData(projectId);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} projectId={projectId} eyebrow="Product guidance" title="Help" description="Quick paths for the controlled workflows used most often in this project.">
    <div className="workflow-grid">
      <article className="surface workflow-card"><h2>Authenticator codes</h2><p>Credentials-based approvers must enroll an authenticator before recording a gate decision. Open Profile, confirm your password, add the displayed account to an authenticator app, and verify its six-digit code.</p><Link className="button button-secondary" href="/profile">Open Profile security</Link></article>
      <article className="surface workflow-card"><h2>Knowledge search</h2><p>Searches exact controlled source regions. Every returned claim includes a citation link and match percentage; uncited answers are not shown.</p><Link className="button button-secondary" href="/knowledge">Open Knowledge</Link></article>
      <article className="surface workflow-card"><h2>Immutable turnover packs</h2><p>A pack can only be generated after an authorized approve or waive decision exists for the selected gate.</p><Link className="button button-secondary" href="/readiness">Review gate decisions</Link></article>
      <article className="surface workflow-card"><h2>Change assessment</h2><p>Blast-radius comparison needs two extracted versions of the same document. Upload a new revision under the same source title, then assess its latest version.</p><Link className="button button-secondary" href="/changes">Open Changes</Link></article>
    </div>
  </FeatureShell>;
}
