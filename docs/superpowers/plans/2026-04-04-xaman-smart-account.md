# Xaman + Smart Account Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MetaMask with Xaman (XRPL wallet) so all user actions go through XRPL Payment memos → Flare Smart Accounts.

**Architecture:** Xaman SDK handles wallet connection + transaction signing. A public viem client reads Flare chain state (positions, prices). The user's XRPL address maps to a Flare personal account via MasterAccountController. All write operations (score, deposit, borrow, repay) are encoded as Custom Instructions and sent as XRPL Payment memos.

**Tech Stack:** React, xumm (Xaman SDK), viem (Flare reads), xrpl (address utils), TailwindCSS

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/flareClient.ts` | Public viem client for Flare chain reads |
| Create | `src/hooks/useXaman.ts` | Xaman SDK connection lifecycle |
| Create | `src/hooks/useSmartAccount.ts` | Personal account lookup + instruction encoding + sending |
| Rewrite | `src/components/WalletConnect.tsx` | Xaman connect/disconnect UI |
| Rewrite | `src/hooks/usePosition.ts` | viem-based position reads |
| Rewrite | `src/hooks/usePrices.ts` | viem-based FTSO reads |
| Rewrite | `src/hooks/useCreditScore.ts` | Score request via XRPL memo |
| Rewrite | `src/App.tsx` | New state model (xrplAddress, personalAccount) |
| Rewrite | `src/pages/Dashboard.tsx` | Remove ethers prop, use new hooks |
| Rewrite | `src/pages/Score.tsx` | Score via Smart Account instruction |
| Rewrite | `src/pages/Lend.tsx` | Remove ethers prop |
| Rewrite | `src/components/DepositForm.tsx` | Deposit via Smart Account instruction |
| Rewrite | `src/components/BorrowForm.tsx` | Borrow via Smart Account instruction |
| Rewrite | `src/components/RepayForm.tsx` | Repay via Smart Account instruction |
| Update | `src/config/contracts.ts` | Add MasterAccountController ABI, remove InstructionSender |
| Update | `src/config/chains.ts` | Add XRPL testnet config |
| Update | `package.json` | Add xumm + viem, remove ethers |
| Delete | XRPL tab / page | No longer needed — XRPL is the primary flow |

---

### Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install new deps, remove ethers**

```bash
cd frontend
npm install xumm viem
npm uninstall ethers
```

- [ ] **Step 2: Verify build still works (will have errors — that's expected)**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: TypeScript errors about missing ethers — confirms ethers is removed.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "swap ethers for xumm and viem"
```

---

### Task 2: Flare public client + chain config

**Files:**
- Create: `frontend/src/lib/flareClient.ts`
- Modify: `frontend/src/config/chains.ts`

- [ ] **Step 1: Update chains.ts with XRPL testnet config**

```typescript
export const coston2 = {
  chainId: 114,
  chainIdHex: "0x72",
  name: "Flare Testnet Coston2",
  rpcUrl: "https://coston2-api.flare.network/ext/C/rpc",
  blockExplorer: "https://coston2-explorer.flare.network",
  nativeCurrency: {
    name: "Coston2 FLR",
    symbol: "C2FLR",
    decimals: 18,
  },
};

export const xrplTestnet = {
  wssUrl: "wss://s.altnet.rippletest.net:51233",
  name: "XRPL Testnet",
};
```

- [ ] **Step 2: Create flareClient.ts**

```typescript
import { createPublicClient, http, defineChain } from "viem";

export const flareTestnet = defineChain({
  id: 114,
  name: "Flare Testnet Coston2",
  nativeCurrency: { name: "Coston2 FLR", symbol: "C2FLR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://coston2-api.flare.network/ext/C/rpc"] },
  },
  blockExplorers: {
    default: { name: "Coston2 Explorer", url: "https://coston2-explorer.flare.network" },
  },
});

export const publicClient = createPublicClient({
  chain: flareTestnet,
  transport: http(),
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/flareClient.ts src/config/chains.ts
git commit -m "add viem public client and XRPL testnet config"
```

---

### Task 3: Contract config update

**Files:**
- Modify: `frontend/src/config/contracts.ts`

- [ ] **Step 1: Rewrite contracts.ts with viem ABIs**

Replace the entire file. Add MasterAccountController address and ABIs. Keep CreditVault ABI (converted to viem format). Remove INSTRUCTION_SENDER_ABI. Keep FTSO ABI.

```typescript
import { type Abi } from "viem";

export const CONTRACTS = {
  creditVault: import.meta.env.VITE_CREDIT_VAULT_ADDRESS as `0x${string}` || "0x",
  smartAccountReceiver: import.meta.env.VITE_SMART_ACCOUNT_RECEIVER_ADDRESS as `0x${string}` || "0x",
  masterAccountController: "0x434936d47503353f06750Db1A444DBDC5F0AD37c" as `0x${string}`,
  ftsoV2: "0x3d893C53D9e8056135C26C8c638B76C8b60Df726" as `0x${string}`,
  fxrp: import.meta.env.VITE_FXRP_ADDRESS as `0x${string}` || "0x",
};

export const creditVaultAbi = [
  { type: "function", name: "positions", inputs: [{ type: "address" }], outputs: [
    { name: "creditScore", type: "uint256" }, { name: "scoreTimestamp", type: "uint256" },
    { name: "flrCollateral", type: "uint256" }, { name: "fxrpCollateral", type: "uint256" },
    { name: "flrDebt", type: "uint256" }, { name: "fxrpDebt", type: "uint256" },
    { name: "flrBorrowTimestamp", type: "uint256" }, { name: "fxrpBorrowTimestamp", type: "uint256" },
  ], stateMutability: "view" },
  { type: "function", name: "getDebt", inputs: [{ type: "address" }], outputs: [
    { name: "flrDebt", type: "uint256" }, { name: "fxrpDebt", type: "uint256" },
  ], stateMutability: "view" },
  { type: "function", name: "getHealthFactor", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "getMaxBorrow", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "getLtvBps", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "pure" },
] as const satisfies Abi;

export const masterAccountControllerAbi = [
  { type: "function", name: "getPersonalAccount", inputs: [{ type: "string" }], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "getXrplProviderWallets", inputs: [], outputs: [{ type: "string[]" }], stateMutability: "view" },
] as const satisfies Abi;

export const ftsoV2Abi = [
  { type: "function", name: "getFeedById", inputs: [{ type: "bytes21" }], outputs: [
    { type: "uint256" }, { type: "int8" }, { type: "uint64" },
  ], stateMutability: "payable" },
  { type: "function", name: "getFeedsById", inputs: [{ type: "bytes21[]" }], outputs: [
    { type: "uint256[]" }, { type: "int8[]" }, { type: "uint64" },
  ], stateMutability: "payable" },
] as const satisfies Abi;

export const FLR_USD_FEED_ID = "0x01464c522f55534400000000000000000000000000" as `0x${string}`;
export const XRP_USD_FEED_ID = "0x015852502f55534400000000000000000000000000" as `0x${string}`;
```

- [ ] **Step 2: Commit**

```bash
git add src/config/contracts.ts
git commit -m "convert contract config to viem ABIs, add MasterAccountController"
```

---

### Task 4: Xaman hook

**Files:**
- Create: `frontend/src/hooks/useXaman.ts`

- [ ] **Step 1: Create useXaman hook**

```typescript
import { useState, useEffect, useCallback } from "react";
import { Xumm } from "xumm";

const XAMAN_API_KEY = import.meta.env.VITE_XAMAN_API_KEY || "";

let xummInstance: Xumm | null = null;

function getXumm(): Xumm {
  if (!xummInstance) {
    xummInstance = new Xumm(XAMAN_API_KEY);
  }
  return xummInstance;
}

export function useXaman() {
  const [xrplAddress, setXrplAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const xumm = getXumm();
    // Check if already authorized
    xumm.environment.ready.then(() => {
      if (xumm.runtime?.xapp) {
        // Running inside Xaman xApp
        xumm.environment.ott?.then((ott) => {
          if (ott?.account) {
            setXrplAddress(ott.account);
            setConnected(true);
          }
        });
      }
    });
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const xumm = getXumm();
      await xumm.authorize();
      const account = xumm.runtime?.jwt?.sub || null;
      if (account) {
        setXrplAddress(account);
        setConnected(true);
      }
    } catch (e) {
      console.error("Xaman connect failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const xumm = getXumm();
    await xumm.logout();
    setXrplAddress(null);
    setConnected(false);
  }, []);

  return { xumm: getXumm(), xrplAddress, connected, loading, connect, disconnect };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useXaman.ts
git commit -m "add Xaman SDK connection hook"
```

---

### Task 5: Smart Account hook

**Files:**
- Create: `frontend/src/hooks/useSmartAccount.ts`

- [ ] **Step 1: Create useSmartAccount hook**

```typescript
import { useState, useEffect } from "react";
import type { Xumm } from "xumm";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, masterAccountControllerAbi } from "../config/contracts";

export function useSmartAccount(xumm: Xumm, xrplAddress: string | null) {
  const [personalAccount, setPersonalAccount] = useState<`0x${string}` | null>(null);
  const [operatorAddress, setOperatorAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!xrplAddress) { setPersonalAccount(null); return; }

    async function lookup() {
      try {
        const account = await publicClient.readContract({
          address: CONTRACTS.masterAccountController,
          abi: masterAccountControllerAbi,
          functionName: "getPersonalAccount",
          args: [xrplAddress!],
        }) as `0x${string}`;
        setPersonalAccount(account);
      } catch (e) {
        console.error("Failed to lookup personal account:", e);
        setPersonalAccount(null);
      }

      try {
        const wallets = await publicClient.readContract({
          address: CONTRACTS.masterAccountController,
          abi: masterAccountControllerAbi,
          functionName: "getXrplProviderWallets",
          args: [],
        }) as string[];
        if (wallets.length > 0) setOperatorAddress(wallets[0]);
      } catch (e) {
        console.error("Failed to get operator address:", e);
      }
    }

    lookup();
  }, [xrplAddress]);

  async function sendPayment(memo: string, amountDrops: string = "1000000", instruction?: string) {
    if (!operatorAddress) throw new Error("No operator address");

    const payload = await xumm.payload?.create({
      txjson: {
        TransactionType: "Payment",
        Destination: operatorAddress,
        Amount: amountDrops,
        Memos: [{
          Memo: {
            MemoData: memo,
          },
        }],
      },
      options: {
        force_network: "TESTNET",
      },
      custom_meta: {
        instruction: instruction || "FlareScore transaction",
      },
    });

    if (!payload) throw new Error("Failed to create payload");

    // The SDK opens Xaman for signing. Wait for resolution.
    const result = await xumm.payload?.subscribe(payload.uuid);
    return result;
  }

  return { personalAccount, operatorAddress, sendPayment };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSmartAccount.ts
git commit -m "add Smart Account hook with personal account lookup and payment sending"
```

---

### Task 6: Rewrite read hooks (usePosition, usePrices)

**Files:**
- Rewrite: `frontend/src/hooks/usePosition.ts`
- Rewrite: `frontend/src/hooks/usePrices.ts`

- [ ] **Step 1: Rewrite usePosition.ts with viem**

```typescript
import { useEffect, useState, useCallback } from "react";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, creditVaultAbi } from "../config/contracts";

export interface Position {
  creditScore: bigint;
  scoreTimestamp: bigint;
  flrCollateral: bigint;
  fxrpCollateral: bigint;
  flrDebt: bigint;
  fxrpDebt: bigint;
  healthFactor: bigint;
}

export function usePosition(personalAccount: `0x${string}` | null) {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!personalAccount || personalAccount === "0x0000000000000000000000000000000000000000") return;
    setLoading(true);
    try {
      const pos = await publicClient.readContract({
        address: CONTRACTS.creditVault,
        abi: creditVaultAbi,
        functionName: "positions",
        args: [personalAccount],
      });

      const [flrDebt, fxrpDebt] = await publicClient.readContract({
        address: CONTRACTS.creditVault,
        abi: creditVaultAbi,
        functionName: "getDebt",
        args: [personalAccount],
      }) as [bigint, bigint];

      let healthFactor = 0n;
      try {
        healthFactor = await publicClient.readContract({
          address: CONTRACTS.creditVault,
          abi: creditVaultAbi,
          functionName: "getHealthFactor",
          args: [personalAccount],
        }) as bigint;
      } catch { /* no debt = max health */ healthFactor = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"); }

      setPosition({
        creditScore: pos[0],
        scoreTimestamp: pos[1],
        flrCollateral: pos[2],
        fxrpCollateral: pos[3],
        flrDebt,
        fxrpDebt,
        healthFactor,
      });
    } catch (e) {
      console.error("Failed to fetch position:", e);
    } finally {
      setLoading(false);
    }
  }, [personalAccount]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { position, loading, refresh };
}
```

- [ ] **Step 2: Rewrite usePrices.ts with viem**

```typescript
import { useEffect, useState } from "react";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, ftsoV2Abi, FLR_USD_FEED_ID, XRP_USD_FEED_ID } from "../config/contracts";

export interface Prices {
  flrUsd: number;
  xrpUsd: number;
  timestamp: number;
}

export function usePrices() {
  const [prices, setPrices] = useState<Prices | null>(null);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const result = await publicClient.readContract({
          address: CONTRACTS.ftsoV2,
          abi: ftsoV2Abi,
          functionName: "getFeedsById",
          args: [[FLR_USD_FEED_ID, XRP_USD_FEED_ID]],
        });

        const [values, decimals, timestamp] = result as [bigint[], number[], bigint];
        const flrUsd = Number(values[0]) * Math.pow(10, -Number(decimals[0]));
        const xrpUsd = Number(values[1]) * Math.pow(10, -Number(decimals[1]));
        setPrices({ flrUsd, xrpUsd, timestamp: Number(timestamp) });
      } catch (e) {
        console.error("Failed to fetch FTSO prices:", e);
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 10_000);
    return () => clearInterval(interval);
  }, []);

  return prices;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePosition.ts src/hooks/usePrices.ts
git commit -m "rewrite position and price hooks to use viem public client"
```

---

### Task 7: Rewrite useCreditScore

**Files:**
- Rewrite: `frontend/src/hooks/useCreditScore.ts`

- [ ] **Step 1: Rewrite useCreditScore.ts to use Smart Account payment**

```typescript
import { useState } from "react";

interface SendPaymentFn {
  (memo: string, amountDrops?: string, instruction?: string): Promise<unknown>;
}

export function useCreditScore(sendPayment: SendPaymentFn | null) {
  const [requesting, setRequesting] = useState(false);
  const [txResult, setTxResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestScore(xrplAddress: string) {
    if (!sendPayment) throw new Error("Not connected");
    setRequesting(true);
    setError(null);
    try {
      // HACKATHON DEMO: the payload contains the Plaid token + user address
      // In production this would be ECIES-encrypted with the TEE public key
      const payload = JSON.stringify({
        plaid_access_token: "access-sandbox-de3ce8ef-33f8-452c-a685-8671031fc0f6",
        user_address: xrplAddress,
      });
      // Encode as hex for the memo
      const memoHex = Buffer.from(payload, "utf-8").toString("hex");
      const result = await sendPayment(memoHex, "1000000", "FlareScore: Compute Credit Score");
      setTxResult(result);
    } catch (e: any) {
      setError(e.message || "Failed to request score");
    } finally {
      setRequesting(false);
    }
  }

  return { requestScore, requesting, txResult, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCreditScore.ts
git commit -m "rewrite credit score hook to use XRPL payment memo"
```

---

### Task 8: Rewrite WalletConnect

**Files:**
- Rewrite: `frontend/src/components/WalletConnect.tsx`

- [ ] **Step 1: Rewrite WalletConnect.tsx for Xaman**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WalletConnect.tsx
git commit -m "rewrite WalletConnect for Xaman XRPL wallet"
```

---

### Task 9: Rewrite App.tsx

**Files:**
- Rewrite: `frontend/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx with Xaman state model**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "rewrite App with Xaman + Smart Account state model"
```

---

### Task 10: Rewrite pages (Dashboard, Score, Lend)

**Files:**
- Rewrite: `frontend/src/pages/Dashboard.tsx`
- Rewrite: `frontend/src/pages/Score.tsx`
- Rewrite: `frontend/src/pages/Lend.tsx`
- Delete: `frontend/src/pages/Xrpl.tsx`

- [ ] **Step 1: Rewrite Dashboard.tsx**

```typescript
import { usePosition } from "../hooks/usePosition";
import { usePrices } from "../hooks/usePrices";
import { PositionCard } from "../components/PositionCard";

interface Props { personalAccount: `0x${string}` | null; }

export function Dashboard({ personalAccount }: Props) {
  const { position, loading, refresh } = usePosition(personalAccount);
  const prices = usePrices();

  if (!personalAccount || personalAccount === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">Your Smart Account hasn't been created yet.</p>
        <p className="text-gray-500">It will be created on your first transaction.</p>
      </div>
    );
  }

  if (loading) return <p className="text-gray-400">Loading position...</p>;
  if (!position || position.creditScore === 0n) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No position yet.</p>
        <p className="text-gray-500">Get a credit score first, then deposit collateral to start borrowing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PositionCard position={position} prices={prices} />
      <button onClick={refresh} className="text-orange-400 text-sm underline">Refresh position</button>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite Score.tsx**

```typescript
import { useState } from "react";
import { useCreditScore } from "../hooks/useCreditScore";
import { usePosition } from "../hooks/usePosition";
import { ScoreDisplay } from "../components/ScoreDisplay";

interface Props {
  xrplAddress: string;
  personalAccount: `0x${string}` | null;
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
}

export function Score({ xrplAddress, personalAccount, sendPayment }: Props) {
  const { requestScore, requesting, error } = useCreditScore(sendPayment);
  const { position } = usePosition(personalAccount);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleRequestScore() {
    setLocalError(null);
    try {
      await requestScore(xrplAddress);
    } catch (e: any) {
      setLocalError(e.message || "Failed to request score");
    }
  }

  const hasScore = position && position.creditScore > 0n;

  return (
    <div className="space-y-6">
      {hasScore && <ScoreDisplay score={Number(position.creditScore)} />}
      <div className="bg-gray-900 rounded-xl p-6 text-center space-y-4">
        <h3 className="text-lg font-bold text-white">{hasScore ? "Update Your Score" : "Get Your Credit Score"}</h3>
        <p className="text-gray-400 text-sm">Your banking data is processed privately inside a Trusted Execution Environment. Only the score is published onchain.</p>
        <button onClick={handleRequestScore} disabled={requesting} className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white py-3 px-8 rounded-lg font-bold">
          {requesting ? "Sign in Xaman..." : "Compute Credit Score"}
        </button>
        {(error || localError) && <p className="text-red-400 text-sm">{error || localError}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite Lend.tsx**

```typescript
import { usePosition } from "../hooks/usePosition";
import { DepositForm } from "../components/DepositForm";
import { BorrowForm } from "../components/BorrowForm";
import { RepayForm } from "../components/RepayForm";

interface Props {
  personalAccount: `0x${string}` | null;
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
}

export function Lend({ personalAccount, sendPayment }: Props) {
  const { position, refresh } = usePosition(personalAccount);
  const hasScore = position && position.creditScore > 0n;

  if (!hasScore) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">You need a credit score first.</p>
        <p className="text-gray-500">Go to the Score tab to compute yours.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <DepositForm sendPayment={sendPayment} onSuccess={refresh} />
      <BorrowForm personalAccount={personalAccount!} sendPayment={sendPayment} onSuccess={refresh} />
      <RepayForm sendPayment={sendPayment} onSuccess={refresh} />
    </div>
  );
}
```

- [ ] **Step 4: Delete Xrpl.tsx (no longer needed — XRPL is the primary flow)**

```bash
rm src/pages/Xrpl.tsx src/components/XrplGuide.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Score.tsx src/pages/Lend.tsx
git add src/pages/Xrpl.tsx src/components/XrplGuide.tsx
git commit -m "rewrite pages for Smart Account flow, remove XRPL guide"
```

---

### Task 11: Rewrite form components

**Files:**
- Rewrite: `frontend/src/components/DepositForm.tsx`
- Rewrite: `frontend/src/components/BorrowForm.tsx`
- Rewrite: `frontend/src/components/RepayForm.tsx`

- [ ] **Step 1: Rewrite DepositForm.tsx**

```typescript
import { useState } from "react";

interface Props {
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
  onSuccess: () => void;
}

export function DepositForm({ sendPayment, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDeposit() {
    setLoading(true);
    try {
      // Convert XRP amount to drops (1 XRP = 1,000,000 drops)
      const drops = (parseFloat(amount) * 1_000_000).toFixed(0);
      // Simple memo indicating deposit intent
      const memo = Buffer.from(`deposit:${amount}`).toString("hex");
      await sendPayment(memo, drops, `FlareScore: Deposit ${amount} XRP`);
      setAmount("");
      onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Deposit Collateral</h3>
      <p className="text-gray-500 text-xs">Send XRP via your XRPL wallet. It will be bridged as FXRP collateral.</p>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (XRP)" className="w-full bg-gray-800 text-white p-3 rounded" />
      <button onClick={handleDeposit} disabled={loading || !amount} className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold">
        {loading ? "Sign in Xaman..." : "Deposit XRP"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite BorrowForm.tsx**

```typescript
import { useState } from "react";
import { publicClient } from "../lib/flareClient";
import { CONTRACTS, creditVaultAbi } from "../config/contracts";
import { formatEther, zeroAddress } from "viem";

interface Props {
  personalAccount: `0x${string}`;
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
  onSuccess: () => void;
}

export function BorrowForm({ personalAccount, sendPayment, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [maxBorrow, setMaxBorrow] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchMax() {
    try {
      const max = await publicClient.readContract({
        address: CONTRACTS.creditVault,
        abi: creditVaultAbi,
        functionName: "getMaxBorrow",
        args: [personalAccount, zeroAddress],
      }) as bigint;
      setMaxBorrow(formatEther(max));
    } catch { setMaxBorrow("0"); }
  }

  async function handleBorrow() {
    setLoading(true);
    try {
      const memo = Buffer.from(`borrow:${amount}`).toString("hex");
      await sendPayment(memo, "1000000", `FlareScore: Borrow ${amount}`);
      setAmount(""); onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Borrow</h3>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-gray-800 text-white p-3 rounded" />
      <button onClick={fetchMax} className="text-orange-400 text-sm underline">Check max borrow {maxBorrow !== null && `(${Number(maxBorrow).toFixed(4)} FLR)`}</button>
      <button onClick={handleBorrow} disabled={loading || !amount} className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold">
        {loading ? "Sign in Xaman..." : "Borrow"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite RepayForm.tsx**

```typescript
import { useState } from "react";

interface Props {
  sendPayment: (memo: string, amountDrops?: string, instruction?: string) => Promise<unknown>;
  onSuccess: () => void;
}

export function RepayForm({ sendPayment, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRepay() {
    setLoading(true);
    try {
      const drops = (parseFloat(amount) * 1_000_000).toFixed(0);
      const memo = Buffer.from(`repay:${amount}`).toString("hex");
      await sendPayment(memo, drops, `FlareScore: Repay ${amount}`);
      setAmount(""); onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Repay</h3>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (XRP)" className="w-full bg-gray-800 text-white p-3 rounded" />
      <button onClick={handleRepay} disabled={loading || !amount} className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold">
        {loading ? "Sign in Xaman..." : "Repay"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/DepositForm.tsx src/components/BorrowForm.tsx src/components/RepayForm.tsx
git commit -m "rewrite lending forms for XRPL payment memos"
```

---

### Task 12: Build and verify

**Files:**
- None (verification only)

- [ ] **Step 1: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean build

- [ ] **Step 3: Add .env.example for Xaman API key**

Add `VITE_XAMAN_API_KEY` to the project. Create `frontend/.env.example`:

```
VITE_XAMAN_API_KEY=your-xaman-api-key
VITE_CREDIT_VAULT_ADDRESS=0x...
VITE_SMART_ACCOUNT_RECEIVER_ADDRESS=0x...
VITE_FXRP_ADDRESS=0x...
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "add env example with Xaman API key"
```
