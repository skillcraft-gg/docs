import Link from 'next/link'

export default function DocsLanding() {
  return (
    <section className="docs-shell">
      <div className="docs-hero">
        <div className="docs-hero-copy">
          <p className="docs-eyebrow">Skillcraft documentation</p>
          <h1 className="docs-hero-title">
            <span>You can build faster with AI.</span>
            <span className="docs-accent">You still need proof.</span>
          </h1>
          <p className="docs-lede">
            Skillcraft converts everyday git activity into verifiable capability evidence. Use these docs to wire your workflow,
            claim credentials, and publish meaningful AI-backed proof.
          </p>

          <div className="docs-cta-row">
            <Link href="getting-started" className="docs-btn docs-btn-primary">
              Get started
            </Link>
            <Link href="https://github.com/skillcraft-gg/skillcraft" className="docs-btn docs-btn-secondary" target="_blank" rel="noreferrer">
              Source repo
            </Link>
          </div>
        </div>

        <aside className="docs-side-stack" aria-label="Quick references">
          <section className="docs-panel">
            <p className="docs-panel-kicker">Quick start</p>
            <h2 className="docs-panel-title">CLI setup</h2>
            <p className="docs-panel-copy">
              Add Skillcraft to a project, enable tracking, and start producing evidence-backed progress.
            </p>
          </section>
          <section className="docs-panel">
            <p className="docs-panel-kicker">Claiming</p>
            <h2 className="docs-panel-title">Credentials</h2>
            <p className="docs-panel-copy">
              Learn how to package proofs and issue claims that can be shared across teams and roles.
            </p>
          </section>
        </aside>
      </div>
    </section>
  )
}
