export function SolutionSection() {
  const pillars = [
    {
      n: "01",
      title: "Privacy-Preserving Scoring",
      sub: "Trusted Execution Environment",
      body: "Your bank token goes encrypted into a sealed hardware enclave — not even we can see it. The TEE fetches 90 days of data, computes your score across four dimensions, and signs the result cryptographically. Raw data is gone. What remains on-chain is a verifiable attestation.",
    },
    {
      n: "02",
      title: "Score-Based Collateral",
      sub: "Your history, your rate",
      body: "A score from 0 to 1000 determines your loan-to-value ratio. Platinum borrowers lock $80 to borrow $100. Bronze borrowers lock $200. Same contract, same code — different outcomes based on trust earned from financial behaviour.",
    },
    {
      n: "03",
      title: "Flare-Native Infrastructure",
      sub: "Built for the network, not bolted on",
      body: "FTSO V2 provides decentralised price feeds for FLR and XRP. The XRPL connection lets 6 million XRP wallets interact via payment memos — no Flare wallet required. This is native integration, not a bridge hack.",
    },
  ];

  return (
    <section id="solution" style={{ background: "#FFFFFF" }} className="px-10 py-40">
      <div className="max-w-6xl mx-auto">

        <div className="sr flex items-center gap-6 mb-20">
          <span style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontSize: 13, color: "var(--c-stone)", letterSpacing: "0.12em" }}>02</span>
          <div style={{ flex: 1, height: 1, background: "var(--c-mist)" }} />
          <span className="label">The Solution</span>
        </div>

        <h2 className="sr d1 mb-4" style={{
          fontFamily: "var(--f-display)",
          fontSize: "clamp(32px, 4vw, 56px)",
          fontWeight: 300,
          color: "var(--c-ink)",
          lineHeight: 1.1,
          maxWidth: 640,
        }}>
          Three pieces working together.
        </h2>
        <p className="sr d2 mb-20" style={{ fontFamily: "var(--f-body)", fontSize: 15, color: "var(--c-slate)", maxWidth: 480, lineHeight: 1.7 }}>
          Credit scoring for DeFi — without exposing your banking data to anyone.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          {pillars.map(({ n, title, sub, body }, i) => (
            <div key={n} className={`sr d${i + 2}`}>
              <div style={{ height: 1, background: "var(--c-gold)", marginBottom: 32, width: 40 }} />
              <div style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontSize: 13, color: "var(--c-stone)", letterSpacing: "0.1em", marginBottom: 16 }}>{n}</div>
              <h3 style={{ fontFamily: "var(--f-display)", fontSize: 26, fontWeight: 400, color: "var(--c-ink)", lineHeight: 1.2, marginBottom: 8 }}>{title}</h3>
              <div className="label" style={{ marginBottom: 20, color: "var(--c-gold-dim)" }}>{sub}</div>
              <p style={{ fontFamily: "var(--f-body)", fontSize: 14, color: "var(--c-shadow)", lineHeight: 1.75 }}>{body}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
