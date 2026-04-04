import { useEffect, useState } from "react";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, ftsoV2Abi, FLR_USD_FEED_ID, XRP_USD_FEED_ID } from "../config/contracts";

export interface Prices {
  flrUsd: number;
  xrpUsd: number;
  timestamp: number;
}

export function usePrices() {
  const [prices, setPrices] = useState<Prices | null>(null);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const result = await publicClient.readContract({
          address: CONTRACTS.ftsoV2,
          abi: ftsoV2Abi,
          functionName: "getFeedsById",
          args: [[FLR_USD_FEED_ID, XRP_USD_FEED_ID]],
        });

        const [values, decimals, timestamp] = result as [bigint[], number[], bigint];
        const flrUsd = Number(values[0]) * Math.pow(10, -Number(decimals[0]));
        const xrpUsd = Number(values[1]) * Math.pow(10, -Number(decimals[1]));
        setPrices({ flrUsd, xrpUsd, timestamp: Number(timestamp) });
      } catch (e) {
        console.error("Failed to fetch FTSO prices:", e);
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 10_000);
    return () => clearInterval(interval);
  }, []);

  return prices;
}
