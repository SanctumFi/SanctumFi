import { useEffect, useState, useCallback } from "react";
import { formatEther, zeroAddress } from "viem";
import { usePosition } from "../hooks/usePosition";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, creditVaultAbi } from "../config/contracts";
import { DepositForm } from "../components/DepositForm";
import { BorrowForm } from "../components/BorrowForm";
import { RepayForm } from "../components/RepayForm";
import { WithdrawForm } from "../components/WithdrawForm";
import { type CustomInstruction } from "../lib/smartAccounts";

interface Props {
  personalAccount: `0x${string}` | null;
  sendCustom: (instructions: CustomInstruction[], label: string) => Promise<{ txHash: string; waitForExecution: () => Promise<void> }>;
}

export function Lend({ personalAccount, sendCustom }: Props) {
  const { position, refresh: refreshPosition } = usePosition(personalAccount);
  const [accountBalance, setAccountBalance] = useState<bigint>(0n);
  const [maxBorrow, setMaxBorrow] = useState<bigint>(0n);

  const refreshAll = useCallback(async () => {
    await refreshPosition();
    if (personalAccount) {
      try {
        const bal = await publicClient.getBalance({ address: personalAccount });
        setAccountBalance(bal);
      } catch { setAccountBalance(0n); }
      try {
        const max = await publicClient.readContract({
          address: CONTRACTS.creditVault,
          abi: creditVaultAbi,
          functionName: "getMaxBorrow",
          args: [personalAccount, zeroAddress],
        }) as bigint;
        setMaxBorrow(max);
      } catch { setMaxBorrow(0n); }
    }
  }, [personalAccount, refreshPosition]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 15_000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const hasScore = position && position.creditScore > 0n;

  if (!hasScore) {
    return (
      <div className="state-message reveal">
        <p>Score required</p>
        <p>
          Navigate to Credit Score to compute yours before lending.
        </p>
      </div>
    );
  }

  return (
    <div
      className="reveal"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "1px",
        background: "var(--c-mist)",
        border: "1px solid var(--c-mist)",
      }}
    >
      <DepositForm sendCustom={sendCustom} onSuccess={refreshAll} accountBalance={accountBalance} />
      <BorrowForm
        sendCustom={sendCustom}
        onSuccess={refreshAll}
        maxBorrow={maxBorrow}
      />
      <RepayForm sendCustom={sendCustom} onSuccess={refreshAll} flrDebt={position.flrDebt} />
      <WithdrawForm sendCustom={sendCustom} onSuccess={refreshAll} flrCollateral={position.flrCollateral} />
    </div>
  );
}
