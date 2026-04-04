import { useState } from "react";
import { strToHex } from "../lib/hex";

interface Props {
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
  onSuccess: () => void;
}

export function RepayForm({ sendPayment, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRepay() {
    setLoading(true);
    try {
      const drops = (parseFloat(amount) * 1_000_000).toFixed(0);
      const memo = strToHex(`repay:${amount}`);
      await sendPayment(memo, drops, `FlareScore: Repay ${amount}`);
      setAmount(""); onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Repay</h3>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (XRP)" className="w-full bg-gray-800 text-white p-3 rounded" />
      <button onClick={handleRepay} disabled={loading || !amount} className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold">
        {loading ? "Sign in Xaman..." : "Repay"}
      </button>
    </div>
  );
}
