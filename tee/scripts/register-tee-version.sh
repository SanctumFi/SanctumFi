#!/bin/bash
# Step 4: Register TEE version and machine on-chain
#
# This registers the code version hash and then the TEE machine
# with the TeeMachineRegistry for attestation.
#
# Prerequisites:
#   - Docker stack running (run start-stack.sh first)
#   - Tunnel URL set in .env (TUNNEL_URL)
#
# Usage: ./scripts/register-tee-version.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

CHAIN_URL="${CHAIN_URL:-https://coston2-api.flare.network/ext/C/rpc}"
TEE_VERSION_MANAGER="0x2da0D3bcAB211f59e3f1115B071d088D88C8f8fc"
TEE_MACHINE_REGISTRY="0x5918Cd58e5caf755b8584649Aa24077822F87613"
EXT_PROXY_URL="${EXT_PROXY_URL:-http://localhost:6675}"

if [ -z "${TUNNEL_URL:-}" ] || [[ "${TUNNEL_URL}" == *"<"* ]]; then
  echo "ERROR: Set TUNNEL_URL in .env (from cloudflared/ngrok output)"
  exit 1
fi

if [ -z "${EXTENSION_ID:-}" ]; then
  echo "ERROR: Set EXTENSION_ID in .env"
  exit 1
fi

echo "=== Step 4a: Register TEE version ==="
echo "Proxy URL: $EXT_PROXY_URL"

# Get the code hash from the running extension
CODE_HASH=$(curl -s "$EXT_PROXY_URL/state" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stateVersion',''))" 2>/dev/null || echo "")

if [ -z "$CODE_HASH" ]; then
  echo "WARNING: Could not fetch code hash from proxy. Using manual hash."
  echo "Make sure the TEE stack is running and proxy is healthy."
  CODE_HASH="0x0000000000000000000000000000000000000000000000000000000000000000"
fi

echo "Code hash: $CODE_HASH"

# Register version on TeeVersionManager via the proxy
curl -s -X POST "$EXT_PROXY_URL/register-version" \
  -H "Content-Type: application/json" \
  -d "{\"extensionId\": \"$EXTENSION_ID\"}" || true

echo ""
echo "=== Step 4b: Register TEE machine ==="
echo "Tunnel URL: $TUNNEL_URL"

# Pre-register TEE machine
curl -s -X POST "$EXT_PROXY_URL/register-machine" \
  -H "Content-Type: application/json" \
  -d "{
    \"extensionId\": \"$EXTENSION_ID\",
    \"url\": \"$TUNNEL_URL\",
    \"localMode\": true
  }" || true

echo ""
echo "=== Registration complete ==="
echo ""
echo "Verify with:"
echo "  curl $EXT_PROXY_URL/state"
echo "  curl $TUNNEL_URL/state"
