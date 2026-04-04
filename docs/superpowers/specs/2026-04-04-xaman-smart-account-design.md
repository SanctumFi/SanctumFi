# XRPL Wallet (Xaman) + Smart Account Integration

**Date:** 2026-04-04
**Scope:** Replace MetaMask with Xaman SDK, all user actions via XRPL Payment memos through Flare Smart Accounts.

## Context

FlareScore is a hackathon project targeting Flare's $8K "TEE Extensions + Smart Accounts" prize track and $2K "Best Smart Account App" bonus. The frontend currently uses MetaMask (EVM wallet), but the prize requires XRPL-native UX via Smart Accounts. XRPL users must be able to access credit-scored lending without an EVM wallet.

## Architecture

Two layers:

1. **Write layer (Xaman):** All user actions (score request, deposit, borrow, repay) are XRPL Payment transactions with encoded Custom Instruction memos, sent to the Smart Account operator address. The operator relays these to Flare via FDC attestation, and the user's personal smart account executes the instruction on-chain.

2. **Read layer (viem public client):** Position data, prices, and health factors are read directly from Flare chain via a public RPC provider. No wallet needed for reads. The user's XRPL address maps to a Flare personal account via `MasterAccountController.getPersonalAccount(xrplAddress)`.

```
Xaman App (mobile)        Frontend (browser)         Flare Chain
     │                         │                          │
     │  ◄── SignIn payload ──  │                          │
     │  ── rAddress ──────►    │                          │
     │                         │ ── getPersonalAccount() ─►│
     │                         │ ◄── 0xFlareAddr ─────────│
     │                         │ ── positions(0xFlare) ───►│
     │                         │ ◄── score,collateral,debt │
     │                         │                          │
     │  ◄── Payment payload ── │  (user action)           │
     │  ── signed tx ────────► │                          │
     │                         │  (operator relays)       │
     │                         │ ── watchEvent() ─────────►│
     │                         │ ◄── CustomInstructionExec │
```

## Components

### New Files

**`hooks/useXaman.ts`** — Xaman SDK lifecycle wrapper.
- Initializes `new Xumm(apiKey)` once
- Handles SignIn payload creation + event listening
- Exposes: `{ xumm, xrplAddress, connected, connect, disconnect }`
- Xaman runs fully client-side (browser mode, no backend)

**`hooks/useSmartAccount.ts`** — Maps XRPL address to Flare personal account and encodes instructions.
- Calls `MasterAccountController.getPersonalAccount(xrplAddress)` via viem
- Exposes: `{ personalAccount, sendInstruction }`
- `sendInstruction(targetContract, functionName, args, value)`:
  1. Encodes function call via `encodeFunctionData`
  2. Calls `encodeCustomInstruction` on MasterAccountController
  3. Prepends `0xff` + walletId byte
  4. Creates Xaman Payment payload with memo = encoded instruction
  5. Returns promise that resolves when `CustomInstructionExecuted` event fires

**`lib/flareClient.ts`** — Public viem client for Flare chain reads (no wallet).
- `createPublicClient({ chain: flareTestnet, transport: http() })`
- Used by all read hooks

### Rewritten Files

**`WalletConnect.tsx`** → Xaman connection UI.
- "Connect with Xaman" button
- Shows QR code or deep link (Xaman SDK handles this)
- Displays connected XRPL address (r...)
- Disconnect button

**`App.tsx`** → State management update.
- State: `xrplAddress`, `personalAccount` (derived Flare address)
- No ethers provider — viem public client for reads
- Props: pass `xrplAddress`, `personalAccount`, `sendInstruction` down

**`useCreditScore.ts`** → XRPL Payment memo for score request.
- Encodes `SmartAccountReceiver.handleScoreRequest(xrplAddressBytes32, encryptedPayload)`
- Sends via `sendInstruction()`
- Watches for execution event

**`usePosition.ts`** → viem reads via personal account address.
- `publicClient.readContract({ address: creditVault, functionName: 'positions', args: [personalAccount] })`
- Same polling (15s) but uses viem instead of ethers

**`usePrices.ts`** → viem reads.
- Same FTSO queries but via viem public client

**`DepositForm.tsx`** → Custom instruction: `CreditVault.depositFLR()` or `depositFXRP(amount)`.
- Encodes as custom instruction
- XRPL Payment amount carries the XRP value (converted to drops for fee)
- Sends via `sendInstruction()`

**`BorrowForm.tsx`** → Custom instruction: `CreditVault.borrow(asset, amount)`.
- Same pattern, encode + send via memo

**`RepayForm.tsx`** → Custom instruction: `CreditVault.repay(asset, amount)`.
- Same pattern

### Updated Config Files

**`config/contracts.ts`**
- Add `MasterAccountController` address: `0x434936d47503353f06750Db1A444DBDC5F0AD37c`
- Add `iMasterAccountControllerAbi` (getPersonalAccount, registerCustomInstruction, encodeCustomInstruction, getXrplProviderWallets)
- Add `iCustomInstructionsFacetAbi`
- Keep CreditVault ABI (for reads)
- Remove InstructionSender ABI (not called from frontend anymore — TEE is triggered via SmartAccountReceiver)

**`config/chains.ts`**
- Add XRPL testnet config: `wss://s.altnet.rippletest.net:51233`
- Keep Coston2 config for viem reads

### Deleted

- All MetaMask / `window.ethereum` code
- `ethers` dependency (fully replaced by viem + xumm)

## Dependencies

**Add:**
- `xumm` — Xaman SDK (browser mode, ~1.8.0)
- `viem` — already in tee/typescript, add to frontend

**Remove:**
- `ethers` — no longer needed

**Keep:**
- `react-plaid-link` — will be used for actual Plaid Link flow later

## Xaman API Key

Requires a free Xaman Developer API key from https://apps.xaman.dev. Store as `VITE_XAMAN_API_KEY` env var. The SDK runs fully client-side in browser mode — no backend server needed.

## Custom Instruction Registration

Before XRPL users can call our contracts, we must register each action as a Custom Instruction on MasterAccountController. This is a one-time setup (done by the deployer, not the user):

1. `registerCustomInstruction([{targetContract: CreditVault, value: 0, data: encodeDepositFLR()}])`
2. `registerCustomInstruction([{targetContract: CreditVault, value: 0, data: encodeBorrow(...)}])`
3. etc.

Each registration returns an instruction hash. The frontend uses `encodeCustomInstruction()` to get the bytes32 memo for each action.

## XRPL Payment Format

Every user action becomes:

```typescript
xumm.payload.create({
  txjson: {
    TransactionType: "Payment",
    Destination: operatorXrplAddress,  // from getXrplProviderWallets()
    Amount: instructionFee,            // in drops (1 XRP = 1,000,000 drops)
    Memos: [{
      Memo: {
        MemoData: encodedInstruction.slice(2)  // bytes32 hex without 0x
      }
    }]
  },
  options: {
    force_network: "TESTNET"
  },
  custom_meta: {
    instruction: "FlareScore: <action description>"
  }
})
```

## Event Watching

After submitting a payment, the frontend watches for execution on Flare:

```typescript
publicClient.watchContractEvent({
  address: masterAccountController,
  abi: iInstructionsFacetAbi,
  eventName: "CustomInstructionExecuted",
  onLogs: (logs) => { /* match personalAccount + callHash */ }
})
```

## Error Handling

- Xaman connection rejected → show "Please approve in Xaman app"
- Payment signing rejected → show "Transaction cancelled"
- Instruction execution failed → parse `CustomInstructionExecuted` event for revert reason
- Network mismatch → `force_network: "TESTNET"` in payload options
- Personal account not created yet → show "Your Smart Account will be created on first transaction"

## Testing

- Manual: connect Xaman testnet wallet, send payment, verify instruction executes
- The `SmartAccountReceiver.sol` contract already exists and handles XRPL → CreditVault routing
- Position reads can be tested without Xaman (just need a known XRPL address)
