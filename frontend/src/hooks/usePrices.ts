import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { CONTRACTS, FTSOV2_ABI, FLR_USD_FEED_ID, XRP_USD_FEED_ID } from "../config/contracts";

export interface Prices {
  flrUsd: number;
  xrpUsd: number;
  timestamp: number;
}

export function usePrices(provider: ethers.BrowserProvider | null) {
  const [prices, setPrices] = useState<Prices | null>(null);

  useEffect(() => {
    if (!provider) return;
    async function fetchPrices() {
      try {
        const ftso = new ethers.Contract(CONTRACTS.ftsoV2, FTSOV2_ABI, provider);
        const feedIds = [FLR_USD_FEED_ID, XRP_USD_FEED_ID];
        const [values, decimals, timestamp] = await ftso.getFeedsById.staticCall(feedIds);
        const flrUsd = Number(values[0]) / 10 ** Number(decimals[0]);
        const xrpUsd = Number(values[1]) / 10 ** Number(decimals[1]);
        setPrices({ flrUsd, xrpUsd, timestamp: Number(timestamp) });
      } catch (e) {
        console.error("Failed to fetch FTSO prices:", e);
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 10_000);
    return () => clearInterval(interval);
  }, [provider]);

  return prices;
}
