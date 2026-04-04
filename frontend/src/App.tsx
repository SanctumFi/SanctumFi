import { useState } from "react";
import { useXaman } from "./hooks/useXaman";
import { useSmartAccount } from "./hooks/useSmartAccount";
import { WalletConnect } from "./components/WalletConnect";
import { Dashboard } from "./pages/Dashboard";
import { Score } from "./pages/Score";
import { Lend } from "./pages/Lend";

type Tab = "dashboard" | "score" | "lend";

export default function App() {
  const { xumm, xrplAddress, connected, loading, connect, disconnect } = useXaman();
  const { personalAccount, sendPayment } = useSmartAccount(xumm, xrplAddress);
  const [tab, setTab] = useState<Tab>("dashboard");

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "score", label: "Credit Score" },
    { key: "lend", label: "Deposit & Borrow" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold"><span className="text-orange-500">Flare</span>Score</h1>
        <WalletConnect
          xrplAddress={xrplAddress}
          connected={connected}
          loading={loading}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      </header>
      {connected && xrplAddress ? (
        <>
          <nav className="flex gap-1 px-6 pt-4">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-t-lg text-sm font-medium ${tab === t.key ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <main className="px-6 py-6 max-w-5xl mx-auto">
            {tab === "dashboard" && <Dashboard personalAccount={personalAccount} />}
            {tab === "score" && <Score xrplAddress={xrplAddress} personalAccount={personalAccount} sendPayment={sendPayment} />}
            {tab === "lend" && <Lend personalAccount={personalAccount} sendPayment={sendPayment} />}
          </main>
        </>
      ) : (
        <main className="flex flex-col items-center justify-center py-24 px-6">
          <h2 className="text-4xl font-bold mb-4">Credit-Scored Lending on <span className="text-orange-500">Flare</span></h2>
          <p className="text-gray-400 text-lg mb-8 max-w-xl text-center">Connect your XRPL wallet to get a TEE-attested credit score. Borrow with tiered collateral ratios — no EVM wallet needed.</p>
          <WalletConnect
            xrplAddress={xrplAddress}
            connected={connected}
            loading={loading}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </main>
      )}
    </div>
  );
}
