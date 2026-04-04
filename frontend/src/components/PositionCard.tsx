import { formatEther } from "viem";
import type { Position } from "../hooks/usePosition";
import type { Prices } from "../hooks/usePrices";
import { HealthBar } from "./HealthBar";

interface Props { position: Position; prices: Prices | null; }

function tierName(score: bigint): string {
  const s = Number(score);
  if (s >= 800) return "Platinum"; if (s >= 600) return "Gold"; if (s >= 400) return "Silver"; return "Bronze";
}
function tierLtv(score: bigint): string {
  const s = Number(score);
  if (s >= 800) return "80%"; if (s >= 600) return "120%"; if (s >= 400) return "150%"; return "200%";
}

export function PositionCard({ position, prices }: Props) {
  const fmt = (v: bigint) => Number(formatEther(v)).toFixed(4);

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-white">Your Position</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 text-sm">Credit Score</p>
          <p className="text-2xl font-bold text-white">{position.creditScore.toString()}</p>
          <p className="text-orange-400 text-sm">{tierName(position.creditScore)} — {tierLtv(position.creditScore)} LTV</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Health Factor</p>
          <HealthBar value={position.healthFactor} />
        </div>
        <div>
          <p className="text-gray-400 text-sm">FLR Collateral</p>
          <p className="text-white">{fmt(position.flrCollateral)} FLR</p>
          {prices && <p className="text-gray-500 text-xs">${(Number(formatEther(position.flrCollateral)) * prices.flrUsd).toFixed(2)}</p>}
        </div>
        <div>
          <p className="text-gray-400 text-sm">FXRP Collateral</p>
          <p className="text-white">{fmt(position.fxrpCollateral)} FXRP</p>
          {prices && <p className="text-gray-500 text-xs">${(Number(formatEther(position.fxrpCollateral)) * prices.xrpUsd).toFixed(2)}</p>}
        </div>
        <div>
          <p className="text-gray-400 text-sm">FLR Debt</p>
          <p className="text-red-400">{fmt(position.flrDebt)} FLR</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">FXRP Debt</p>
          <p className="text-red-400">{fmt(position.fxrpDebt)} FXRP</p>
        </div>
      </div>
    </div>
  );
}
