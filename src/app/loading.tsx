export default function Loading() {
  return <main className="app-shell route-loading-shell" aria-busy="true" aria-label="Loading workspace">
    <aside className="sidebar route-loading-sidebar"><div className="loading-brand" /><div className="loading-nav" /><div className="loading-nav short" /><div className="loading-nav" /><div className="loading-nav short" /></aside>
    <section className="workspace"><div className="route-loading-topbar"><span /><span /></div><div className="content route-loading-content"><div className="loading-kicker" /><div className="loading-title" /><div className="loading-copy" /><div className="loading-grid"><div /><div /><div /></div><div className="loading-panel" /></div></section>
  </main>;
}
