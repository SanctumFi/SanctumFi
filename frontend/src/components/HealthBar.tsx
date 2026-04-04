import { formatEther } from "viem";

interface Props { value: bigint; }

export function HealthBar({ value }: Props) {
  const hf = Number(formatEther(value));
  const isMax = hf > 100;
  const display = isMax ? "\u221e" : hf.toFixed(2);
  const fillClass = hf < 1.0 ? "is-danger" : hf < 1.5 ? "is-warning" : "";
  const fillWidth = isMax ? 100 : Math.min(100, (hf / 3) * 100);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <p className="label">Health Factor</p>
        <p
          className="cormorant"
          style={{
            fontSize: "28px",
            fontWeight: 300,
            lineHeight: 1,
            color:
              hf < 1
                ? "var(--c-danger)"
                : hf < 1.5
                ? "#C0A870"
                : "var(--c-gold)",
          }}
        >
          {display}
        </p>
      </div>
      <div className="health-track">
        <div
          className={`health-fill ${fillClass}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
    </div>
  );
}
