#!/bin/bash
# Step 1: Deploy smart contracts to Coston2
#
# Prerequisites:
#   - Funded Coston2 wallet (PRIVATE_KEY in .env)
#   - Foundry installed
#
# Usage: ./scripts/deploy-contracts.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

# Load env
if [ -f tee/.env ]; then
  export $(grep -v '^#' tee/.env | xargs)
fi

CHAIN_URL="${CHAIN_URL:-https://coston2-api.flare.network/ext/C/rpc}"

# Addresses from Coston2 deployed-addresses.json
TEE_EXTENSION_REGISTRY="0x3d478d43426081BD5854be9C7c5c183bfe76C981"
TEE_MACHINE_REGISTRY="0x5918Cd58e5caf755b8584649Aa24077822F87613"
FTSOV2_ADDRESS="0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d"

# FXRP — use env or a placeholder (update after finding the Coston2 FXRP address)
FXRP_ADDRESS="${FXRP_ADDRESS:-0x0000000000000000000000000000000000000000}"

echo "=== Deploying FlareScore contracts to Coston2 ==="
echo "RPC: $CHAIN_URL"
echo "TEE Extension Registry: $TEE_EXTENSION_REGISTRY"
echo "TEE Machine Registry: $TEE_MACHINE_REGISTRY"
echo "FTSO v2: $FTSOV2_ADDRESS"
echo ""

cd contracts

PRIVATE_KEY="$PRIVATE_KEY" \
FTSOV2_ADDRESS="$FTSOV2_ADDRESS" \
FXRP_ADDRESS="$FXRP_ADDRESS" \
TEE_EXTENSION_REGISTRY="$TEE_EXTENSION_REGISTRY" \
TEE_MACHINE_REGISTRY="$TEE_MACHINE_REGISTRY" \
forge script script/Deploy.s.sol \
  --rpc-url "$CHAIN_URL" \
  --broadcast \
  --verify \
  -vvv

echo ""
echo "=== Deployment complete ==="
echo "Copy the deployed addresses above into tee/.env:"
echo "  INSTRUCTION_SENDER=0x..."
echo "  (also update frontend/.env with VITE_CREDIT_VAULT_ADDRESS, etc.)"
