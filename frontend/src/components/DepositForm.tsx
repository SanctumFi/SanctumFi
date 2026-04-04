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
      await sendPayment(memo, drops, `Veil: Deposit ${amount} XRP`);
      setAmount("");
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="veil-module">
      <p className="section-num">I.</p>
      <h3
        className="cormorant"
        style={{
          fontSize: "24px",
          fontWeight: 300,
          color: "var(--c-ink)",
          margin: "0 0 12px",
          lineHeight: 1.1,
        }}
      >
        Deposit
      </h3>
      <p
        style={{
          fontSize: "11px",
          color: "var(--c-stone)",
          lineHeight: 1.65,
          margin: "0 0 36px",
        }}
      >
        XRP sent via your XRPL wallet bridges as FXRP collateral.
      </p>

      <div className="field-group">
        <label className="field-label">Amount (XRP)</label>
        <input
          type="number"
          className="field-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <button
        className="btn-veil btn-veil-full"
        onClick={handleDeposit}
        disabled={loading || !amount}
      >
        <span>{loading ? "Sign in Xaman\u2026" : "Deposit"}</span>
      </button>
    </div>
  );
}
