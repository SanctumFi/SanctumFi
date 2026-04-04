import { useState } from "react";
import { strToHex } from "../lib/hex";

type SendPaymentFn = (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;

export function useCreditScore(sendPayment: SendPaymentFn | null) {
  const [requesting, setRequesting] = useState(false);
  const [txResult, setTxResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestScore(xrplAddress: string) {
    if (!sendPayment) throw new Error("Not connected");
    setRequesting(true);
    setError(null);
    try {
      // HACKATHON DEMO: plaintext token for local TEE mode
      // Production: encrypt with TEE public key via ECIES before submission
      const payload = JSON.stringify({
        plaid_access_token: "access-sandbox-de3ce8ef-33f8-452c-a685-8671031fc0f6",
        user_address: xrplAddress,
      });
      const memoHex = strToHex(payload);
      const result = await sendPayment(memoHex, "1000000", "FlareScore: Compute Credit Score");
      setTxResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to request score");
    } finally {
      setRequesting(false);
    }
  }

  return { requestScore, requesting, txResult, error };
}
