import { useState } from "react";
import { parseEther, formatEther } from "viem";
import { buildDepositInstruction, type CustomInstruction } from "../lib/smartAccounts";

interface Props {
  sendCustom: (instructions: CustomInstruction[], label: string) => Promise<{ txHash: string; waitForExecution: () => Promise<void> }>;
  onSuccess: () => void;
  accountBalance: bigint;
}

export function DepositForm({ sendCustom, onSuccess, accountBalance }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleDeposit() {
    setLoading(true);
    setStatus("");
    try {
      const amountWei = parseEther(amount);
      const instructions = buildDepositInstruction(amountWei);

      setStatus("Sign in Xaman...");
      const { waitForExecution } = await sendCustom(instructions, `Deposit ${amount} FLR`);

      setStatus("Waiting for Flare execution (~180s)...");
      await waitForExecution();

      setAmount("");
      setStatus("Deposit confirmed!");
      onSuccess();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
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
        FLR deposited as collateral via your XRPL Smart Account.
      </p>

      <div style={{ marginBottom: "24px", padding: "12px 0", borderTop: "1px solid var(--c-mist)", borderBottom: "1px solid var(--c-mist)" }}>
        <p className="field-label" style={{ marginBottom: "4px" }}>Smart Account Balance</p>
        <p style={{ fontSize: "18px", fontWeight: 400, color: "var(--c-ink)", margin: 0 }}>
          {Number(formatEther(accountBalance)).toFixed(4)} <span style={{ fontSize: "11px", color: "var(--c-stone)" }}>FLR</span>
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
        onClick={handleDeposit}
        disabled={loading || !amount}
      >
        <span>{loading ? "Processing\u2026" : "Deposit"}</span>
      </button>
    </div>
  );
}
