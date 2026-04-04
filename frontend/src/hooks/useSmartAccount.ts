import { useState, useEffect } from "react";
import type { Xumm } from "xumm";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, masterAccountControllerAbi } from "../config/contracts";

export function useSmartAccount(xumm: Xumm, xrplAddress: string | null) {
  const [personalAccount, setPersonalAccount] = useState<`0x${string}` | null>(null);
  const [operatorAddress, setOperatorAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!xrplAddress) { setPersonalAccount(null); return; }

    async function lookup() {
      try {
        const account = await publicClient.readContract({
          address: CONTRACTS.masterAccountController,
          abi: masterAccountControllerAbi,
          functionName: "getPersonalAccount",
          args: [xrplAddress!],
        }) as `0x${string}`;
        setPersonalAccount(account);
      } catch (e) {
        console.error("Failed to lookup personal account:", e);
        setPersonalAccount(null);
      }

      try {
        const wallets = await publicClient.readContract({
          address: CONTRACTS.masterAccountController,
          abi: masterAccountControllerAbi,
          functionName: "getXrplProviderWallets",
          args: [],
        }) as string[];
        if (wallets.length > 0) setOperatorAddress(wallets[0]);
      } catch (e) {
        console.error("Failed to get operator address:", e);
      }
    }

    lookup();
  }, [xrplAddress]);

  async function sendPayment(memo: string, amountDrops: string = "1000000", instruction?: string) {
    if (!operatorAddress) throw new Error("No operator address");

    const payload = await xumm.payload?.create({
      txjson: {
        TransactionType: "Payment",
        Destination: operatorAddress,
        Amount: amountDrops,
        Memos: [{
          Memo: {
            MemoData: memo,
          },
        }],
      },
      options: {
        force_network: "TESTNET",
      },
      custom_meta: {
        instruction: instruction || "FlareScore transaction",
      },
    });

    if (!payload) throw new Error("Failed to create payload");

    const result = await xumm.payload?.subscribe(payload.uuid);
    return result;
  }

  return { personalAccount, operatorAddress, sendPayment };
}
