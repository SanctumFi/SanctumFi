const FEATURES = [
  {
    label: "FTSO V2",
    title: "Decentralised Price Feeds",
    body: "Real-time FLR and XRP price feeds without relying on Chainlink or any external oracle. Native to Flare, secured by the network itself.",
  },
  {
    label: "TEE Extension Registry",
    title: "Native Attested Computation",
    body: "Hardware attestation via Intel SGX / AMD SEV — no third-party bridge. The TEE Extension Registry makes sealed computation accessible to any smart contract.",
  },
  {
    label: "XRPL Integration",
    title: "6M Wallets, One Memo",
    body: "XRP holders interact with the protocol via payment memos. No Flare wallet required. SmartAccountReceiver maps each XRPL address and routes on-chain automatically.",
  },
  {
    label: "EVM Compatible",
    title: "Full Solidity Stack",
    body: "OpenZeppelin contracts, Forge tests, standard tooling. Build fast, deploy confidently. Coston2 testnet, live today.",
  },
];

export function WhyFlareSection() {
  return (
    <section id="flare" style={{ background: "var(--c-alabaster)" }} className="px-10 py-40">
      <div className="max-w-6xl mx-auto">

        <div className="sr flex items-center gap-6 mb-20">
          <span style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontSize: 13, color: "var(--c-stone)", letterSpacing: "0.12em" }}>05</span>
          <div style={{ flex: 1, height: 1, background: "var(--c-mist)" }} />
          <span className="label">Why Flare</span>
        </div>

        <h2 className="sr d1 mb-4" style={{
          fontFamily: "var(--f-display)",
          fontSize: "clamp(32px, 4vw, 56px)",
          fontWeight: 300,
          fontStyle: "italic",
          color: "var(--c-ink)",
          lineHeight: 1.1,
          maxWidth: 600,
        }}>
          The only chain where this is possible natively.
        </h2>
        <p className="sr d2 mb-20" style={{ fontFamily: "var(--f-body)", fontSize: 15, color: "var(--c-slate)", lineHeight: 1.7, maxWidth: 460 }}>
          We're not using Flare for the hackathon. We're building on Flare because only Flare has all of this in one place.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "var(--c-mist)" }}>
          {FEATURES.map(({ label, title, body }, i) => (
            <div
              key={label}
              className={`sr d${i + 1}`}
              style={{ background: "var(--c-alabaster)", padding: "48px 40px" }}
            >
              <div className="label" style={{ color: "var(--c-gold-dim)", marginBottom: 16 }}>{label}</div>
              <h3 style={{ fontFamily: "var(--f-display)", fontSize: 24, fontWeight: 400, color: "var(--c-ink)", lineHeight: 1.2, marginBottom: 16 }}>{title}</h3>
              <p style={{ fontFamily: "var(--f-body)", fontSize: 14, color: "var(--c-shadow)", lineHeight: 1.75 }}>{body}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
