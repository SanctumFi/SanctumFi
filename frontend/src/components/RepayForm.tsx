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
      await sendPayment(memo, drops, `Veil: Repay ${amount}`);
      setAmount("");
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="veil-module">
      <p className="section-num">III.</p>
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
        Repay
      </h3>
      <p
        style={{
          fontSize: "11px",
          color: "var(--c-stone)",
          lineHeight: 1.65,
          margin: "0 0 36px",
        }}
      >
        Return XRP to reduce your outstanding debt and improve your health factor.
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
        onClick={handleRepay}
        disabled={loading || !amount}
      >
        <span>{loading ? "Sign in Xaman\u2026" : "Repay"}</span>
      </button>
    </div>
  );
}
