const STEPS = [
  {
    n: "1",
    title: "Connect your bank",
    body: "Link via Plaid — 12,000+ institutions supported. Your encrypted token never touches the blockchain.",
  },
  {
    n: "2",
    title: "TEE computes your score",
    body: "A sealed hardware enclave privately fetches your data, runs the scoring algorithm across four factors, and destroys the raw data. Zero exposure.",
  },
  {
    n: "3",
    title: "Score attested on-chain",
    body: "The TEE cryptographically signs your score and posts it to CreditVault. Verifiable, tamper-proof, yours.",
  },
  {
    n: "4",
    title: "Borrow at your rate",
    body: "Deposit collateral. Borrow at the LTV your score earns. Platinum users are 2.5× more capital-efficient than anonymous DeFi borrowers.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how" style={{ background: "var(--c-alabaster)" }} className="px-10 py-40">
      <div className="max-w-6xl mx-auto">

        <div className="sr flex items-center gap-6 mb-20">
          <span style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontSize: 13, color: "var(--c-stone)", letterSpacing: "0.12em" }}>03</span>
          <div style={{ flex: 1, height: 1, background: "var(--c-mist)" }} />
          <span className="label">How It Works</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-0">
          <div>
            <h2 className="sr d1" style={{
              fontFamily: "var(--f-display)",
              fontSize: "clamp(32px, 4vw, 52px)",
              fontWeight: 300,
              fontStyle: "italic",
              color: "var(--c-ink)",
              lineHeight: 1.15,
              marginBottom: 24,
            }}>
              Connect. Score.<br />Borrow. Simple.
            </h2>
            <p className="sr d2" style={{ fontFamily: "var(--f-body)", fontSize: 15, color: "var(--c-slate)", lineHeight: 1.7, maxWidth: 380 }}>
              The full flow — wallet to bank to score to loan — works end to end. Your data stays sealed. Your rate reflects your history.
            </p>
          </div>

          <div style={{ position: "relative" }}>
            {STEPS.map(({ n, title, body }, i) => (
              <div
                key={n}
                className={`sr d${i + 1}`}
                style={{
                  display: "flex",
                  gap: 24,
                  paddingBottom: i < STEPS.length - 1 ? 40 : 0,
                  position: "relative",
                }}
              >
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div style={{
                    position: "absolute",
                    left: 18,
                    top: 36,
                    bottom: 0,
                    width: 1,
                    background: "var(--c-mist)",
                  }} />
                )}

                {/* Step number */}
                <div style={{
                  width: 36,
                  height: 36,
                  border: "1px solid var(--c-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: "var(--f-display)",
                  fontSize: 14,
                  color: "var(--c-gold)",
                  background: "var(--c-alabaster)",
                  position: "relative",
                  zIndex: 1,
                }}>
                  {n}
                </div>

                <div>
                  <h4 style={{ fontFamily: "var(--f-display)", fontSize: 20, fontWeight: 400, color: "var(--c-ink)", marginBottom: 8, lineHeight: 1.2 }}>{title}</h4>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 14, color: "var(--c-shadow)", lineHeight: 1.7 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
