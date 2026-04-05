interface Props {
  onConnect: () => void;
  loading: boolean;
}

export function CtaSection({ onConnect, loading }: Props) {
  return (
    <section style={{ background: "var(--c-ink)" }} className="px-10 py-48">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">

        <div className="sr label mb-12" style={{ color: "var(--c-slate)", letterSpacing: "0.2em" }}>
          Flare Network · Coston2 · Live Today
        </div>

        <blockquote className="sr d1 mb-8" style={{
          fontFamily: "var(--f-display)",
          fontSize: "clamp(28px, 4vw, 56px)",
          fontWeight: 300,
          fontStyle: "italic",
          color: "var(--c-white)",
          lineHeight: 1.15,
        }}>
          "The question isn't whether this can be built.
          <br />
          <span style={{ color: "var(--c-gold)" }}>We already built it."</span>
        </blockquote>

        <p className="sr d2 mb-16" style={{
          fontFamily: "var(--f-body)",
          fontSize: 15,
          color: "var(--c-slate)",
          lineHeight: 1.7,
          maxWidth: 440,
        }}>
          Connect your wallet. Link your bank. Get a TEE-attested credit score and borrow at the collateral ratio your financial history earns you.
        </p>

        <div className="sr d4 mt-24" style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.06)" }} />

        <p className="sr d5 mt-10" style={{
          fontFamily: "var(--f-body)",
          fontSize: 12,
          color: "var(--c-shadow)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          SanctumFi — Your financial history, your borrowing power
        </p>

      </div>
    </section>
  );
}
