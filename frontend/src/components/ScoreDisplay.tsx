interface Props { score: number; }

function tierMeta(score: number) {
  if (score >= 800) return { name: "Platinum", ltv: "80%",  cls: "tier-platinum" };
  if (score >= 600) return { name: "Gold",     ltv: "120%", cls: "tier-gold" };
  if (score >= 400) return { name: "Silver",   ltv: "150%", cls: "tier-silver" };
  return               { name: "Bronze",    ltv: "200%", cls: "tier-bronze" };
}

export function ScoreDisplay({ score }: Props) {
  const { name, ltv, cls } = tierMeta(score);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "40px",
        paddingBottom: "48px",
        borderBottom: "1px solid var(--c-mist)",
      }}
    >
      {/* Score monument */}
      <div>
        <p className="label" style={{ marginBottom: "12px" }}>
          Credit Score
        </p>
        <p
          className={`cormorant ${cls}`}
          style={{
            fontSize: "clamp(80px, 13vw, 160px)",
            fontWeight: 300,
            lineHeight: 0.88,
            margin: 0,
          }}
        >
          {score}
        </p>
      </div>

      {/* Tier metadata */}
      <div style={{ paddingBottom: "6px" }}>
        <p
          className={`cormorant ${cls}`}
          style={{
            fontSize: "28px",
            fontWeight: 300,
            fontStyle: "italic",
            lineHeight: 1,
            margin: "0 0 8px",
          }}
        >
          {name}
        </p>
        <p className="label">{ltv} LTV Ratio</p>
        <p
          style={{
            fontSize: "11px",
            color: "var(--c-stone)",
            marginTop: "12px",
            maxWidth: "280px",
            lineHeight: 1.6,
          }}
        >
          Attested privately inside a TEE.
          <br />
          Raw data never on-chain.
        </p>
      </div>
    </div>
  );
}
