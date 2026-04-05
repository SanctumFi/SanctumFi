# Veil

**Credit-scored DeFi lending on the Flare blockchain.**

Veil lets users connect their bank accounts to receive a privacy-preserving credit score computed inside a Trusted Execution Environment (TEE), then borrow cryptocurrency with collateral requirements dynamically adjusted based on that score. Higher scores unlock better loan-to-value ratios — bridging traditional finance credit history into decentralized lending.

Built for EthGlobal Cannes 2026 — targeting Flare's TEE Extensions + Smart Accounts track.

---

## Table of Contents

- [The Problem](#the-problem)
- [How Veil Solves It](#how-veil-solves-it)
- [Architecture](#architecture)
- [How It Works — Step by Step](#how-it-works--step-by-step)
- [TEE Credit Scoring Extension](#tee-credit-scoring-extension)
- [Smart Contracts](#smart-contracts)
- [XRPL Smart Account Integration](#xrpl-smart-account-integration)
- [Frontend](#frontend)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Testing](#testing)
- [License](#license)

---

## The Problem

DeFi lending today requires **150–200% collateral** because borrowers are anonymous. To borrow $1,000 of ETH, you need to lock $1,500–$2,000 — making it capital-inefficient and inaccessible for most people. Traditional credit scores could help, but exposing raw banking data on-chain destroys privacy.

## How Veil Solves It

Veil uses **Flare's Trusted Execution Environments** to process real banking data (via Plaid) inside a hardware-secured enclave. The raw data **never touches the blockchain** — only the TEE-signed credit score (0–1000) does. This score then adjusts your collateral requirements:

| Tier     | Score Range | Collateral Ratio | What It Means |
|----------|-------------|-------------------|---------------|
| Platinum | 800 – 1000  | 80%               | Borrow **more** than your collateral — under-collateralized lending |
| Gold     | 600 – 799   | 120%              | Light collateral requirement |
| Silver   | 400 – 599   | 150%              | Standard DeFi-like collateral |
| Bronze   | 0 – 399     | 200%              | Heavy collateral for unscored users |

**Key properties:**
- Raw banking data never leaves the TEE enclave
- Scores expire after 24 hours, requiring periodic re-attestation
- Collateral assets: FLR (native Flare) and FXRP (wrapped XRP)
- 5% APR fee on outstanding debt, accrued at repayment
- XRPL users can interact via Smart Accounts — no EVM wallet needed

---

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │          User Interfaces              │
                    │                                       │
                    │  ┌──────────────┐  ┌──────────────┐  │
                    │  │  MetaMask /  │  │ XRPL Wallet  │  │
                    │  │  EVM Wallet  │  │  (Xaman)     │  │
                    │  └──────┬───────┘  └──────┬───────┘  │
                    └─────────┼─────────────────┼──────────┘
                              │                 │
                   ┌──────────▼──────────┐      │
                   │   React Frontend    │      │
                   │  Dashboard · Score  │      │
                   │   Lend · XRPL      │      │
                   └──────────┬──────────┘      │
                              │ viem / ethers    │ Payment Memos
         ┌────────────────────▼─────────────────▼──────────────────┐
         │                  Flare Coston2 Testnet                  │
         │                                                          │
         │  ┌───────────────────────────────────────────────────┐  │
         │  │                  CreditVault.sol                   │  │
         │  │   Collateral · Borrowing · LTV · Fees · Liquidation│  │
         │  └─────────────┬─────────────────────┬───────────────┘  │
         │                │                     │                   │
         │  ┌─────────────▼──────────┐ ┌───────▼────────────────┐  │
         │  │  InstructionSender.sol │ │ SmartAccountReceiver   │  │
         │  │  Routes encrypted      │ │ XRPL ↔ Flare bridge   │  │
         │  │  payloads to TEE       │ │ Payment memo router    │  │
         │  └─────────────┬──────────┘ └────────────────────────┘  │
         │                │                                         │
         │  ┌─────────────▼──────────┐  ┌────────────────────────┐ │
         │  │ TeeExtensionRegistry   │  │      FTSO V2           │ │
         │  │ TeeMachineRegistry     │  │  FLR/USD · XRP/USD     │ │
         │  │ (Flare system contracts)│  │  (~1.8s block-latency) │ │
         │  └─────────────┬──────────┘  └────────────────────────┘ │
         └────────────────┼────────────────────────────────────────┘
                          │
         ┌────────────────▼────────────────────────────────────────┐
         │         TEE Enclave (Docker: 3 containers)              │
         │                                                          │
         │  ┌──────────────────────────────────────────────────┐   │
         │  │              extension-tee (TypeScript)           │   │
         │  │                                                    │   │
         │  │  1. Receive ECIES-encrypted payload               │   │
         │  │  2. Decrypt via TEE node /decrypt endpoint        │   │
         │  │  3. Extract Plaid access token + user address     │   │
         │  │  4. Fetch 90-day banking data from Plaid API      │   │
         │  │  5. Compute 4-factor credit score (0–1000)        │   │
         │  │  6. Sign result via TEE node /sign endpoint       │   │
         │  │  7. Return ABI-encoded (user, score, time, sig)   │   │
         │  └──────────────────────────────────────────────────┘   │
         │  ┌────────────────┐  ┌────────────────┐                 │
         │  │   ext-proxy    │  │     redis       │                │
         │  │   Chain monitor│  │   State store   │                │
         │  └────────────────┘  └────────────────┘                 │
         └─────────────────────────────────────────────────────────┘
                          │
         ┌────────────────▼────────────────────┐
         │       Plaid API (Sandbox Mode)      │
         │   Account balances · Transactions   │
         └─────────────────────────────────────┘
```

---

## How It Works — Step by Step

### 1. Connect Bank Account

The user connects their bank account through Plaid Link in the frontend. Plaid returns an access token that grants read-only access to account balances and transaction history. This token is **never stored on-chain in plaintext**.

### 2. Encrypt & Submit Score Request

The frontend fetches the TEE node's public key and uses **ECIES encryption** (go-ethereum compatible: NIST SP 800-56A Concat KDF + AES-128-CTR + HMAC-SHA-256) to encrypt a JSON payload containing the Plaid token and user address. The encrypted blob is sent to `InstructionSender.requestCreditScore()` on-chain, which routes it to the Flare TEE Extension Registry.

```
Frontend → ECIES encrypt(plaid_token, user_address)
         → InstructionSender.requestCreditScore(encryptedPayload)
         → TeeExtensionRegistry.sendInstructions(...)
         → Random TEE node selected via TeeMachineRegistry
```

### 3. TEE Computes Score

Inside the TEE enclave, the handler:

1. **Decrypts** the payload using the TEE node's private key (via `/decrypt` endpoint)
2. **Calls Plaid API** to fetch 90 days of transaction history and current balances
3. **Computes a 0–1000 score** using four equally-weighted factors (see [Scoring Algorithm](#scoring-algorithm))
4. **Signs the result** via the TEE node's `/sign` endpoint (ECDSA signature)
5. **Returns ABI-encoded data**: `(address user, uint256 score, uint256 timestamp, bytes signature)`

The raw banking data **never leaves the TEE enclave**. Only the score and its cryptographic attestation are output.

### 4. Score Lands On-Chain

The frontend polls the TEE proxy for the result, then calls `CreditVault.receiveScore(user, score, timestamp, signature)`. The vault verifies the ECDSA signature against the registered TEE signer address using `ecrecover`. If valid, the score is stored in the user's position with a 24-hour expiry.

### 5. Deposit, Borrow, Repay

With a valid score, the user can:
- **Deposit** FLR or FXRP as collateral
- **Borrow** up to their score-adjusted LTV limit (priced via FTSO V2 oracle feeds)
- **Repay** debt with accrued 5% APR fees
- **Withdraw** collateral as long as the position stays healthy

The health factor is continuously monitored: `healthFactor = (collateralUSD × 10000) / (debtUSD × tierLTV)`. Below 1.0 = liquidatable by anyone.

---

## TEE Credit Scoring Extension

### Scoring Algorithm

The scoring engine in `tee/typescript/src/app/scoring.ts` computes four factors, each worth 0–250 points, for a total of 0–1000:

| Factor | Max | How It's Calculated |
|--------|-----|---------------------|
| **Balance Health** | 250 | `min(250, (avgBalance / monthlySpend) / 3 × 250)` — measures emergency reserves |
| **Income Stability** | 250 | `max(0, (1 - coefficientOfVariation) × 250)` — lower variance in monthly income = higher score |
| **Spending Discipline** | 250 | `min(250, (essentialSpendRatio / 0.7) × 250)` — fraction of spending on rent, groceries, utilities, insurance, etc. |
| **Account Age** | 250 | `min(250, (monthsOfHistory / 24) × 250)` — longer history = more creditworthy, capped at 24 months |

**Essential spending categories** (matched via Plaid's `personal_finance_category` or legacy `category[]`):
rent, mortgage, utilities, groceries, food, insurance, medical, transportation, loan payments.

### TEE Infrastructure

The extension runs as a Docker Compose stack with three containers:

| Container | Port (internal → host) | Purpose |
|-----------|------------------------|---------|
| `extension-tee` | 8080 | Business logic (TypeScript handler) |
| `ext-proxy` | 6663→6675, 6664→6676 | Monitors chain for instructions, exposes TEE endpoints |
| `redis` | 6379→6383 | In-memory state store |

**Instruction routing** uses Flare's `TeeInstructionParams`:
- `opType`: `"CREDIT"` — identifies our extension type
- `opCommand`: `"SCORE"` — the specific operation
- `message`: ECIES-encrypted payload (hex-encoded)
- TEE machine selected randomly via `TeeMachineRegistry.getRandomTeeIds()`

**Security model:**
- ECIES encryption ensures the Plaid token is only readable inside the TEE
- The TEE node's private key never leaves the enclave
- `/decrypt` and `/sign` endpoints are only accessible within the Docker network
- Results are ECDSA-signed — the vault verifies the signer matches the registered TEE address
- Signature v-value is converted from TEE format (0/1) to Solidity format (27/28)

---

## Smart Contracts

### CreditVault.sol — Core Lending Protocol

The main protocol contract managing positions, collateral, borrowing, fees, and liquidation.

```solidity
struct Position {
    uint256 creditScore;        // 0-1000, TEE-attested
    uint256 scoreTimestamp;     // when score was computed
    uint256 flrCollateral;      // deposited FLR (native)
    uint256 fxrpCollateral;     // deposited FXRP (ERC-20)
    uint256 flrDebt;            // borrowed FLR principal
    uint256 fxrpDebt;           // borrowed FXRP principal
    uint256 flrBorrowTimestamp; // for fee accrual
    uint256 fxrpBorrowTimestamp;
}
```

**Key functions:**

| Function | Description |
|----------|-------------|
| `receiveScore(user, score, timestamp, sig)` | TEE signer submits attested credit score |
| `depositFLR()` / `depositFXRP(amount)` | Deposit collateral |
| `borrow(asset, amount)` | Borrow against collateral up to tier LTV |
| `repay(asset, amount)` | Repay debt + accrued 5% APR fees |
| `withdrawCollateral(asset, amount)` | Withdraw if position stays healthy |
| `liquidate(user)` | Seize collateral of unhealthy positions |
| `getHealthFactor(user)` | Returns position health (< 1e18 = liquidatable) |
| `getMaxBorrow(user, asset)` | Max borrowable amount given current score & collateral |

**Fee calculation:** `totalDebt = principal + (principal × 500 × elapsed) / (10000 × 365.25 days)` = 5% APR

**Price feeds:** FLR/USD and XRP/USD from Flare's FTSO V2 oracle (~1.8s block-latency updates, free on-chain).

### InstructionSender.sol — TEE Score Request Router

Routes encrypted credit score requests to the TEE Extension Registry. Selects a random TEE machine via `TeeMachineRegistry.getRandomTeeIds()` and submits the instruction with `opType = "CREDIT"`, `opCommand = "SCORE"`.

### SmartAccountReceiver.sol — XRPL Bridge

Maps XRPL addresses to deterministic Flare addresses (`keccak256(xrplAddress)` truncated to 20 bytes). Receives action memos from XRPL payments and routes them to CreditVault proxy functions:

| Memo Action | Routes To |
|-------------|-----------|
| Deposit | `CreditVault.depositFLRFor(user)` |
| Score Request | `InstructionSender.requestCreditScore(payload)` |
| Borrow | `CreditVault.borrowFor(user, asset, amount)` |
| Repay | `CreditVault.repayFor(user, asset, amount)` |
| Withdraw | `CreditVault.withdrawCollateralFor(user, asset, amount)` |

---

## XRPL Smart Account Integration

Veil allows **XRPL users to borrow on Flare without ever creating an EVM wallet**, using Flare's Smart Account infrastructure.

### How It Works

```
XRPL Wallet (Xaman)
       │
       │ Payment transaction with encoded memo
       │ Destination: Operator's XRPL address
       │ Amount: Instruction fee (in drops)
       ▼
Flare Data Connector (FDC)
       │
       │ Bridges XRPL payment to Flare (≤180 seconds)
       ▼
MasterAccountController
       │
       │ Executes CustomInstruction[] atomically
       ▼
CreditVault (via SmartAccountReceiver)
       │
       │ Deposit / Borrow / Repay / Withdraw
       ▼
Position updated on-chain
```

### Custom Instruction Encoding

Each Flare action is encoded as a `CustomInstruction`:

```typescript
type CustomInstruction = {
  targetContract: Address;  // e.g., CreditVault address
  value: bigint;            // FLR to send (e.g., collateral deposit)
  data: `0x${string}`;     // ABI-encoded function call
};
```

**Registration flow:**
1. Build an array of `CustomInstruction` objects (e.g., deposit + borrow in one atomic tx)
2. Call `MasterAccountController.registerCustomInstruction(instructions)` → returns `callHash`
3. Call `MasterAccountController.encodeCustomInstruction(instructions)` → 32-byte hash
4. Format memo: `0xff` + wallet ID (1 byte) + last 30 bytes of hash
5. Send XRPL payment with memo to the operator address
6. FDC bridges it to Flare, `MasterAccountController` executes all calls atomically
7. Frontend watches for `CustomInstructionExecuted` event to confirm

This means an XRPL user can deposit collateral and borrow in a **single XRPL payment** — no gas tokens, no MetaMask, no bridge needed.

---

## Frontend

A dark-themed React SPA with four pages:

### Dashboard
Live position overview: credit score badge with tier, collateral balances (FLR + FXRP with USD values from FTSO), outstanding debt, and health factor progress bar. Auto-refreshes every 15 seconds.

### Score
Triggers the Plaid bank connection flow via Plaid Link SDK. After linking, the frontend:
1. Fetches TEE node's public key from the proxy
2. ECIES-encrypts the Plaid token + user address
3. Submits the encrypted payload on-chain (0.01 FLR fee)
4. Polls the TEE proxy for results (90 attempts × 2s intervals)
5. Submits the signed score to `CreditVault.receiveScore()`
6. Displays the score, tier, and max LTV

### Lend
Four-column grid with forms for Deposit, Borrow, Repay, and Withdraw. Each form shows real-time USD values from FTSO price feeds and validates against the user's current position limits.

### XRPL
Step-by-step guide for XRPL users, with Xaman wallet integration for signing payment transactions with custom instruction memos.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.25 · Foundry · OpenZeppelin v5.6.1 |
| Blockchain | Flare Network (Coston2 Testnet, Chain ID 114) |
| Price Oracles | FTSO V2 (FLR/USD, XRP/USD — ~1.8s updates) |
| TEE Backend | TypeScript · Flare TEE Extension SDK · Docker Compose |
| Banking Data | Plaid API (Sandbox mode) |
| Frontend | React 19 · TypeScript · Vite 8 · Tailwind CSS 4 |
| Web3 | viem v2.47 (Smart Accounts) · ethers.js v6 (vault) |
| XRPL | Xaman (xumm) wallet · Flare Smart Accounts |
| Cryptography | @noble/secp256k1 (ECIES) · eciesjs |

---

## Project Structure

```
Veil/
├── contracts/                          # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── CreditVault.sol             # Core lending protocol (635 lines)
│   │   ├── InstructionSender.sol       # TEE score request dispatcher
│   │   ├── SmartAccountReceiver.sol    # XRPL bridge router
│   │   └── interfaces/
│   │       ├── ICreditVault.sol        # Vault interface + proxy functions
│   │       ├── IFtsoV2.sol             # FTSO V2 price feed interface
│   │       ├── ITeeExtensionRegistry.sol
│   │       └── ITeeMachineRegistry.sol
│   ├── script/
│   │   └── Deploy.s.sol                # One-step deployment script
│   ├── test/
│   │   ├── CreditVault.t.sol           # Position, borrow, fee, liquidation tests
│   │   ├── InstructionSender.t.sol
│   │   ├── SmartAccountReceiver.t.sol
│   │   └── TeeRoundTrip.t.sol          # End-to-end TEE integration test
│   └── foundry.toml
│
├── frontend/                           # React + Vite application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx           # Position overview (auto-refresh 15s)
│   │   │   ├── Score.tsx               # Plaid Link + TEE score flow
│   │   │   ├── Lend.tsx                # Deposit / borrow / repay / withdraw
│   │   │   └── Xrpl.tsx               # XRPL Smart Account guide
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx       # MetaMask + Xaman connection
│   │   │   ├── ScoreDisplay.tsx        # Score badge with tier
│   │   │   ├── PositionCard.tsx        # Collateral & debt display
│   │   │   ├── HealthBar.tsx           # Health factor progress bar
│   │   │   ├── BorrowForm.tsx
│   │   │   ├── DepositForm.tsx
│   │   │   ├── RepayForm.tsx
│   │   │   └── XrplGuide.tsx
│   │   ├── hooks/
│   │   │   ├── useCreditScore.ts       # Full TEE score request flow (ECIES + polling)
│   │   │   ├── usePosition.ts          # Vault position data (auto-refresh 15s)
│   │   │   ├── usePrices.ts            # FTSO V2 price feeds (auto-refresh 10s)
│   │   │   └── useSmartAccount.ts      # Smart Account custom instructions
│   │   ├── lib/
│   │   │   └── smartAccounts.ts        # MasterAccountController helpers (viem)
│   │   └── config/
│   │       ├── contracts.ts            # Addresses & ABIs
│   │       └── chains.ts              # Coston2 network config
│   └── package.json
│
└── tee/                                # TEE extension stack
    ├── docker-compose.yaml             # 3-container stack (redis + proxy + extension)
    ├── .env.example                    # All required env vars
    ├── config/
    │   ├── coston2/deployed-addresses.json  # Flare system contract addresses
    │   └── proxy/extension_proxy.toml       # Proxy DB config
    ├── scripts/
    │   ├── full-setup.sh               # Interactive guided setup (all steps)
    │   ├── deploy-contracts.sh         # Step 1: Deploy to Coston2
    │   ├── register-extension.sh       # Step 2: Register on TeeExtensionRegistry
    │   ├── start-stack.sh              # Step 3: Docker compose build + up
    │   └── register-tee-version.sh     # Step 5-6: Register version + machine
    ├── go/tools/                       # Go CLI tools for TEE registration
    ├── proxy/Dockerfile                # ext-proxy (chain monitor)
    └── typescript/                     # TEE extension handler
        ├── Dockerfile
        ├── package.json
        └── src/
            ├── main.ts                 # HTTP server entry point
            ├── app/
            │   ├── handlers.ts         # Score computation handler
            │   ├── scoring.ts          # 4-factor algorithm (0–1000)
            │   ├── plaid.ts            # Plaid API + sandbox fallback
            │   └── config.ts           # Constants (CREDIT/SCORE op codes)
            └── __tests__/
                ├── scoring.test.ts
                ├── plaid-sandbox.test.ts
                └── integration.test.ts
```

---

## Local Deployment — Full Step-by-Step Guide

This walks you through deploying everything locally: contracts, TEE extension (Docker), tunnel, and frontend — all connected to the Coston2 testnet.

### Prerequisites

| Tool | Install |
|------|---------|
| **Foundry** (forge, cast) | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| **Node.js >= 18** | https://nodejs.org |
| **Docker + Docker Compose** | https://docs.docker.com/get-docker/ |
| **Go >= 1.23** | https://go.dev (for TEE registration tools) |
| **cloudflared** | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ |
| **MetaMask** | Browser extension, configured for Coston2 |

**You also need:**
- A funded Coston2 wallet (get C2FLR from [Flare Faucet](https://faucet.flare.network/coston2))
- Plaid Sandbox credentials (free at [plaid.com/docs/sandbox](https://plaid.com/docs/sandbox/))
- C-chain indexer DB credentials (provided by Flare for hackathon participants)

---

### Step 0: Configure Environment Files

You need three `.env` files. Start from the examples:

```bash
cp tee/.env.example tee/.env
cp contracts/.env.example contracts/.env
cp frontend/.env.example frontend/.env.local
```

#### `tee/.env`

```env
LANGUAGE=typescript
PRIVATE_KEY=<your-funded-coston2-private-key-WITHOUT-0x-prefix>
INITIAL_OWNER=<address-derived-from-your-private-key>
PLAID_CLIENT_ID=<plaid-sandbox-client-id>
PLAID_SECRET=<plaid-sandbox-secret>
FEE_WEI=1000000000000

# Filled in later during setup:
INSTRUCTION_SENDER=
EXTENSION_ID=
TUNNEL_URL=

# Coston2 system contracts (DO NOT CHANGE)
CHAIN_URL=https://coston2-api.flare.network/ext/C/rpc
TEE_EXTENSION_REGISTRY=0x3d478d43426081BD5854be9C7c5c183bfe76C981
TEE_MACHINE_REGISTRY=0x5918Cd58e5caf755b8584649Aa24077822F87613
TEE_VERSION_MANAGER=0x2da0D3bcAB211f59e3f1115B071d088D88C8f8fc
FTSOV2_ADDRESS=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
NORMAL_PROXY_URL=https://tee-proxy-coston2-1.flare.rocks
FXRP_ADDRESS=0x0000000000000000000000000000000000000000
LOCAL_MODE=false
```

#### `contracts/.env`

```env
PRIVATE_KEY=0x<same-key-WITH-0x-prefix>
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FTSOV2_ADDRESS=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
FXRP_ADDRESS=0x0000000000000000000000000000000000000000
TEE_EXTENSION_REGISTRY=0x3d478d43426081BD5854be9C7c5c183bfe76C981
TEE_MACHINE_REGISTRY=0x5918Cd58e5caf755b8584649Aa24077822F87613
```

#### Proxy config

```bash
cp tee/config/proxy/extension_proxy.toml.example tee/config/proxy/extension_proxy.toml
```

Edit the `[db]` section with C-chain indexer credentials (provided by Flare for hackathon participants).

---

### Step 1: Deploy Smart Contracts

```bash
cd contracts
forge install
forge build
```

Deploy all three contracts to Coston2 in one step:

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --broadcast \
  --verify \
  -vvv
```

This deploys:
1. `InstructionSender` — TEE score request router
2. `CreditVault` — lending core (linked to FTSO V2 + TEE signer)
3. `SmartAccountReceiver` — XRPL bridge
4. Authorizes `SmartAccountReceiver` on the vault
5. Seeds the vault with 10 FLR initial liquidity

**Save the deployed addresses** from the output — you need them for every following step.

#### Verify deployment

```bash
RPC=https://coston2-api.flare.network/ext/C/rpc

cast call <CREDIT_VAULT> "owner()" --rpc-url $RPC
cast call <CREDIT_VAULT> "smartAccountReceiver()" --rpc-url $RPC
cast balance <CREDIT_VAULT> --rpc-url $RPC --ether   # Should show 10
```

---

### Step 2: Register TEE Extension

Update `tee/.env` with the `INSTRUCTION_SENDER` address from Step 1, then:

```bash
cd tee/go/tools
go run ./cmd/register-extension
```

This registers your `InstructionSender` on the `TeeExtensionRegistry` and prints an extension ID (e.g. `271`).

Save it in `tee/.env` as a 32-byte hex:
```env
EXTENSION_ID=0x000000000000000000000000000000000000000000000000000000000000010f
```

Then link the extension ID to the contract:

```bash
cast send <INSTRUCTION_SENDER> "setExtensionId()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY
```

Verify:
```bash
cast call <INSTRUCTION_SENDER> "getExtensionId()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Should return your extension ID
```

---

### Step 3: Build and Start Docker Stack

```bash
cd tee
docker compose build
docker compose up -d
```

This starts 3 containers:

| Container | Purpose | Host Port |
|-----------|---------|-----------|
| `redis` | Proxy state store | 6383 |
| `ext-proxy` | Watches chain for instructions, routes to TEE | 6675 (internal), 6676 (external) |
| `extension-tee` | TypeScript handler: decrypt → Plaid → score → sign | (internal only) |

Wait for everything to be healthy:

```bash
# Wait for proxy to be ready
until curl -sf http://localhost:6676/info >/dev/null 2>&1; do sleep 2; done
echo "Proxy is ready"

# Verify all 3 containers are running
docker ps --filter "name=tee" --format "table {{.Names}}\t{{.Status}}"
```

---

### Step 4: Start Tunnel

The Flare infrastructure needs to reach your TEE proxy over the internet. In a **separate terminal** (keep it running):

```bash
cloudflared tunnel --url http://localhost:6676
```

Copy the HTTPS URL (e.g. `https://some-random-words.trycloudflare.com`) and update `tee/.env`:

```env
TUNNEL_URL=https://some-random-words.trycloudflare.com
```

Verify:
```bash
curl -s https://some-random-words.trycloudflare.com/info | head -c 100
# Should return JSON with TEE node info
```

> **Important:** If the tunnel restarts with a new URL, you must update `TUNNEL_URL`, restart Docker, and redo Steps 5–6.

---

### Step 5: Register TEE Version

```bash
cd tee/go/tools
go run ./cmd/allow-tee-version -p http://localhost:6676
```

This registers the code hash and platform with the `TeeVersionManager` contract.

---

### Step 6: Register TEE Machine

```bash
cd tee/go/tools
go run ./cmd/register-tee -p http://localhost:6676 -l
```

The `-l` flag enables **local/test mode** (required for Coston2 — uses fake attestation instead of real hardware attestation).

This runs a multi-step process:
1. **Pre-registration** — announces the TEE machine on-chain
2. **Attestation** — requests TEE attestation (test mode on Coston2)
3. **Availability check** — Flare's public proxy verifies your TEE is reachable via the tunnel
4. **Activation** — marks TEE as production-ready

Expected output:
```
INFO  Registration of TEE with ID <TEE_ADDRESS>
INFO  (pre)registration of TEE ... succeeded
INFO  availability check sent, instructionId: ...
INFO  availability check proof obtained
INFO  Registered TEE node with id 0x<TEE_ADDRESS>
```

**Save the `TEE_ADDRESS`** from the output.

> **Troubleshooting:** If the availability check times out (404 after 60 retries), restart Docker (`docker compose down && docker compose up -d`), wait for proxy health, then retry Steps 5 + 6.

---

### Step 7: Set TEE Node as Trusted Signer

The `CreditVault` needs to know which TEE address is allowed to submit credit scores:

```bash
cast send <CREDIT_VAULT> "setTeeSigner(address)" <TEE_ADDRESS> \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY
```

Verify:
```bash
cast call <CREDIT_VAULT> "teeSigner()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Should return the TEE address
```

---

### Step 8: Start Frontend

Update `frontend/.env.local` with the deployed addresses:

```env
VITE_CREDIT_VAULT_ADDRESS=<CREDIT_VAULT from Step 1>
VITE_INSTRUCTION_SENDER_ADDRESS=<INSTRUCTION_SENDER from Step 1>
VITE_SMART_ACCOUNT_RECEIVER_ADDRESS=<SMART_ACCOUNT_RECEIVER from Step 1>
VITE_FXRP_ADDRESS=0x0000000000000000000000000000000000000000
VITE_XAMAN_API_KEY=<your-xaman-api-key>
```

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — connect MetaMask (Coston2 network), and you're ready to go.

---

### Automated Setup (Alternative)

If you prefer a guided interactive flow, there's a script that runs all steps in order:

```bash
cd tee
./scripts/full-setup.sh
```

It pauses between steps so you can copy addresses and update `.env`.

---

### Verification Checklist

After setup, run these to confirm everything is wired correctly:

```bash
RPC=https://coston2-api.flare.network/ext/C/rpc

# Contracts deployed and configured
cast call <CREDIT_VAULT> "owner()" --rpc-url $RPC
cast call <CREDIT_VAULT> "teeSigner()" --rpc-url $RPC
cast call <CREDIT_VAULT> "smartAccountReceiver()" --rpc-url $RPC
cast balance <CREDIT_VAULT> --rpc-url $RPC --ether

# InstructionSender linked to extension
cast call <INSTRUCTION_SENDER> "getExtensionId()" --rpc-url $RPC

# SmartAccountReceiver wired to vault
cast call <SMART_ACCOUNT_RECEIVER> "vault()" --rpc-url $RPC

# Docker healthy
docker ps --filter "name=tee" --format "table {{.Names}}\t{{.Status}}"

# Proxy reachable locally and via tunnel
curl -sf http://localhost:6675/state
curl -sf <TUNNEL_URL>/info
```

### Port Reference

| Service | Container Port | Host Port | Notes |
|---------|---------------|-----------|-------|
| ext-proxy internal | 6663 | 6675 | Used by extension-tee and local debugging |
| ext-proxy external | 6664 | 6676 | Exposed via tunnel for Flare infrastructure |
| redis | 6379 | 6383 | Proxy state store |
| TEE sign server | 8882 | (internal) | Only accessible within Docker network |
| TEE extension | 8883 | (internal) | Only accessible within Docker network |

---

## Testing

### Smart Contracts

```bash
cd contracts
forge test              # Run all tests
forge test -vv          # Verbose output
forge test --match-contract CreditVault   # Target specific contract
forge snapshot          # Gas snapshots
```

Test coverage:
- Score storage and ECDSA signature validation
- Collateral deposits (FLR + FXRP) and withdrawals
- Borrowing within and beyond tier LTV limits
- Fee accrual over time (warp-based)
- Partial and full repayment
- Liquidation of unhealthy positions
- Health factor edge cases
- Smart Account proxy function authorization

### TEE Extension

```bash
cd tee/typescript
npm install
npm test                # Scoring algorithm + Plaid fallback tests
```

### Frontend

```bash
cd frontend
npm run build           # Type-check + production build
npm run lint            # ESLint
```

### End-to-End Test

Once everything is deployed and running:

1. Open http://localhost:5173
2. Connect MetaMask (Coston2 network)
3. Go to **Score** tab → Connect bank (Plaid Sandbox) → Request credit score
4. Wait ~30s for TEE to process and return the score
5. Go to **Lend** tab → Deposit FLR → Borrow against your score-adjusted LTV
6. Check **Dashboard** → Verify position, health factor, and balances

---

## License

MIT
