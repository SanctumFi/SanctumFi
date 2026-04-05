import { useState } from "react";
import { parseEther, formatEther } from "viem";
import { buildRepayInstruction, type CustomInstruction } from "../lib/smartAccounts";

interface Props {
  sendCustom: (instructions: CustomInstruction[], label: string) => Promise<{ txHash: string; waitForExecution: () => Promise<void> }>;
  onSuccess: () => void;
  flrDebt: bigint;
}

export function RepayForm({ sendCustom, onSuccess, flrDebt }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleRepay() {
    setLoading(true);
    setStatus("");
    try {
      const amountWei = parseEther(amount);
      const instructions = buildRepayInstruction(amountWei);

      setStatus("Sign in Xaman...");
      const { waitForExecution } = await sendCustom(instructions, `Repay ${amount} FLR`);

      setStatus("Waiting for Flare execution (~180s)...");
      await waitForExecution();

      setAmount("");
      setStatus("Repay confirmed!");
      onSuccess();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
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
        Return FLR to reduce your outstanding debt and improve your health factor.
      </p>

      <div style={{ marginBottom: "24px", padding: "12px 0", borderTop: "1px solid var(--c-mist)", borderBottom: "1px solid var(--c-mist)" }}>
        <p className="field-label" style={{ marginBottom: "4px" }}>Outstanding Debt</p>
        <p style={{ fontSize: "18px", fontWeight: 400, color: flrDebt > 0n ? "var(--c-rose)" : "var(--c-ink)", margin: 0 }}>
          {Number(formatEther(flrDebt)).toFixed(4)} <span style={{ fontSize: "11px", color: "var(--c-stone)" }}>FLR</span>
        </p>
      </div>

      <div className="field-group">
        <label className="field-label">Amount (FLR)</label>
        <input
          type="number"
          className="field-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      {status && (
        <p style={{ fontSize: "11px", color: "var(--c-stone)", margin: "0 0 12px" }}>
          {status}
        </p>
      )}

      <button
        className="btn-veil btn-veil-full"
        onClick={handleRepay}
        disabled={loading || !amount}
      >
        <span>{loading ? "Processing\u2026" : "Repay"}</span>
      </button>
    </div>
  );
}
