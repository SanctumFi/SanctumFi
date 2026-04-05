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
└── tee/typescript/                     # TEE credit scoring extension
    ├── src/
    │   ├── main.ts                     # HTTP server entry point (port 8080)
    │   ├── app/
    │   │   ├── handlers.ts             # Score computation handler
    │   │   ├── scoring.ts              # 4-factor algorithm (0–1000)
    │   │   ├── plaid.ts                # Plaid API + sandbox fallback
    │   │   └── config.ts              # Constants (CREDIT/SCORE op codes)
    │   └── __tests__/
    │       ├── scoring.test.ts         # Algorithm edge cases
    │       ├── plaid-sandbox.test.ts   # Fallback scenarios
    │       └── integration.test.ts     # E2E encryption test
    ├── docker-compose.yml
    └── Dockerfile
```

---

## Getting Started

### Prerequisites

- [Foundry](https://getfoundry.sh/) — smart contract toolchain
- Node.js 18+ and npm
- Docker and Docker Compose
- MetaMask browser extension
- Plaid sandbox credentials (free at [plaid.com/docs/sandbox](https://plaid.com/docs/sandbox/))
- Coston2 testnet FLR (from [Flare Faucet](https://faucet.flare.network/coston2))

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env
# Edit .env with your deployer key and Coston2 addresses

forge install
forge build
forge test
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_CREDIT_VAULT_ADDRESS, VITE_INSTRUCTION_SENDER_ADDRESS, etc.

npm run dev         # Dev server at http://localhost:5173
```

### 3. TEE Extension

```bash
cd tee/typescript
npm install
cp .env.example .env
# Set PLAID_CLIENT_ID, PLAID_SECRET, PRIVATE_KEY

# Run with Docker
LANGUAGE=typescript docker compose up -d

# Expose proxy via tunnel (for TEE attestation)
cloudflared tunnel --url http://localhost:6676
```

---

## Deployment

### Deploy Contracts (one command)

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url $COSTON2_RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

The script deploys all three contracts, authorizes `SmartAccountReceiver` on the vault, and seeds 10 FLR of initial liquidity.

### Register TEE Extension

After deploying the Docker stack and exposing the tunnel:

1. Register the extension with `TeeExtensionRegistry` to get an extension ID
2. Register the TEE version with `TeeVersionManager`
3. Register the TEE machine (pre-register → attest → activate)

See `TEE-SETUP-GUIDE.md` for detailed registration steps.

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
npm test                # Scoring algorithm + Plaid fallback tests
```

---

## License

MIT
