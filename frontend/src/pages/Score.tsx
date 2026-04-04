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
    <div className="space-y-6">
      {hasScore && <ScoreDisplay score={Number(position.creditScore)} />}
      <div className="bg-gray-900 rounded-xl p-6 text-center space-y-4">
        <h3 className="text-lg font-bold text-white">{hasScore ? "Update Your Score" : "Get Your Credit Score"}</h3>
        <p className="text-gray-400 text-sm">Your banking data is processed privately inside a Trusted Execution Environment. Only the score is published onchain.</p>
        <button onClick={handleRequestScore} disabled={requesting} className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white py-3 px-8 rounded-lg font-bold">
          {requesting ? "Sign in Xaman..." : "Compute Credit Score"}
        </button>
        {(error || localError) && <p className="text-red-400 text-sm">{error || localError}</p>}
      </div>
    </div>
  );
}
