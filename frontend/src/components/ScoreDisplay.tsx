interface Props { score: number; }

export function ScoreDisplay({ score }: Props) {
  const tier = score >= 800 ? "Platinum" : score >= 600 ? "Gold" : score >= 400 ? "Silver" : "Bronze";
  const ltv = score >= 800 ? "80%" : score >= 600 ? "120%" : score >= 400 ? "150%" : "200%";
  const color = score >= 800 ? "text-purple-400" : score >= 600 ? "text-yellow-400" : score >= 400 ? "text-gray-300" : "text-orange-700";

  return (
    <div className="bg-gray-900 rounded-xl p-8 text-center">
      <p className="text-gray-400 text-sm mb-2">Your Credit Score</p>
      <p className={`text-6xl font-bold ${color}`}>{score}</p>
      <p className={`text-xl mt-2 ${color}`}>{tier} Tier</p>
      <p className="text-gray-400 mt-1">Collateral Ratio: {ltv}</p>
      <p className="text-gray-500 text-xs mt-4">Computed privately inside a TEE. Raw banking data never touched the blockchain.</p>
    </div>
  );
}
