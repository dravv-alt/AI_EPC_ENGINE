import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return <main className="clerk-auth-page">
    <section className="clerk-auth-story">
      <Link className="clerk-auth-brand" href="/"><span>P</span>pramana<em>.cx</em></Link>
      <div><p className="eyebrow">Controlled project access</p><h1>Welcome back to the commissioning control room.</h1><p>Sign in to review live readiness, evidence, shipment risk, and the append-only project authority trail.</p></div>
      <small>Identity by Clerk · Project permissions remain enforced by Pramana.</small>
    </section>
    <section className="clerk-auth-panel">
      <div className="clerk-auth-heading"><p className="eyebrow">Secure session</p><h2>Sign in</h2><p>Use the account assigned to your project.</p></div>
      <SignIn signUpUrl="/sign-up" signUpForceRedirectUrl="/pending-access" fallbackRedirectUrl="/" />
      <p className="clerk-auth-switch">New to Pramana? <Link href={{ pathname: "/sign-up" }}>Create an account</Link></p>
    </section>
  </main>;
}
