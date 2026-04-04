import { useState } from "react";
import { ethers } from "ethers";
import { WalletConnect } from "./components/WalletConnect";
import { Dashboard } from "./pages/Dashboard";
import { Score } from "./pages/Score";
import { Lend } from "./pages/Lend";
import { Xrpl } from "./pages/Xrpl";

type Tab = "dashboard" | "score" | "lend" | "xrpl";

export default function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  function handleConnect(p: ethers.BrowserProvider, addr: string) {
    setProvider(p);
    setAddress(addr);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "score", label: "Credit Score" },
    { key: "lend", label: "Deposit & Borrow" },
    { key: "xrpl", label: "XRPL" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold"><span className="text-orange-500">Flare</span>Score</h1>
        <WalletConnect onConnect={handleConnect} />
      </header>
      {provider && address ? (
        <>
          <nav className="flex gap-1 px-6 pt-4">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-t-lg text-sm font-medium ${tab === t.key ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <main className="px-6 py-6 max-w-5xl mx-auto">
            {tab === "dashboard" && <Dashboard provider={provider} address={address} />}
            {tab === "score" && <Score provider={provider} address={address} />}
            {tab === "lend" && <Lend provider={provider} address={address} />}
            {tab === "xrpl" && <Xrpl />}
          </main>
        </>
      ) : (
        <main className="flex flex-col items-center justify-center py-24 px-6">
          <h2 className="text-4xl font-bold mb-4">Credit-Scored Lending on <span className="text-orange-500">Flare</span></h2>
          <p className="text-gray-400 text-lg mb-8 max-w-xl text-center">Get a TEE-attested credit score from your banking data. Borrow with tiered collateral ratios based on your financial health.</p>
          <WalletConnect onConnect={handleConnect} />
        </main>
      )}
    </div>
  );
}
