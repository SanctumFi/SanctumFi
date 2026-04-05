# Veil

**Credit-scored DeFi lending on the Flare blockchain.**

Veil lets users connect their bank accounts to receive a privacy-preserving credit score computed inside a Trusted Execution Environment (TEE), then borrow cryptocurrency with collateral requirements dynamically adjusted based on that score. Higher scores unlock better loan-to-value ratios — bridging traditional finance credit history into decentralized lending.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Smart Contracts](#smart-contracts)
- [Frontend](#frontend)
- [TEE Credit Scoring Extension](#tee-credit-scoring-extension)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Testing](#testing)
- [XRPL Integration](#xrpl-integration)

---

## Overview

Veil solves a core DeFi problem: over-collateralization. Traditional DeFi requires 150–200% collateral because borrowers are anonymous. Veil uses real banking data — processed privately inside a TEE — to assign a credit score (0–1000) that earns better borrowing terms.

**Credit Score Tiers:**

| Tier     | Score Range | Loan-to-Value |
|----------|-------------|---------------|
| Platinum | 800 – 1000  | 80%           |
| Gold     | 600 – 799   | 120%          |
| Silver   | 400 – 599   | 150%          |
| Bronze   | 0 – 399     | 200%          |

**Key properties:**
- Raw banking data never touches the blockchain — only the TEE-signed score does
- Scores expire after 24 hours (configurable), requiring periodic re-attestation
- Collateral: FLR (native Flare) and FXRP (wrapped XRP on Flare)
- Borrowable assets: FLR and FXRP
- 5% APR fee on outstanding debt
- XRPL users can interact via XRP payment memos without a Flare wallet

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 MetaMask Wallet                 │
└─────────────────────┬───────────────────────────┘
                      │
           ┌──────────▼──────────┐
           │   React Frontend    │
           │  Dashboard · Score  │
           │  Lend · XRPL Guide  │
           └──────────┬──────────┘
                      │ ethers.js
      ┌───────────────▼─────────────────────┐
      │         Flare Testnet (Coston2)     │
      │  ┌─────────────────────────────┐   │
      │  │        CreditVault          │   │
      │  │  Collateral · Borrow        │   │
      │  │  Score-based LTV · Fees     │   │
      │  │  Liquidation · Health       │   │
      │  └─────────────────────────────┘   │
      │  ┌─────────────────────────────┐   │
      │  │     InstructionSender       │   │
      │  │  Routes score requests      │   │
      │  │  to TEE extension           │   │
      │  └─────────────────────────────┘   │
      │  ┌─────────────────────────────┐   │
      │  │   SmartAccountReceiver      │   │
      │  │  XRPL ↔ Flare address map   │   │
      │  └─────────────────────────────┘   │
      │  ┌─────────────────────────────┐   │
      │  │       FTSO V2 Oracle        │   │
      │  │  FLR/USD · XRP/USD          │   │
      │  └─────────────────────────────┘   │
      └───────────────┬─────────────────────┘
                      │
      ┌───────────────▼─────────────────────┐
      │   TEE (Trusted Execution Env)       │
      │  Decrypt payload → fetch Plaid      │
      │  → compute score → ABI-encode       │
      │  → sign → submit onchain            │
      └───────────────┬─────────────────────┘
                      │
      ┌───────────────▼─────────────────────┐
      │         Plaid API (Sandbox)         │
      │  Account balances · Transactions    │
      └─────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.25 · Foundry · OpenZeppelin v5.6.1 |
| Blockchain | Flare Network (Coston2 Testnet) |
| Price Oracles | FTSO V2 (FLR/USD, XRP/USD) |
| TEE Backend | TypeScript · Flare TEE Extension SDK |
| Banking Data | Plaid API (Sandbox) |
| Frontend | React 19 · TypeScript · Vite 8 |
| Styling | Tailwind CSS 4 |
| Web3 | ethers.js v6 · MetaMask |

---

## Project Structure

```
Veil/
├── contracts/                        # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── CreditVault.sol           # Core lending protocol
│   │   ├── InstructionSender.sol     # TEE score request dispatcher
│   │   ├── SmartAccountReceiver.sol  # XRPL bridge router
│   │   └── interfaces/
│   │       ├── ICreditVault.sol
│   │       ├── ITeeExtensionRegistry.sol
│   │       └── IFtsoV2.sol
│   ├── script/
│   │   └── Deploy.s.sol              # Foundry deployment script
│   ├── test/
│   │   ├── CreditVault.t.sol
│   │   ├── InstructionSender.t.sol
│   │   └── SmartAccountReceiver.t.sol
│   └── foundry.toml
│
├── frontend/                         # React + Vite application
│   ├── src/
│   │   ├── App.tsx                   # App shell with tab routing
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx         # Position overview
│   │   │   ├── Score.tsx             # Credit score request & display
│   │   │   ├── Lend.tsx              # Deposit / borrow / repay
│   │   │   └── Xrpl.tsx              # XRPL integration guide
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── ScoreDisplay.tsx
│   │   │   ├── PositionCard.tsx
│   │   │   ├── BorrowForm.tsx
│   │   │   ├── DepositForm.tsx
│   │   │   ├── RepayForm.tsx
│   │   │   ├── HealthBar.tsx
│   │   │   └── XrplGuide.tsx
│   │   ├── hooks/
│   │   │   ├── usePosition.ts        # Vault position (auto-refresh 15s)
│   │   │   ├── useCreditScore.ts     # Score request handler
│   │   │   └── usePrices.ts          # FTSO price feeds (auto-refresh 10s)
│   │   └── config/
│   │       ├── contracts.ts          # Addresses & ABIs
│   │       └── chains.ts             # Coston2 network config
│   └── package.json
│
└── tee/typescript/app/               # TEE credit scoring extension
    ├── lib/
    │   ├── plaid.ts                  # Plaid API integration
    │   └── scoring.ts                # Score algorithm (0–1000)
    ├── handlers/
    │   └── creditScore.ts            # Score computation handler
    └── register.ts                   # TEE extension registration
```

---

## Smart Contracts

### CreditVault.sol

The core protocol contract. Manages user positions, collateral, borrowing, fees, and liquidation.

**Collateral assets:** FLR (native), FXRP (ERC-20)  
**Borrowable assets:** FLR, FXRP  
**Interest rate:** 5% APR, accrued at repayment time  
**Score expiry:** 24 hours (configurable at deploy)

Key functions:

```solidity
// Called by TEE signer after score computation
receiveScore(address user, uint256 score, uint256 timestamp, bytes sig)

// Collateral management
depositFLR() payable
depositFXRP(uint256 amount)
withdrawCollateral(address asset, uint256 amount)

// Borrowing
borrow(address asset, uint256 amount)
repay(address asset, uint256 amount) payable

// Liquidation (anyone can call if health < 1.0)
liquidate(address user)

// Views
getHealthFactor(address user) returns (uint256)
getMaxBorrow(address user, address asset) returns (uint256)
getDebt(address user, address asset) returns (uint256)
```

**LTV logic:** `(totalDebtUSD / totalCollateralUSD) ≤ tierLTV`  
**Health factor:** `(totalCollateralUSD × 10000) / (totalDebtUSD × tierLTV)` — below 1.0 is liquidatable.

---

### InstructionSender.sol

Routes encrypted score requests from the frontend to the TEE extension registry. Users pay a small fee (0.01 FLR) per request to cover TEE computation costs.

---

### SmartAccountReceiver.sol

Maps XRPL addresses to derived Flare addresses so XRP users can interact with the protocol without a Flare wallet. Parses action memos from incoming XRP payments and routes calls to `CreditVault` and `InstructionSender`.

---

## Frontend

A dark-themed React SPA with four tab-based pages:

### Dashboard
- Live position overview: credit score and tier, collateral balances with USD values, outstanding debt, health factor progress bar
- Auto-refreshes every 15 seconds

### Score
- Triggers the Plaid bank connection flow
- Sends encrypted access token to `InstructionSender.requestCreditScore()` (0.01 FLR fee)
- Displays current score, tier, max LTV, and transaction link on Coston2 explorer

### Lend
Three forms on one page:

| Form | Action |
|------|--------|
| Deposit | Deposit FLR or FXRP as collateral |
| Borrow | Borrow FLR or FXRP up to credit-adjusted LTV |
| Repay | Repay debt (principal + accrued fees) |

### XRPL
Step-by-step guide for XRPL users showing the memo format for each action.

---

## TEE Credit Scoring Extension

The TEE extension runs inside a Trusted Execution Environment and handles the sensitive scoring pipeline:

1. **Decrypt** the encrypted Plaid token from the onchain request payload
2. **Fetch** 90 days of account balances and transaction history from Plaid
3. **Compute** a 0–1000 score from four equally weighted factors:

| Factor | Max | Description |
|--------|-----|-------------|
| Balance Health | 250 | Average balance vs. monthly spend ratio |
| Income Stability | 250 | Coefficient of variation of monthly income (lower variance = higher score) |
| Spending Discipline | 250 | Fraction of essential spending (rent, groceries, utilities, etc.) |
| Account Age | 250 | Months of history, capped at 24 months for full score |

4. **ABI-encode** `[user_address, score, timestamp]`
5. **Sign and submit** the result onchain via the TEE framework — the raw Plaid data never leaves the enclave

---

## Getting Started

### Prerequisites

- [Foundry](https://getfoundry.sh/) — smart contract toolchain
- Node.js 18+ and npm
- MetaMask browser extension
- Plaid sandbox credentials (free at [plaid.com/docs/sandbox](https://plaid.com/docs/sandbox/))

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env
# Edit .env with your keys and contract addresses (see Environment Variables)

forge install       # Install dependencies
forge build         # Compile contracts
forge test          # Run test suite
```

### 2. Frontend

```bash
cd frontend
npm install

# Create .env.local and set VITE_* contract addresses
cp .env.example .env.local

npm run dev         # Dev server at http://localhost:5173
npm run build       # Production build
npm run preview     # Preview production build
```

### 3. TEE Extension

```bash
cd tee/typescript
npm install
cp .env.example .env
# Edit .env with Plaid credentials and TEE node URL

npm run build       # Compile & package for TEE deployment
```

---

## Environment Variables

### contracts/.env

```env
PRIVATE_KEY=0x...
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
EXPLORER_API_KEY=

# Flare ecosystem addresses (Coston2)
FTSOV2_ADDRESS=0x3d893C53D9e8056135C26C8c638B76C8b60Df726
FXRP_ADDRESS=0x...
TEE_EXTENSION_REGISTRY=0x...
TEE_EXTENSION_ID=0x...
```

### frontend/.env.local

```env
VITE_CREDIT_VAULT_ADDRESS=0x...
VITE_INSTRUCTION_SENDER_ADDRESS=0x...
VITE_SMART_ACCOUNT_RECEIVER_ADDRESS=0x...
VITE_FXRP_ADDRESS=0x...
```

### tee/typescript/.env

```env
LANGUAGE=typescript
PRIVATE_KEY=0x...
PLAID_CLIENT_ID=...
PLAID_SECRET=...
TEE_NODE_URL=http://localhost:6663
EXTENSION_ID=0x...
```

---

## Deployment

Deploy all three contracts in one step using the Foundry script:

```bash
cd contracts

forge script script/Deploy.s.sol \
  --rpc-url $COSTON2_RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

The deploy script:
1. Deploys `InstructionSender` (TEE registry + extension ID)
2. Deploys `CreditVault` (FTSO V2, FXRP, TEE signer, 24h score expiry)
3. Deploys `SmartAccountReceiver` (vault + instruction sender)
4. Seeds the vault with 10 FLR initial liquidity

After deployment, copy the printed contract addresses into `frontend/.env.local`.

---

## Testing

```bash
cd contracts

forge test              # Run all tests
forge test -vv          # Verbose output
forge test --match-contract CreditVault   # Target specific contract
forge snapshot          # Generate gas snapshots
```

Test coverage includes:
- Score storage and signature validation
- Collateral deposits and withdrawals
- Borrowing within and beyond LTV limits
- Fee accrual over time (warp-based)
- Partial and full repayment
- Liquidation of unhealthy positions
- Health factor edge cases

---

## XRPL Integration

XRPL users can interact with Veil without a Flare wallet by sending XRP payments to the `SmartAccountReceiver` address with a structured memo:

| Action | Memo Format |
|--------|-------------|
| Deposit collateral | `action=deposit` |
| Request credit score | `action=score,token=<encrypted_plaid_token>` |
| Borrow FLR | `action=borrow,asset=FLR,amount=100` |
| Repay debt | `action=repay` |

The `SmartAccountReceiver` contract maps each XRPL address to a deterministic Flare address and routes the action to the appropriate protocol function.

---

## License

MIT
