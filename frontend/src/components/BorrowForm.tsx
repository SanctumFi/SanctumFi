import { useState } from "react";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, creditVaultAbi } from "../config/contracts";
import { formatEther, zeroAddress } from "viem";

interface Props {
  personalAccount: `0x${string}`;
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
  onSuccess: () => void;
}

export function BorrowForm({ personalAccount, sendPayment, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [maxBorrow, setMaxBorrow] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchMax() {
    try {
      const max = await publicClient.readContract({
        address: CONTRACTS.creditVault,
        abi: creditVaultAbi,
        functionName: "getMaxBorrow",
        args: [personalAccount, zeroAddress],
      }) as bigint;
      setMaxBorrow(formatEther(max));
    } catch { setMaxBorrow("0"); }
  }

  async function handleBorrow() {
    setLoading(true);
    try {
      const memo = Buffer.from(`borrow:${amount}`).toString("hex");
      await sendPayment(memo, "1000000", `FlareScore: Borrow ${amount}`);
      setAmount(""); onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Borrow</h3>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-gray-800 text-white p-3 rounded" />
      <button onClick={fetchMax} className="text-orange-400 text-sm underline">Check max borrow {maxBorrow !== null && `(${Number(maxBorrow).toFixed(4)} FLR)`}</button>
      <button onClick={handleBorrow} disabled={loading || !amount} className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold">
        {loading ? "Sign in Xaman..." : "Borrow"}
      </button>
    </div>
  );
}
