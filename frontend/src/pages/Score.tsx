import { useState } from "react";
import { useCreditScore } from "../hooks/useCreditScore";
import { usePosition } from "../hooks/usePosition";
import { ScoreDisplay } from "../components/ScoreDisplay";

interface Props {
  xrplAddress: string;
  personalAccount: `0x${string}` | null;
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
}

export function Score({ xrplAddress, personalAccount, sendPayment }: Props) {
  const { requestScore, requesting, error } = useCreditScore(sendPayment);
  const { position } = usePosition(personalAccount);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleRequestScore() {
    setLocalError(null);
    try {
      await requestScore(xrplAddress);
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : "Failed to request score");
    }
  }

  const hasScore = position && position.creditScore > 0n;

  return (
    <div>
      {/* Score monument */}
      {hasScore && (
        <div className="reveal">
          <ScoreDisplay score={Number(position.creditScore)} />
        </div>
      )}

      {/* Action module */}
      <div
        className={`veil-module reveal${hasScore ? " delay-1" : ""}`}
        style={{ marginTop: hasScore ? "48px" : "0" }}
      >
        {/* Section label */}
        <p className="section-num">
          {hasScore ? "II." : "I."}
        </p>

        <h2
          className="cormorant"
          style={{
            fontSize: "28px",
            fontWeight: 300,
            color: "var(--c-ink)",
            margin: "0 0 16px",
            lineHeight: 1.1,
          }}
        >
          {hasScore ? "Update your Score" : "Compute your Credit Score"}
        </h2>

        <p
          style={{
            fontSize: "12px",
            color: "var(--c-slate)",
            maxWidth: "480px",
            lineHeight: 1.75,
            margin: "0 0 40px",
          }}
        >
          Your banking data is processed privately inside a Trusted Execution
          Environment. Only the resulting score is published on-chain — raw
          financial data never touches the blockchain.
        </p>

        <button
          className="btn-veil"
          onClick={handleRequestScore}
          disabled={requesting}
        >
          <span>
            {requesting ? "Sign in Xaman\u2026" : "Compute Credit Score"}
          </span>
        </button>

        {(error || localError) && (
          <p className="error-text">{error || localError}</p>
        )}
      </div>
    </div>
  );
}
