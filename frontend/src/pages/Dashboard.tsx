import { usePosition } from "../hooks/usePosition";
import { usePrices } from "../hooks/usePrices";
import { PositionCard } from "../components/PositionCard";

interface Props { personalAccount: `0x${string}` | null; }

export function Dashboard({ personalAccount }: Props) {
  const { position, loading, refresh } = usePosition(personalAccount);
  const prices = usePrices();

  if (!personalAccount || personalAccount === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">Your Smart Account hasn't been created yet.</p>
        <p className="text-gray-500">It will be created on your first transaction.</p>
      </div>
    );
  }

  if (loading) return <p className="text-gray-400">Loading position...</p>;
  if (!position || position.creditScore === 0n) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No position yet.</p>
        <p className="text-gray-500">Get a credit score first, then deposit collateral to start borrowing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PositionCard position={position} prices={prices} />
      <button onClick={refresh} className="text-orange-400 text-sm underline">Refresh position</button>
    </div>
  );
}
