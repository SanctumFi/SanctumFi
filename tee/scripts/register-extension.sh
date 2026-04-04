#!/bin/bash
# Step 2: Register extension on TeeExtensionRegistry
#
# This registers the InstructionSender contract as a TEE extension
# and retrieves the assigned EXTENSION_ID.
#
# Prerequisites:
#   - Contracts deployed (run deploy-contracts.sh first)
#   - INSTRUCTION_SENDER address in .env
#
# Usage: ./scripts/register-extension.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

CHAIN_URL="${CHAIN_URL:-https://coston2-api.flare.network/ext/C/rpc}"
TEE_EXTENSION_REGISTRY="0x3d478d43426081BD5854be9C7c5c183bfe76C981"

if [ -z "${INSTRUCTION_SENDER:-}" ]; then
  echo "ERROR: Set INSTRUCTION_SENDER in .env first (from deploy output)"
  exit 1
fi

echo "=== Registering extension on TeeExtensionRegistry ==="
echo "InstructionSender: $INSTRUCTION_SENDER"
echo "Registry: $TEE_EXTENSION_REGISTRY"
echo ""

# Register the extension — this calls registerExtension on the registry
# The registry assigns an extensionId and links it to our InstructionSender
cast send "$TEE_EXTENSION_REGISTRY" \
  "registerExtension(address)" \
  "$INSTRUCTION_SENDER" \
  --rpc-url "$CHAIN_URL" \
  --private-key "$PRIVATE_KEY"

# Query the extension counter to find our ID
EXTENSION_COUNT=$(cast call "$TEE_EXTENSION_REGISTRY" \
  "extensionsCounter()(uint256)" \
  --rpc-url "$CHAIN_URL")

echo ""
echo "=== Extension registered ==="
echo "Extension ID: $EXTENSION_COUNT"
echo ""
echo "Update tee/.env with:"
echo "  EXTENSION_ID=$EXTENSION_COUNT"
echo ""
echo "Then call setExtensionId() on InstructionSender:"
echo "  cast send $INSTRUCTION_SENDER 'setExtensionId()' --rpc-url $CHAIN_URL --private-key \$PRIVATE_KEY"
