import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACTS, CREDIT_VAULT_ABI } from "../config/contracts";

interface Props { provider: ethers.BrowserProvider; onSuccess: () => void; }

export function DepositForm({ provider, onSuccess }: Props) {
  const [asset, setAsset] = useState<"FLR" | "FXRP">("FLR");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDeposit() {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONTRACTS.creditVault, CREDIT_VAULT_ABI, signer);
      const value = ethers.parseEther(amount);
      if (asset === "FLR") {
        await (await vault.depositFLR({ value })).wait();
      } else {
        const fxrp = new ethers.Contract(CONTRACTS.fxrp, ["function approve(address,uint256) returns (bool)"], signer);
        await (await fxrp.approve(CONTRACTS.creditVault, value)).wait();
        await (await vault.depositFXRP(value)).wait();
      }
      setAmount("");
      onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Deposit Collateral</h3>
      <div className="flex gap-2">
        <button onClick={() => setAsset("FLR")} className={`px-4 py-2 rounded ${asset === "FLR" ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300"}`}>FLR</button>
        <button onClick={() => setAsset("FXRP")} className={`px-4 py-2 rounded ${asset === "FXRP" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300"}`}>FXRP</button>
      </div>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-gray-800 text-white p-3 rounded" />
      <button onClick={handleDeposit} disabled={loading || !amount} className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold">
        {loading ? "Depositing..." : `Deposit ${asset}`}
      </button>
    </div>
  );
}
