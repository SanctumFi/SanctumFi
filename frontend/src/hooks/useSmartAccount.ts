import { useState, useEffect } from "react";
import { type Xumm } from "xumm";
import { type Address } from "viem";
import {
  getPersonalAccountAddress,
  getOperatorXrplAddresses,
  getInstructionFee,
  encodeCustomInstruction,
  isCustomInstructionRegistered,
  registerCustomInstruction,
  watchForExecution,
  type CustomInstruction,
} from "../lib/smartAccounts";

/** Deployer key for registering instructions (hackathon demo only). */
const DEPLOYER_KEY = "0x819a4345c69fc281b18df8e7141d8fa81c7151a4e3a60373609333329fe19817" as `0x${string}`;

export function useSmartAccount(xumm: Xumm, xrplAddress: string | null) {
  const [personalAccount, setPersonalAccount] = useState<Address | null>(null);
  const [operatorAddress, setOperatorAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!xrplAddress) { setPersonalAccount(null); return; }

    async function lookup() {
      try {
        const account = await getPersonalAccountAddress(xrplAddress!);
        setPersonalAccount(account);
      } catch (e) {
        console.error("Failed to lookup personal account:", e);
        setPersonalAccount(null);
      }

      try {
        const wallets = await getOperatorXrplAddresses();
        if (wallets.length > 0) setOperatorAddress(wallets[0]);
      } catch (e) {
        console.error("Failed to get operator address:", e);
      }
    }

    lookup();
  }, [xrplAddress]);

  /**
   * Send a custom instruction via XRPL payment through Xaman.
   *
   * 1. Register the instruction on Flare (if not already registered)
   * 2. Encode it into a 32-byte hash
   * 3. Get the instruction fee
   * 4. Send XRPL payment with the hash as MemoData via Xaman
   * 5. Watch for the CustomInstructionExecuted event
   */
  async function sendCustom(
    instructions: CustomInstruction[],
    label: string = "FlareScore transaction",
  ): Promise<{ txHash: string; waitForExecution: () => Promise<void> }> {
    if (!operatorAddress) throw new Error("No operator address");
    if (!personalAccount) throw new Error("No personal account");

    // 1. Register if needed
    const { registered } = await isCustomInstructionRegistered(instructions);
    if (!registered) {
      console.log("Registering custom instruction on Flare...");
      const regTx = await registerCustomInstruction(instructions, DEPLOYER_KEY);
      console.log("Registered:", regTx);
    }

    // 2. Encode
    const walletId = 0;
    const encoded = await encodeCustomInstruction(instructions, walletId);
    console.log("Encoded instruction:", encoded);

    // 3. Get fee (in drops)
    const feeDrops = await getInstructionFee(encoded);
    const feeXrp = Number(feeDrops) / 1_000_000;
    // Minimum 1 XRP if fee is 0
    const amountDrops = feeDrops > 0n ? String(feeDrops) : "1000000";
    console.log(`Instruction fee: ${feeXrp} XRP (${amountDrops} drops)`);

    // 4. Send via Xaman
    const payload = await xumm.payload?.create({
      txjson: {
        TransactionType: "Payment",
        Destination: operatorAddress,
        Amount: amountDrops,
        Memos: [{
          Memo: {
            MemoData: encoded.slice(2), // Remove 0x prefix
          },
        }],
      },
      options: {
        force_network: "TESTNET",
      },
      custom_meta: {
        instruction: label,
      },
    });

    if (!payload) throw new Error("Failed to create Xaman payload");

    const result = await xumm.payload?.subscribe(payload.uuid);
    const txHash = (result as any)?.payload?.response?.txid || "";
    console.log("XRPL payment sent:", txHash);

    // 5. Return a function to wait for Flare-side execution
    return {
      txHash,
      waitForExecution: () => new Promise<void>((resolve) => {
        watchForExecution(encoded, personalAccount, resolve);
      }),
    };
  }

  // Keep the old sendPayment for backward compat during migration
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
    return xumm.payload?.subscribe(payload.uuid);
  }

  return { personalAccount, operatorAddress, sendPayment, sendCustom };
}
