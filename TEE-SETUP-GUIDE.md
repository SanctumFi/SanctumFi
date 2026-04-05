# FlareScore TEE Setup Guide

Step-by-step guide to deploy and register the FlareScore TEE extension on Coston2.
Tested on Windows 11 + Docker Desktop. Works on Linux with minor path differences.

## Prerequisites

- **Docker + Docker Compose**
- **Go >= 1.23** (for registration tools in `tee/go/tools/`)
- **Foundry** (`forge`, `cast`) — install with `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- **cloudflared** — install from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ (no account required)
- **Node.js >= 18** (for frontend)
- A funded Coston2 wallet (needs C2FLR for gas + TEE registration fees)

## Architecture Overview

```
                    XRPL User (Xaman)
                         |
                   Payment Memo
                         |
                         v
              SmartAccountReceiver ──> CreditVault
                         |                  |
                 InstructionSender     FTSO V2
                         |            (price feeds)
                         v
              TeeExtensionRegistry
                         |
                    TEE Proxy ◄── cloudflared tunnel
                         |
                    TEE Node + Extension
                    (Docker container)
                         |
                    Plaid API (Sandbox)
```

## Directory Structure

```
Flare/
├── contracts/          # Solidity (Foundry)
├── frontend/           # React + Vite
├── tee/
│   ├── typescript/     # TEE extension (handler code)
│   ├── go/             # Go tools (registration, deployment)
│   │   └── tools/      # CLI tools for steps 5-6
│   ├── proxy/          # Extension proxy Dockerfile
│   ├── config/
│   │   ├── coston2/deployed-addresses.json   # Flare system contracts
│   │   └── proxy/extension_proxy.toml        # Proxy DB config
│   ├── scripts/        # Shell scripts (optional helpers)
│   ├── docker-compose.yaml
│   ├── .env
│   └── .env.example
```

---

## Step 0: Configure Environment

### tee/.env

```bash
cp tee/.env.example tee/.env
```

Fill in:
```env
PRIVATE_KEY=<your-funded-coston2-private-key-no-0x-prefix>
INITIAL_OWNER=<address-derived-from-private-key>
PLAID_CLIENT_ID=<plaid-sandbox-client-id>
PLAID_SECRET=<plaid-sandbox-secret>

# These are set later:
INSTRUCTION_SENDER=
EXTENSION_ID=
TUNNEL_URL=

# Coston2 system contracts (do not change)
CHAIN_URL=https://coston2-api.flare.network/ext/C/rpc
TEE_EXTENSION_REGISTRY=0x3d478d43426081BD5854be9C7c5c183bfe76C981
TEE_MACHINE_REGISTRY=0x5918Cd58e5caf755b8584649Aa24077822F87613
TEE_VERSION_MANAGER=0x2da0D3bcAB211f59e3f1115B071d088D88C8f8fc
FTSOV2_ADDRESS=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
NORMAL_PROXY_URL=https://tee-proxy-coston2-1.flare.rocks
FXRP_ADDRESS=0x0000000000000000000000000000000000000000
FEE_WEI=1000000000000
LOCAL_MODE=false
```

### contracts/.env

```env
PRIVATE_KEY=0x<same-key-WITH-0x-prefix>
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FTSOV2_ADDRESS=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
FXRP_ADDRESS=0x0000000000000000000000000000000000000000
TEE_EXTENSION_REGISTRY=0x3d478d43426081BD5854be9C7c5c183bfe76C981
TEE_MACHINE_REGISTRY=0x5918Cd58e5caf755b8584649Aa24077822F87613
```

### Proxy config

```bash
cp tee/config/proxy/extension_proxy.toml.example tee/config/proxy/extension_proxy.toml
```

Edit `extension_proxy.toml` and fill in the `[db]` section with Coston2 C-chain indexer credentials (provided by Flare for hackathon participants).

### deployed-addresses.json

Make sure `tee/config/coston2/deployed-addresses.json` contains ALL required addresses. The Go tools need these entries (among others):

- `TeeExtensionRegistry`
- `TeeMachineRegistry`
- `TeeVersionManager`
- `TeeVerification`
- `TeeWalletManager`
- `TeeWalletKeyManager`
- `TeeWalletProjectManager`
- `FlareSystemsManager`
- `Fdc2Hub`
- `TeeOwnerAllowlist`

If yours is incomplete, get the full list from:
https://github.com/flare-foundation/fce-sign/blob/main/config/coston2/deployed-addresses.json

---

## Step 1: Deploy Smart Contracts

```bash
cd contracts
forge build
```

Deploy CreditVault, SmartAccountReceiver, and InstructionSender to Coston2:

```bash
# Deploy CreditVault
# Args: ftsoV2, fxrp, teeSigner (deployer for now), scoreExpiry (86400 = 24h)
forge create src/CreditVault.sol:CreditVault \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args \
    0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d \
    0x0000000000000000000000000000000000000000 \
    <YOUR_DEPLOYER_ADDRESS> \
    86400

# Save the "Deployed to:" address as CREDIT_VAULT
```

```bash
# Deploy InstructionSender
# Args: teeExtensionRegistry, teeMachineRegistry
forge create src/InstructionSender.sol:InstructionSender \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args \
    0x3d478d43426081BD5854be9C7c5c183bfe76C981 \
    0x5918Cd58e5caf755b8584649Aa24077822F87613

# Save the "Deployed to:" address as INSTRUCTION_SENDER
```

```bash
# Deploy SmartAccountReceiver
# Args: vault, instructionSender, fxrp
forge create src/SmartAccountReceiver.sol:SmartAccountReceiver \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args \
    <CREDIT_VAULT> \
    <INSTRUCTION_SENDER> \
    0x0000000000000000000000000000000000000000

# Save the "Deployed to:" address as SMART_ACCOUNT_RECEIVER
```

### Configure CreditVault

```bash
RPC=https://coston2-api.flare.network/ext/C/rpc

# Link SmartAccountReceiver to CreditVault
cast send <CREDIT_VAULT> "setSmartAccountReceiver(address)" <SMART_ACCOUNT_RECEIVER> \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# Fund the lending pool with 10 FLR
cast send <CREDIT_VAULT> "fundPoolFLR()" --value 10ether \
  --rpc-url $RPC --private-key $PRIVATE_KEY
```

### Verify deployment

```bash
cast call <CREDIT_VAULT> "owner()" --rpc-url $RPC
cast call <CREDIT_VAULT> "smartAccountReceiver()" --rpc-url $RPC
cast balance <CREDIT_VAULT> --rpc-url $RPC --ether   # should show 10
```

---

## Step 2: Register TEE Extension

Update `tee/.env`:
```env
INSTRUCTION_SENDER=<INSTRUCTION_SENDER address from step 1>
```

```bash
cd tee/go/tools
go run ./cmd/register-extension
```

This prints an extension ID (e.g. `271`). Save it in `tee/.env` as a 32-byte hex:
```env
EXTENSION_ID=0x000000000000000000000000000000000000000000000000000000000000010f
```

Then call `setExtensionId()` on the InstructionSender:
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

## Step 3: Build and Start Docker Stack

```bash
cd tee
docker compose build
docker compose up -d
```

Wait for everything to be healthy:
```bash
# Wait for proxy
until curl -sf http://localhost:6676/info >/dev/null 2>&1; do sleep 2; done
echo "Extension proxy is ready"

# Verify all containers
docker ps --filter "name=tee" --format "table {{.Names}}\t{{.Status}}"
```

You should see 3 containers: redis (healthy), ext-proxy (healthy), extension-tee (up).

---

## Step 4: Start Tunnel

In a **separate terminal** (keep it running):

```bash
cloudflared tunnel --url http://localhost:6676
```

Copy the HTTPS URL (e.g. `https://some-random-words.trycloudflare.com`) and update `tee/.env`:

```env
TUNNEL_URL=https://some-random-words.trycloudflare.com
```

Verify the tunnel works:
```bash
curl -s https://some-random-words.trycloudflare.com/info | head -c 100
# Should return JSON with TEE info
```

> **Important:** The tunnel must stay running. If it restarts with a new URL, you must update TUNNEL_URL, restart Docker, and redo steps 5-6.

---

## Step 5: Register TEE Version

```bash
cd tee/go/tools
go run ./cmd/allow-tee-version -p http://localhost:6676
```

This registers the code hash and platform with `TeeVersionManager`.

---

## Step 6: Register TEE Machine

```bash
cd tee/go/tools
go run ./cmd/register-tee -p http://localhost:6676 -l
```

The `-l` flag enables test mode (required for Coston2 with fake attestation).

This runs a multi-step process:
1. **Pre-registration** — registers TEE machine data on-chain
2. **Attestation** — requests TEE attestation
3. **FTDC availability check** — Flare's public proxy verifies your TEE is reachable
4. **To-production** — marks TEE as active

Expected output:
```
INFO  Registration of TEE with ID <tee-address>
INFO  (pre)registration of TEE ... succeeded
INFO  availability check sent, instructionId: ...
INFO  availability check proof obtained
INFO  Registered TEE node with id 0x<TEE_ADDRESS>
```

Save the TEE address from the output.

### Troubleshooting

If the availability check times out (404 after 60 retries):
```bash
# Restart Docker stack and retry
cd tee
docker compose down
docker compose up -d
# Wait for proxy to be healthy, then retry step 5 + 6
```

---

## Step 7: Set TEE Node as Trusted Signer

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

## Step 8: Update Frontend

Edit `frontend/.env`:
```env
VITE_XAMAN_API_KEY=<your-xaman-api-key>
VITE_CREDIT_VAULT_ADDRESS=<CREDIT_VAULT>
VITE_SMART_ACCOUNT_RECEIVER_ADDRESS=<SMART_ACCOUNT_RECEIVER>
VITE_FXRP_ADDRESS=0x0000000000000000000000000000000000000000
VITE_INSTRUCTION_SENDER_ADDRESS=<INSTRUCTION_SENDER>
```

Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## Verification Checklist

Run these to confirm everything is wired correctly:

```bash
RPC=https://coston2-api.flare.network/ext/C/rpc

# Contracts deployed and configured
cast call <CREDIT_VAULT> "owner()" --rpc-url $RPC
cast call <CREDIT_VAULT> "teeSigner()" --rpc-url $RPC
cast call <CREDIT_VAULT> "smartAccountReceiver()" --rpc-url $RPC
cast balance <CREDIT_VAULT> --rpc-url $RPC --ether

# InstructionSender linked to extension
cast call <INSTRUCTION_SENDER> "getExtensionId()" --rpc-url $RPC

# SmartAccountReceiver correctly wired
cast call <SMART_ACCOUNT_RECEIVER> "vault()" --rpc-url $RPC
cast call <SMART_ACCOUNT_RECEIVER> "instructionSender()" --rpc-url $RPC

# TEE machine active
cast call 0x5918Cd58e5caf755b8584649Aa24077822F87613 \
  "getActiveTeeMachines(uint256)" <EXTENSION_ID_DECIMAL> --rpc-url $RPC

# Docker healthy
docker ps --filter "name=tee" --format "table {{.Names}}\t{{.Status}}"

# Tunnel reachable
curl -s <TUNNEL_URL>/info | head -c 100
```

---

## Port Reference

| Service            | Container port | Host port |
|--------------------|---------------|-----------|
| ext-proxy internal | 6663          | 6675      |
| ext-proxy external | 6664          | 6676      |
| redis              | 6379          | 6383      |
| TEE sign server    | 8882          | (internal)|
| TEE extension      | 8883          | (internal)|

The tunnel exposes host port 6676 (ext-proxy external) to the internet.

---

## Linux-Specific Notes

- Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Install cloudflared: `sudo apt install cloudflared` or download from Cloudflare
- Install Go: `sudo apt install golang-go` or download from https://go.dev
- Docker: `sudo apt install docker.io docker-compose-v2`
- All paths use forward slashes (no Windows path differences)
- The `cast` and `forge` commands are the same
- `docker compose` (v2) instead of `docker-compose` (v1)

---

## What Each Component Does

| Contract | Address | Role |
|----------|---------|------|
| **CreditVault** | deployed | Lending engine: positions, collateral, borrowing, liquidation, credit score verification |
| **InstructionSender** | deployed | Sends encrypted payloads to TEE machines via TeeExtensionRegistry |
| **SmartAccountReceiver** | deployed | Routes XRPL Smart Account payment memos to CreditVault functions |

| TEE Component | Role |
|---------------|------|
| **TEE Node** (Go binary) | Manages keys, signs/decrypts, routes instructions |
| **TEE Extension** (TypeScript) | Handles CREDIT/SCORE instructions: decrypt → Plaid API → compute score → sign result |
| **Proxy** | Watches chain for instructions, forwards to TEE node, submits results back |
| **Redis** | Proxy internal state storage |
| **Tunnel** | Exposes proxy externally so Flare infrastructure can reach it |

### Credit Score Flow

```
1. Frontend encrypts {plaid_access_token, user_address} with TEE public key
2. Frontend calls InstructionSender.requestCreditScore(encryptedPayload)
3. InstructionSender sends instruction via TeeExtensionRegistry
4. TEE proxy picks up instruction from chain
5. TEE node forwards to extension handler (POST /action)
6. Extension: decrypt → call Plaid API → compute 4-factor score → sign with TEE key
7. Returns ABI-encoded (address, uint256, uint256, bytes) = (user, score, timestamp, signature)
8. TEE node sends result back via proxy
9. Frontend polls proxy, gets result, calls CreditVault.receiveScore(user, score, timestamp, sig)
10. CreditVault verifies signature matches teeSigner, stores score
```
