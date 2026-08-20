export const dynamic = "force-dynamic";

import { UserButton } from "@clerk/nextjs";
import { clerkKeysConfigured } from "@/lib/env";

export default function PendingAccessPage() {
  return <main className="clerk-pending-page">
    <section className="surface clerk-pending-card">
      <span className="clerk-pending-mark">P</span>
      <p className="eyebrow">Identity verified</p>
      <h1>Project access is pending.</h1>
      <p>Your Clerk account is active, but it has not been assigned to a Pramana project. Ask a project administrator to add your email, then refresh the application.</p>
      {clerkKeysConfigured ? <div><UserButton showName userProfileMode="modal" /></div> : <p className="field-help">Development authentication is active. Configure Clerk keys to manage this account here.</p>}
    </section>
  </main>;
}
