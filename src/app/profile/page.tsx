import { FeatureShell } from "@/components/feature-shell";
import { ProfilePanel } from "@/components/profile-panel";
import { getDashboardData } from "@/lib/dashboard-data";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";
export default async function ProfilePage() { const data = await getDashboardData(await getActiveProjectId()); if (!data) throw new Error("Project not found"); return <FeatureShell projectName={data.project} eyebrow="Your authority" title="Profile" description="Identity, project memberships, and multi-factor status come from the persisted authorization boundary."><ProfilePanel /></FeatureShell>; }
