export const dynamic = "force-dynamic";

import { UserButton } from "@clerk/nextjs";

export default function PendingAccessPage() {
  return <main className="clerk-pending-page">
    <section className="surface clerk-pending-card">
      <span className="clerk-pending-mark">P</span>
      <p className="eyebrow">Identity verified</p>
      <h1>Project access is pending.</h1>
      <p>Your Clerk account is active, but it has not been assigned to a Pramana project. Ask a project administrator to add your email, then refresh the application.</p>
      <div><UserButton showName userProfileMode="modal" /></div>
    </section>
  </main>;
}
