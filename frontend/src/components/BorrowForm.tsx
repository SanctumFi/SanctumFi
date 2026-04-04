import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACTS, CREDIT_VAULT_ABI } from "../config/contracts";

interface Props { provider: ethers.BrowserProvider; address: string; onSuccess: () => void; }

export function BorrowForm({ provider, address, onSuccess }: Props) {
  const [asset, setAsset] = useState<"FLR" | "FXRP">("FLR");
  const [amount, setAmount] = useState("");
  const [maxBorrow, setMaxBorrow] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchMax() {
    const vault = new ethers.Contract(CONTRACTS.creditVault, CREDIT_VAULT_ABI, provider);
    const assetAddr = asset === "FLR" ? ethers.ZeroAddress : CONTRACTS.fxrp;
    try { const max = await vault.getMaxBorrow.staticCall(address, assetAddr); setMaxBorrow(ethers.formatEther(max)); } catch { setMaxBorrow("0"); }
  }

  async function handleBorrow() {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONTRACTS.creditVault, CREDIT_VAULT_ABI, signer);
      const assetAddr = asset === "FLR" ? ethers.ZeroAddress : CONTRACTS.fxrp;
      await (await vault.borrow(assetAddr, ethers.parseEther(amount))).wait();
      setAmount(""); onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Borrow</h3>
      <div className="flex gap-2">
        <button onClick={() => { setAsset("FLR"); setMaxBorrow(null); }} className={`px-4 py-2 rounded ${asset === "FLR" ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300"}`}>FLR</button>
        <button onClick={() => { setAsset("FXRP"); setMaxBorrow(null); }} className={`px-4 py-2 rounded ${asset === "FXRP" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300"}`}>FXRP</button>
      </div>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-gray-800 text-white p-3 rounded" />
      <button onClick={fetchMax} className="text-orange-400 text-sm underline">Check max borrow {maxBorrow !== null && `(${Number(maxBorrow).toFixed(4)} ${asset})`}</button>
      <button onClick={handleBorrow} disabled={loading || !amount} className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold">
        {loading ? "Borrowing..." : `Borrow ${asset}`}
      </button>
    </div>
  );
}
