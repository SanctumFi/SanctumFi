#!/bin/bash
# Full FlareScore TEE setup — runs all steps in order.
#
# Prerequisites:
#   - Funded Coston2 wallet private key
#   - Plaid Sandbox credentials
#   - Docker + Docker Compose
#   - Foundry (forge, cast)
#   - cloudflared or ngrok
#
# Usage: ./scripts/full-setup.sh
#
# This script is interactive — it pauses between steps so you can
# copy addresses and update .env.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "============================================"
echo "  FlareScore TEE — Full Setup"
echo "============================================"
echo ""
echo "This will:"
echo "  1. Deploy smart contracts to Coston2"
echo "  2. Register TEE extension"
echo "  3. Build + start Docker stack"
echo "  4. Start tunnel"
echo "  5. Register TEE version + machine"
echo ""

# Check prereqs
for cmd in forge cast docker; do
  if ! command -v $cmd &>/dev/null; then
    echo "ERROR: $cmd not found. Install it first."
    exit 1
  fi
done

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example and set PRIVATE_KEY + PLAID creds."
  exit 1
fi

source .env

echo "=== Step 1/5: Deploy contracts ==="
./scripts/deploy-contracts.sh

echo ""
echo ">>> Copy the deployed addresses into .env, then press Enter to continue"
read -r

source .env

echo "=== Step 2/5: Register extension ==="
./scripts/register-extension.sh

echo ""
echo ">>> Copy EXTENSION_ID into .env, then press Enter to continue"
read -r

source .env

echo "=== Step 3/5: Start Docker stack ==="
echo "First, create config/proxy/extension_proxy.toml from the .example file."
echo ">>> Press Enter when ready"
read -r

./scripts/start-stack.sh

echo ""
echo "=== Step 4/5: Start tunnel ==="
echo "In a NEW terminal, run:"
echo "  cloudflared tunnel --url http://localhost:6676"
echo "  OR: ngrok http 6676"
echo ""
echo ">>> Copy the tunnel URL into .env as TUNNEL_URL, then press Enter"
read -r

source .env

echo "=== Step 5/5: Register TEE version + machine ==="
./scripts/register-tee-version.sh

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Your TEE extension is running and registered."
echo ""
echo "Test with:"
echo "  curl http://localhost:6675/state"
echo "  curl $TUNNEL_URL/state"
echo ""
echo "Frontend config (add to frontend/.env):"
echo "  VITE_CREDIT_VAULT_ADDRESS=<from step 1>"
echo "  VITE_SMART_ACCOUNT_RECEIVER_ADDRESS=<from step 1>"
echo "  VITE_FXRP_ADDRESS=$FXRP_ADDRESS"
