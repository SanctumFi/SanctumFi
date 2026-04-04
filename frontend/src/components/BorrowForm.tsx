import { useState } from "react";
import { parseEther, formatEther, zeroAddress } from "viem";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, creditVaultAbi } from "../config/contracts";
import { buildBorrowInstruction, type CustomInstruction } from "../lib/smartAccounts";

interface Props {
  personalAccount: `0x${string}`;
  sendCustom: (instructions: CustomInstruction[], label: string) => Promise<{ txHash: string; waitForExecution: () => Promise<void> }>;
  onSuccess: () => void;
}

export function BorrowForm({ personalAccount, sendCustom, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [maxBorrow, setMaxBorrow] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

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
    setStatus("");
    try {
      const amountWei = parseEther(amount);
      const instructions = buildBorrowInstruction(zeroAddress, amountWei);

      setStatus("Sign in Xaman...");
      const { waitForExecution } = await sendCustom(instructions, `Borrow ${amount} FLR`);

      setStatus("Waiting for Flare execution (~180s)...");
      await waitForExecution();

      setAmount("");
      setStatus("Borrow confirmed!");
      onSuccess();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="veil-module">
      <p className="section-num">II.</p>
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
        Borrow
      </h3>
      <p
        style={{
          fontSize: "11px",
          color: "var(--c-stone)",
          lineHeight: 1.65,
          margin: "0 0 36px",
        }}
      >
        Borrow against your deposited collateral within your credit tier.
      </p>

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

      <div style={{ marginBottom: "28px" }}>
        <button className="btn-link" onClick={fetchMax}>
          {maxBorrow !== null
            ? `Max: ${Number(maxBorrow).toFixed(4)} FLR`
            : "Check max borrow"}
        </button>
      </div>

      {status && (
        <p style={{ fontSize: "11px", color: "var(--c-stone)", margin: "0 0 12px" }}>
          {status}
        </p>
      )}

      <button
        className="btn-veil btn-veil-full"
        onClick={handleBorrow}
        disabled={loading || !amount}
      >
        <span>{loading ? "Processing\u2026" : "Borrow"}</span>
      </button>
    </div>
  );
}
