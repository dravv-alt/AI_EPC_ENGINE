import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData(await getActiveProjectId());
  if (!data) throw new Error("The development project is not seeded. Run npm run db:seed.");
  return <DashboardShell data={data} />;
}
