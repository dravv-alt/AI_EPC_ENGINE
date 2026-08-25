import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return <main className="clerk-auth-page">
    <section className="clerk-auth-story">
      <Link className="clerk-auth-brand" href="/"><span>P</span>pramana<em>.cx</em></Link>
      <div><p className="eyebrow">Controlled onboarding</p><h1>Create your secure project identity.</h1><p>Your Clerk account proves who you are. Access to projects and controlled actions is granted separately through Pramana memberships.</p></div>
      <small>Signing up does not automatically grant access to a project.</small>
    </section>
    <section className="clerk-auth-panel">
      <div className="clerk-auth-heading"><p className="eyebrow">New account</p><h2>Sign up</h2><p>Create an identity, then ask a project administrator for membership.</p></div>
      <SignUp
        signInUrl="/sign-in"
        forceRedirectUrl="/pending-access"
        appearance={{
          elements: {
            card: "pramana-clerk-card",
            header: "pramana-clerk-widget-header",
            headerTitle: "pramana-clerk-widget-title",
            headerSubtitle: "pramana-clerk-widget-subtitle",
            socialButtonsBlockButton: "pramana-clerk-social-button",
            formButtonPrimary: "pramana-clerk-primary-button",
            formFieldInput: "pramana-clerk-input",
            footerActionLink: "pramana-clerk-link",
            dividerLine: "pramana-clerk-divider",
            dividerText: "pramana-clerk-divider-text"
          }
        }}
      />
      <p className="clerk-auth-switch">Already registered? <Link href={{ pathname: "/sign-in" }}>Sign in</Link></p>
    </section>
  </main>;
}
