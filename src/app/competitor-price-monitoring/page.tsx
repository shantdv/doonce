import Link from "next/link"

export default function CompetitorPriceMonitoringPage() {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="landing-inner">
          <p className="topline">DoOnce for competitor price monitoring</p>
          <h1>Record yourself checking competitor prices. Get a daily email report.</h1>
          <p>
            DoOnce turns one read-only browser demonstration into a monitored TracePack that runs every morning with screenshot evidence.
          </p>
          <div className="landing-actions">
            <Link className="button" href="/">Record a Monitor</Link>
            <a className="button secondary" href="mailto:founder@doonce.local?subject=DoOnce competitor price pilot">Book the $99 setup</a>
          </div>
        </div>
      </section>

      <section className="landing-band">
        <div className="landing-grid">
          <div className="landing-card">
            <h2>Show the check once</h2>
            <p>Open the competitor page, search the product, and land on the value you normally copy by hand.</p>
          </div>
          <div className="landing-card">
            <h2>Label the values</h2>
            <p>Mark price, stock, title, and URL. DoOnce compiles selectors and verification predicates into a TracePack.</p>
          </div>
          <div className="landing-card">
            <h2>Get the report</h2>
            <p>Every morning, the worker reruns the check and emails the extracted values with screenshot evidence.</p>
          </div>
        </div>
      </section>

      <section className="landing-band">
        <div className="landing-grid">
          <div>
            <p className="price-line">$99 setup + $29/month</p>
            <p className="muted">One monitored browser check, daily email report, manual repair during the pilot.</p>
          </div>
          <div>
            <h2>Built for no-API pages</h2>
            <p>Use it where Zapier cannot help: competitor storefronts, vendor portals, inventory pages, and listing sites.</p>
          </div>
          <div>
            <h2>Read-only first</h2>
            <p>No purchases, account changes, or form submissions in v0. The first product is monitoring, not blind automation.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
