import { ethers } from "ethers";
import { usePosition } from "../hooks/usePosition";
import { DepositForm } from "../components/DepositForm";
import { BorrowForm } from "../components/BorrowForm";
import { RepayForm } from "../components/RepayForm";

interface Props { provider: ethers.BrowserProvider; address: string; }

export function Lend({ provider, address }: Props) {
  const { position, refresh } = usePosition(provider, address);
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
      <DepositForm provider={provider} onSuccess={refresh} />
      <BorrowForm provider={provider} address={address} onSuccess={refresh} />
      <RepayForm provider={provider} onSuccess={refresh} />
    </div>
  );
}
