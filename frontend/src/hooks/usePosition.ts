import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACTS, CREDIT_VAULT_ABI } from "../config/contracts";

export interface Position {
  creditScore: bigint;
  scoreTimestamp: bigint;
  flrCollateral: bigint;
  fxrpCollateral: bigint;
  flrDebt: bigint;
  fxrpDebt: bigint;
  healthFactor: bigint;
}

export function usePosition(provider: ethers.BrowserProvider | null, address: string | null) {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!provider || !address || !CONTRACTS.creditVault) return;
    setLoading(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.creditVault, CREDIT_VAULT_ABI, provider);
      const pos = await vault.positions(address);
      const [flrDebt, fxrpDebt] = await vault.getDebt.staticCall(address);
      const healthFactor = await vault.getHealthFactor.staticCall(address);

      setPosition({
        creditScore: pos.creditScore,
        scoreTimestamp: pos.scoreTimestamp,
        flrCollateral: pos.flrCollateral,
        fxrpCollateral: pos.fxrpCollateral,
        flrDebt,
        fxrpDebt,
        healthFactor,
      });
    } catch (e) {
      console.error("Failed to fetch position:", e);
    }
    setLoading(false);
  }, [provider, address]);

  useEffect(() => { refresh(); }, [refresh]);

  return { position, loading, refresh };
}
