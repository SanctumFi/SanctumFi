import { Button } from "../ui/button";

const NAV_ITEMS = ["Markets", "Borrow", "Earn"];

type Tab = "dashboard" | "score" | "lend";

interface Props {
  onConnect: () => void;
  loading: boolean;
  // Connected-state props (optional)
  tab?: Tab;
  onTabChange?: (t: Tab) => void;
  tabs?: { key: Tab; label: string }[];
  xrplAddress?: string;
  onDisconnect?: () => void;
}

export function Navbar({ onConnect, loading, tab, onTabChange, tabs, xrplAddress, onDisconnect }: Props) {
  const isConnected = !!xrplAddress;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 py-6 px-10">
      <div className="flex flex-row items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/veil_logo.svg" alt="Veil" style={{ height: "80px", width: "auto", opacity: 0.85 }} />
          <span className="font-display text-6xl tracking-widest text-foreground italic">
            Veil
          </span>
        </div>

        {/* Center: tabs when connected, nav links when not */}
        <div className="hidden md:flex items-center gap-10">
          {isConnected && tabs ? (
            tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => onTabChange?.(t.key)}
                className={`text-lg tracking-widest uppercase font-body transition-opacity duration-200 border-b pb-0.5 ${
                  tab === t.key
                    ? "text-foreground border-foreground/40 opacity-100"
                    : "text-foreground/50 border-transparent hover:opacity-80"
                }`}
              >
                {t.label}
              </button>
            ))
          ) : (
            NAV_ITEMS.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-foreground/70 text-lg tracking-widest uppercase font-body transition-opacity duration-200 hover:opacity-100"
              >
                {item}
              </a>
            ))
          )}
        </div>

        {/* Right: wallet info or connect button */}
        {isConnected ? (
          <div className="flex items-center gap-6">
            <span className="font-body text-sm tracking-wide text-foreground/40">
              {xrplAddress.slice(0, 6)}…{xrplAddress.slice(-4)}
            </span>
            <Button
              variant="heroSecondary"
              size="default"
              className="px-6 py-3 text-sm tracking-widest uppercase"
              onClick={onDisconnect}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant="heroSecondary"
            size="default"
            className="px-8 py-3 text-base tracking-widest uppercase"
            onClick={onConnect}
            disabled={loading}
          >
            {loading ? "Connecting\u2026" : "Connect Wallet"}
          </Button>
        )}
      </div>

      {/* Ultra-thin divider */}
      <div className="mt-[10px] w-full h-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
    </nav>
  );
}
