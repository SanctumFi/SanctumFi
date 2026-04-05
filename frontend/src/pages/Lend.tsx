import { usePosition } from "../hooks/usePosition";
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
  const { position, refresh } = usePosition(personalAccount);
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
      <DepositForm sendCustom={sendCustom} onSuccess={refresh} />
      <BorrowForm
        personalAccount={personalAccount!}
        sendCustom={sendCustom}
        onSuccess={refresh}
      />
      <RepayForm sendCustom={sendCustom} onSuccess={refresh} />
      <WithdrawForm sendCustom={sendCustom} onSuccess={refresh} />
    </div>
  );
}
