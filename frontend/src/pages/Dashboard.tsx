import { usePosition } from "../hooks/usePosition";
import { usePrices } from "../hooks/usePrices";
import { PositionCard } from "../components/PositionCard";

interface Props { personalAccount: `0x${string}` | null; }

export function Dashboard({ personalAccount }: Props) {
  const { position, loading, refresh } = usePosition(personalAccount);
  const prices = usePrices();

  if (
    !personalAccount ||
    personalAccount === "0x0000000000000000000000000000000000000000"
  ) {
    return (
      <div className="state-message reveal">
        <p>Account not yet initialised</p>
        <p>It will activate on your first transaction.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="state-message reveal">
        <p style={{ fontStyle: "italic" }}>Loading position&hellip;</p>
        <p>&nbsp;</p>
      </div>
    );
  }

  if (!position || position.creditScore === 0n) {
    return (
      <div className="state-message reveal">
        <p>No position yet</p>
        <p>
          Obtain a credit score, then deposit collateral to begin borrowing.
        </p>
      </div>
    );
  }

  return (
    <div className="reveal">
      <PositionCard position={position} prices={prices} />
      <div style={{ marginTop: "32px", textAlign: "right" }}>
        <button className="btn-link" onClick={refresh}>
          Refresh
        </button>
      </div>
    </div>
  );
}
