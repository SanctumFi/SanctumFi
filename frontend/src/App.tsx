import { useState } from "react";
import { useXaman } from "./hooks/useXaman";
import { useSmartAccount } from "./hooks/useSmartAccount";
import { WalletConnect } from "./components/WalletConnect";
import { Dashboard } from "./pages/Dashboard";
import { Score } from "./pages/Score";
import { Lend } from "./pages/Lend";
import { LandingPage } from "./components/landing/LandingPage";
import { type CustomInstruction } from "./lib/smartAccounts";

type Tab = "dashboard" | "score" | "lend";

/* ── Grain texture overlay ── */
function GrainOverlay() {
  return (
    <div className="grain-overlay" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <filter id="veil-grain" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#veil-grain)" />
      </svg>
    </div>
  );
}

/* ── Connected app shell ── */
interface AppShellProps {
  tab: Tab;
  setTab: (t: Tab) => void;
  xrplAddress: string;
  personalAccount: `0x${string}` | null;
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
  sendCustom: (instructions: CustomInstruction[], label: string) => Promise<{ txHash: string; waitForExecution: () => Promise<void> }>;
  onDisconnect: () => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Overview" },
  { key: "score", label: "Credit Score" },
  { key: "lend", label: "Lend & Borrow" },
];

function AppShell({
  tab,
  setTab,
  xrplAddress,
  personalAccount,
  sendPayment,
  sendCustom,
  onDisconnect,
}: AppShellProps) {
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header className="veil-header reveal-fade">
        <span className="veil-wordmark">Veil</span>

        {/* Navigation */}
        <nav style={{ display: "flex", alignItems: "center" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`nav-tab${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Wallet */}
        <WalletConnect
          xrplAddress={xrplAddress}
          connected={true}
          loading={false}
          onConnect={() => {}}
          onDisconnect={onDisconnect}
        />
      </header>

      {/* Main content */}
      <main
        style={{
          maxWidth: "1040px",
          margin: "0 auto",
          padding: "64px 48px 96px",
        }}
      >
        {tab === "dashboard" && (
          <Dashboard personalAccount={personalAccount} />
        )}
        {tab === "score" && (
          <Score
            xrplAddress={xrplAddress}
            personalAccount={personalAccount}
          />
        )}
        {tab === "lend" && (
          <Lend personalAccount={personalAccount} sendCustom={sendCustom} />
        )}
      </main>
    </div>
  );
}

/* ── Root ── */
export default function App() {
  const { xumm, xrplAddress, connected, loading, connect, disconnect } = useXaman();
  const { personalAccount, sendPayment, sendCustom } = useSmartAccount(xumm, xrplAddress);
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <>
      <GrainOverlay />
      {connected && xrplAddress ? (
        <AppShell
          tab={tab}
          setTab={setTab}
          xrplAddress={xrplAddress}
          personalAccount={personalAccount}
          sendPayment={sendPayment}
          sendCustom={sendCustom}
          onDisconnect={disconnect}
        />
      ) : (
        <LandingPage onConnect={connect} loading={loading} />
      )}
    </>
  );
}
