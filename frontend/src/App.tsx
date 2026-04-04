import { useState, useEffect, useCallback } from "react";
import { useXaman } from "./hooks/useXaman";
import { useSmartAccount } from "./hooks/useSmartAccount";
import { WalletConnect } from "./components/WalletConnect";
import { Dashboard } from "./pages/Dashboard";
import { Score } from "./pages/Score";
import { Lend } from "./pages/Lend";

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

/* ── Landing page with floating veil layers ── */
interface LandingProps {
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
}

function Landing({ connected, loading, onConnect }: LandingProps) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMouse({
      x: (e.clientX / window.innerWidth - 0.5) * 30,
      y: (e.clientY / window.innerHeight - 0.5) * 30,
    });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Floating veil layers with mouse parallax */}
      <div
        className="veil-layer veil-layer-1"
        style={{
          transform: `translate(${mouse.x * 0.4}px, ${mouse.y * 0.4}px)`,
        }}
      />
      <div
        className="veil-layer veil-layer-2"
        style={{
          transform: `translate(${mouse.x * -0.25}px, ${mouse.y * -0.25}px)`,
        }}
      />
      <div
        className="veil-layer veil-layer-3"
        style={{
          transform: `translate(${mouse.x * 0.6}px, ${mouse.y * 0.15}px)`,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          textAlign: "center",
          padding: "0 24px",
          maxWidth: "700px",
        }}
      >
        {/* Brand */}
        <h1
          className="reveal cormorant"
          style={{
            fontSize: "clamp(96px, 18vw, 220px)",
            fontWeight: 300,
            fontStyle: "italic",
            letterSpacing: "0.04em",
            color: "var(--c-ink)",
            margin: 0,
            lineHeight: 0.88,
          }}
        >
          Veil
        </h1>

        {/* Tagline */}
        <p
          className="reveal delay-1"
          style={{
            fontFamily: "var(--f-body)",
            fontSize: "9px",
            fontWeight: 400,
            letterSpacing: "0.38em",
            textTransform: "uppercase",
            color: "var(--c-slate)",
            marginTop: "32px",
            marginBottom: 0,
          }}
        >
          Credit-scored lending on Flare
        </p>

        {/* Descriptor */}
        <p
          className="reveal delay-2"
          style={{
            fontFamily: "var(--f-body)",
            fontSize: "12px",
            fontWeight: 300,
            color: "var(--c-stone)",
            marginTop: "16px",
            maxWidth: "360px",
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.7,
          }}
        >
          Connect your XRPL wallet. Receive a TEE-attested credit score.
          Borrow against tiered collateral ratios — no EVM wallet required.
        </p>

        {/* CTA */}
        <div
          className="reveal delay-3"
          style={{ marginTop: "52px" }}
        >
          <button
            className="btn-veil"
            onClick={onConnect}
            disabled={loading || connected}
          >
            <span>{loading ? "Connecting\u2026" : "Enter with Xaman"}</span>
          </button>
        </div>

        {/* Bottom decorative rule */}
        <div
          className="reveal-fade delay-4"
          style={{
            width: "1px",
            height: "64px",
            background: "var(--c-stone)",
            margin: "64px auto 0",
            opacity: 0.5,
          }}
        />
      </div>
    </main>
  );
}

/* ── Connected app shell ── */
interface AppShellProps {
  tab: Tab;
  setTab: (t: Tab) => void;
  xrplAddress: string;
  personalAccount: `0x${string}` | null;
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
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
            sendPayment={sendPayment}
          />
        )}
        {tab === "lend" && (
          <Lend personalAccount={personalAccount} sendPayment={sendPayment} />
        )}
      </main>
    </div>
  );
}

/* ── Root ── */
export default function App() {
  const { xumm, xrplAddress, connected, loading, connect, disconnect } =
    useXaman();
  const { personalAccount, sendPayment } = useSmartAccount(xumm, xrplAddress);
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
          onDisconnect={disconnect}
        />
      ) : (
        <Landing connected={connected} loading={loading} onConnect={connect} />
      )}
    </>
  );
}
