const TIERS = [
  {
    name: "Platinum",
    range: "800–1000",
    ltv: "80%",
    collateral: "$80",
    freed: "$120 freed",
    multiplier: "2.5× more efficient",
    highlight: true,
  },
  {
    name: "Gold",
    range: "600–799",
    ltv: "120%",
    collateral: "$120",
    freed: "$80 freed",
    multiplier: "1.7× more efficient",
    highlight: false,
  },
  {
    name: "Silver",
    range: "400–599",
    ltv: "150%",
    collateral: "$150",
    freed: "$50 freed",
    multiplier: "Break-even",
    highlight: false,
  },
  {
    name: "Bronze",
    range: "0–399",
    ltv: "200%",
    collateral: "$200",
    freed: "Baseline",
    multiplier: "Standard DeFi",
    highlight: false,
  },
];

const FACTORS = [
  { label: "Balance Health", pts: 250, desc: "Buffer vs monthly spend" },
  { label: "Income Stability", pts: 250, desc: "Variance of monthly income" },
  { label: "Spending Discipline", pts: 250, desc: "Essential vs discretionary" },
  { label: "Account Age", pts: 250, desc: "Months of history (max 24)" },
];

export function TiersSection() {
  return (
    <section id="tiers" style={{ background: "#FFFFFF" }} className="px-10 py-40">
      <div className="max-w-6xl mx-auto">

        <div className="sr flex items-center gap-6 mb-20">
          <span style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontSize: 13, color: "var(--c-stone)", letterSpacing: "0.12em" }}>04</span>
          <div style={{ flex: 1, height: 1, background: "var(--c-mist)" }} />
          <span className="label">Credit Tiers</span>
        </div>

        <h2 className="sr d1 mb-4" style={{
          fontFamily: "var(--f-display)",
          fontSize: "clamp(32px, 4vw, 56px)",
          fontWeight: 300,
          color: "var(--c-ink)",
          lineHeight: 1.1,
        }}>
          Better score. Less collateral.
        </h2>
        <p className="sr d2 mb-20" style={{ fontFamily: "var(--f-body)", fontSize: 15, color: "var(--c-slate)", lineHeight: 1.7, maxWidth: 440 }}>
          A score from 0 to 1000 — computed in a sealed enclave across four equally weighted factors.
        </p>

        {/* Tier cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-px" style={{ background: "var(--c-mist)" }}>
          {TIERS.map(({ name, range, ltv, collateral, freed, multiplier, highlight }, i) => (
            <div
              key={name}
              className={`sr d${i + 1}`}
              style={{
                background: highlight ? "var(--c-ink)" : "var(--c-alabaster)",
                padding: "40px 28px",
              }}
            >
              <div style={{
                fontFamily: "var(--f-display)",
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: highlight ? "var(--c-gold)" : "var(--c-slate)",
                marginBottom: 20,
              }}>{name}</div>

              <div style={{
                fontFamily: "var(--f-display)",
                fontSize: 52,
                fontWeight: 300,
                lineHeight: 1,
                color: highlight ? "var(--c-gold)" : "var(--c-ink)",
                marginBottom: 4,
              }}>{ltv}</div>

              <div style={{
                fontFamily: "var(--f-body)",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: highlight ? "var(--c-stone)" : "var(--c-slate)",
                marginBottom: 28,
              }}>Loan-to-Value</div>

              <div style={{ height: 1, background: highlight ? "rgba(192,178,131,0.3)" : "var(--c-mist)", marginBottom: 24 }} />

              <div style={{ fontFamily: "var(--f-body)", fontSize: 13, color: highlight ? "var(--c-stone)" : "var(--c-shadow)", marginBottom: 6 }}>
                Score {range}
              </div>
              <div style={{ fontFamily: "var(--f-body)", fontSize: 13, color: highlight ? "var(--c-gold)" : "var(--c-gold-dim)", marginBottom: 4 }}>
                {freed}
              </div>
              <div style={{ fontFamily: "var(--f-body)", fontSize: 11, color: highlight ? "rgba(192,178,131,0.7)" : "var(--c-slate)", letterSpacing: "0.05em" }}>
                {multiplier}
              </div>
            </div>
          ))}
        </div>

        {/* Factor breakdown */}
        <div className="mt-24">
          <p className="sr label mb-10" style={{ color: "var(--c-stone)" }}>Scoring factors — computed inside the TEE</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {FACTORS.map(({ label, pts, desc }, i) => (
              <div key={label} className={`sr d${i + 1}`}>
                <div style={{ fontFamily: "var(--f-display)", fontSize: 32, fontWeight: 300, color: "var(--c-ink)", lineHeight: 1, marginBottom: 8 }}>{pts}</div>
                <div style={{ fontFamily: "var(--f-body)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--c-shadow)", marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--c-slate)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
