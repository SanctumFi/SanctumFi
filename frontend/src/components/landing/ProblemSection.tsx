export function ProblemSection() {
  return (
    <section id="problem" style={{ background: "#F7F6F4" }} className="px-10 py-40">
      <div className="max-w-6xl mx-auto">

        {/* Section label */}
        <div className="sr flex items-center gap-6 mb-20">
          <span style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontSize: 13, color: "var(--c-stone)", letterSpacing: "0.12em" }}>01</span>
          <div style={{ flex: 1, height: 1, background: "var(--c-mist)" }} />
          <span className="label">The Problem</span>
        </div>

        {/* Editorial quote */}
        <blockquote className="sr d1 mb-24" style={{
          fontFamily: "var(--f-display)",
          fontSize: "clamp(36px, 5vw, 72px)",
          fontWeight: 300,
          fontStyle: "italic",
          lineHeight: 1.1,
          color: "var(--c-ink)",
          maxWidth: 900,
        }}>
          "DeFi lends to no one.<br />It only releases funds held hostage."
        </blockquote>

        {/* Three pain points */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: "var(--c-mist)" }}>
          {[
            {
              stat: "150–200%",
              label: "Collateral required",
              body: "To borrow $100 on Aave or Compound, you must first lock up $150–200. That's not lending — that's a savings account with extra steps.",
            },
            {
              stat: "∞",
              label: "Anonymous risk",
              body: "Every user is treated as an anonymous stranger. Since the protocol can't know your history, it assumes the worst — and you pay for everyone else's unknown risk.",
            },
            {
              stat: "$B",
              label: "Capital trapped",
              body: "Billions locked in idle collateral pools that could be deployed elsewhere. Most DeFi users have banking histories the protocol simply ignores.",
            },
          ].map(({ stat, label, body }, i) => (
            <div
              key={label}
              className={`sr d${i + 2}`}
              style={{ background: "var(--c-alabaster)", padding: "40px 36px" }}
            >
              <div style={{
                fontFamily: "var(--f-display)",
                fontSize: 56,
                fontWeight: 300,
                lineHeight: 1,
                color: "var(--c-gold)",
                marginBottom: 12,
              }}>{stat}</div>
              <div className="label" style={{ marginBottom: 16 }}>{label}</div>
              <p style={{ fontFamily: "var(--f-body)", fontSize: 14, color: "var(--c-shadow)", lineHeight: 1.7 }}>{body}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
