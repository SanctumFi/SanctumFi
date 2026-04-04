interface Props {
  xrplAddress: string | null;
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletConnect({
  xrplAddress,
  connected,
  loading,
  onConnect,
  onDisconnect,
}: Props) {
  if (connected && xrplAddress) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <span className="wallet-chip">
          {xrplAddress.slice(0, 8)}&hellip;{xrplAddress.slice(-6)}
        </span>
        <button className="btn-ghost" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      className="btn-veil btn-veil-sm"
      onClick={onConnect}
      disabled={loading}
    >
      <span>{loading ? "Connecting\u2026" : "Connect Xaman"}</span>
    </button>
  );
}
