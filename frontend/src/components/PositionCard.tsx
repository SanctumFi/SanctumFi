import { formatEther } from "viem";
import type { Position } from "../hooks/usePosition";
import type { Prices } from "../hooks/usePrices";
import { HealthBar } from "./HealthBar";

interface Props { position: Position; prices: Prices | null; }

function tierMeta(score: bigint) {
  const s = Number(score);
  if (s >= 800) return { name: "Platinum", ltv: "80%",  cls: "tier-platinum" };
  if (s >= 600) return { name: "Gold",     ltv: "120%", cls: "tier-gold" };
  if (s >= 400) return { name: "Silver",   ltv: "150%", cls: "tier-silver" };
  return               { name: "Bronze",   ltv: "200%", cls: "tier-bronze" };
}

export function PositionCard({ position, prices }: Props) {
  const fmt = (v: bigint) => Number(formatEther(v)).toFixed(4);
  const { name, ltv, cls } = tierMeta(position.creditScore);

  return (
    <div>
      {/* ── Score + tier ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "40px",
          paddingBottom: "48px",
        }}
      >
        <div>
          <p className="label" style={{ marginBottom: "12px" }}>
            Credit Score
          </p>
          <p
            className={`cormorant ${cls}`}
            style={{
              fontSize: "clamp(72px, 11vw, 140px)",
              fontWeight: 300,
              lineHeight: 0.88,
              margin: 0,
            }}
          >
            {position.creditScore.toString()}
          </p>
        </div>

        <div style={{ paddingBottom: "4px" }}>
          <p
            className={`cormorant ${cls}`}
            style={{
              fontSize: "24px",
              fontWeight: 300,
              fontStyle: "italic",
              lineHeight: 1,
              margin: "0 0 6px",
            }}
          >
            {name}
          </p>
          <p className="label">{ltv} LTV</p>
        </div>
      </div>

      {/* ── Health factor ── */}
      <HealthBar value={position.healthFactor} />

      {/* ── Divider ── */}
      <hr className="veil-rule" style={{ margin: "40px 0" }} />

      {/* ── Position grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "32px",
        }}
      >
        {/* FLR Collateral */}
        <div className="data-row">
          <p className="label">FLR Collateral</p>
          <p className="data-val-md" style={{ marginTop: "8px" }}>
            {fmt(position.flrCollateral)}
          </p>
          <p className="data-sub">FLR</p>
          {prices && (
            <p className="data-sub">
              ${(Number(formatEther(position.flrCollateral)) * prices.flrUsd).toFixed(2)}
            </p>
          )}
        </div>

        {/* FXRP Collateral */}
        <div className="data-row">
          <p className="label">FXRP Collateral</p>
          <p className="data-val-md" style={{ marginTop: "8px" }}>
            {fmt(position.fxrpCollateral)}
          </p>
          <p className="data-sub">FXRP</p>
          {prices && (
            <p className="data-sub">
              ${(Number(formatEther(position.fxrpCollateral)) * prices.xrpUsd).toFixed(2)}
            </p>
          )}
        </div>

        {/* FLR Debt */}
        <div className="data-row">
          <p className="label">FLR Debt</p>
          <p
            className="data-val-md"
            style={{ marginTop: "8px", color: "var(--c-danger)" }}
          >
            {fmt(position.flrDebt)}
          </p>
          <p className="data-sub">FLR</p>
        </div>

        {/* FXRP Debt */}
        <div className="data-row">
          <p className="label">FXRP Debt</p>
          <p
            className="data-val-md"
            style={{ marginTop: "8px", color: "var(--c-danger)" }}
          >
            {fmt(position.fxrpDebt)}
          </p>
          <p className="data-sub">FXRP</p>
        </div>
      </div>
    </div>
  );
}
