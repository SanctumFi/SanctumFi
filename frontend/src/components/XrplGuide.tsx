export function XrplGuide() {
  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-white">XRPL Users</h2>
      <p className="text-gray-400">Access FlareScore directly from your XRPL wallet. Send XRP payments with action memos:</p>
      <div className="space-y-3">
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-orange-400 font-mono text-sm">Deposit Collateral</p>
          <p className="text-gray-300 text-sm mt-1">Send XRP to Smart Account address with memo: <code className="text-white">action=deposit</code></p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-orange-400 font-mono text-sm">Request Credit Score</p>
          <p className="text-gray-300 text-sm mt-1">Memo: <code className="text-white">action=score,token=&lt;encrypted_plaid_token&gt;</code></p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-orange-400 font-mono text-sm">Borrow</p>
          <p className="text-gray-300 text-sm mt-1">Memo: <code className="text-white">action=borrow,asset=FLR,amount=100</code></p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-orange-400 font-mono text-sm">Repay</p>
          <p className="text-gray-300 text-sm mt-1">Send XRP with memo: <code className="text-white">action=repay</code></p>
        </div>
      </div>
    </div>
  );
}
