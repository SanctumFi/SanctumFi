#!/bin/bash
# Step 3: Build and start the full TEE stack
#
# Prerequisites:
#   - Docker + Docker Compose installed
#   - .env fully populated (PRIVATE_KEY, EXTENSION_ID, PLAID creds)
#   - config/proxy/extension_proxy.toml created from .example
#
# Usage: ./scripts/start-stack.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# Verify required files
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example and fill in values."
  exit 1
fi

if [ ! -f config/proxy/extension_proxy.toml ]; then
  echo "ERROR: config/proxy/extension_proxy.toml not found."
  echo "Copy config/proxy/extension_proxy.toml.example and fill in DB credentials."
  exit 1
fi

# Check required env vars
source .env
for var in PRIVATE_KEY EXTENSION_ID PLAID_CLIENT_ID PLAID_SECRET; do
  if [ -z "${!var:-}" ] || [[ "${!var}" == *"<"* ]]; then
    echo "ERROR: $var not set in .env"
    exit 1
  fi
done

echo "=== Building TEE stack ==="
docker compose build

echo ""
echo "=== Starting TEE stack ==="
docker compose up -d

echo ""
echo "=== Stack status ==="
docker compose ps

echo ""
echo "Waiting for services to be healthy..."
sleep 5
docker compose ps

echo ""
echo "=== Next steps ==="
echo "1. Start a tunnel to expose port 6676:"
echo "   cloudflared tunnel --url http://localhost:6676"
echo "   OR: ngrok http 6676"
echo ""
echo "2. Register TEE version (once tunnel is running):"
echo "   ./scripts/register-tee-version.sh"
