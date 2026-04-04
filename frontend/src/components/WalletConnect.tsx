interface Props {
  xrplAddress: string | null;
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletConnect({ xrplAddress, connected, loading, onConnect, onDisconnect }: Props) {
  if (connected && xrplAddress) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-gray-400 text-sm font-mono">{xrplAddress.slice(0, 8)}...{xrplAddress.slice(-6)}</span>
        <button onClick={onDisconnect} className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-4 rounded-lg">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button onClick={onConnect} disabled={loading} className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg">
      {loading ? "Connecting..." : "Connect with Xaman"}
    </button>
  );
}
