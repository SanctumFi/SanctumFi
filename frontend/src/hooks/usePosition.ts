import { useEffect, useState, useCallback } from "react";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, creditVaultAbi } from "../config/contracts";

export interface Position {
  creditScore: bigint;
  scoreTimestamp: bigint;
  flrCollateral: bigint;
  fxrpCollateral: bigint;
  flrDebt: bigint;
  fxrpDebt: bigint;
  healthFactor: bigint;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const MAX_UINT = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

export function usePosition(personalAccount: `0x${string}` | null) {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!personalAccount || personalAccount === ZERO_ADDR) return;
    setLoading(true);
    try {
      const pos = await publicClient.readContract({
        address: CONTRACTS.creditVault,
        abi: creditVaultAbi,
        functionName: "positions",
        args: [personalAccount],
      });

      const debtResult = await publicClient.readContract({
        address: CONTRACTS.creditVault,
        abi: creditVaultAbi,
        functionName: "getDebt",
        args: [personalAccount],
      }) as [bigint, bigint];

      let healthFactor = MAX_UINT;
      try {
        healthFactor = await publicClient.readContract({
          address: CONTRACTS.creditVault,
          abi: creditVaultAbi,
          functionName: "getHealthFactor",
          args: [personalAccount],
        }) as bigint;
      } catch { /* no debt = max health */ }

      setPosition({
        creditScore: pos[0],
        scoreTimestamp: pos[1],
        flrCollateral: pos[2],
        fxrpCollateral: pos[3],
        flrDebt: debtResult[0],
        fxrpDebt: debtResult[1],
        healthFactor,
      });
    } catch (e) {
      console.error("Failed to fetch position:", e);
    } finally {
      setLoading(false);
    }
  }, [personalAccount]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { position, loading, refresh };
}
