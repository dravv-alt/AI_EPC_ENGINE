import Link from "next/link";
import { ArrowLeft, Compass, LayoutDashboard } from "lucide-react";
import { NotFoundScene } from "@/components/not-found-scene";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-grid" aria-hidden="true" />
      <section className="not-found-copy">
        <Link href="/" className="not-found-brand" aria-label="Return to Pramana Cx overview"><span>P</span> pramana.cx</Link>
        <p className="not-found-kicker">Route resolution failed</p>
        <p className="not-found-code">404</p>
        <h1>This route drifted beyond the project graph.</h1>
        <p className="not-found-description">The controlled record may have moved, been removed, or never existed. No project data has been changed.</p>
        <nav className="not-found-actions" aria-label="Recovery options">
          <Link className="not-found-primary" href="/"><LayoutDashboard size={17} />Return to overview</Link>
          <Link className="not-found-secondary" href="/command-center"><Compass size={17} />Open command center</Link>
        </nav>
        <p className="not-found-note"><ArrowLeft size={14} />Use your browser’s back button to return to the previous controlled record.</p>
      </section>
      <section className="not-found-visual" aria-label="Abstract three-dimensional route-resolution illustration">
        <div className="not-found-halo" />
        <NotFoundScene />
        <p>Signal lost · context preserved</p>
      </section>
    </main>
  );
}
