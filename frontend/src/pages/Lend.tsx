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
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">You need a credit score first.</p>
        <p className="text-gray-500">Go to the Score tab to compute yours.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <DepositForm sendPayment={sendPayment} onSuccess={refresh} />
      <BorrowForm personalAccount={personalAccount!} sendPayment={sendPayment} onSuccess={refresh} />
      <RepayForm sendPayment={sendPayment} onSuccess={refresh} />
    </div>
  );
}
