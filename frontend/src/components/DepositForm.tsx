import { useState } from "react";
import { strToHex } from "../lib/hex";

interface Props {
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
  onSuccess: () => void;
}

export function DepositForm({ sendPayment, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDeposit() {
    setLoading(true);
    try {
      const drops = (parseFloat(amount) * 1_000_000).toFixed(0);
      const memo = strToHex(`deposit:${amount}`);
      await sendPayment(memo, drops, `FlareScore: Deposit ${amount} XRP`);
      setAmount("");
      onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Deposit Collateral</h3>
      <p className="text-gray-500 text-xs">Send XRP via your XRPL wallet. It will be bridged as FXRP collateral.</p>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (XRP)" className="w-full bg-gray-800 text-white p-3 rounded" />
      <button onClick={handleDeposit} disabled={loading || !amount} className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold">
        {loading ? "Sign in Xaman..." : "Deposit XRP"}
      </button>
    </div>
  );
}
