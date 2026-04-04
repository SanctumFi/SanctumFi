import { usePosition } from "../hooks/usePosition";
import { DepositForm } from "../components/DepositForm";
import { BorrowForm } from "../components/BorrowForm";
import { RepayForm } from "../components/RepayForm";

interface Props {
  personalAccount: `0x${string}` | null;
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
}

export function Lend({ personalAccount, sendPayment }: Props) {
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
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "1px",
        background: "var(--c-mist)",
        border: "1px solid var(--c-mist)",
      }}
    >
      <DepositForm sendPayment={sendPayment} onSuccess={refresh} />
      <BorrowForm
        personalAccount={personalAccount!}
        sendPayment={sendPayment}
        onSuccess={refresh}
      />
      <RepayForm sendPayment={sendPayment} onSuccess={refresh} />
    </div>
  );
}
