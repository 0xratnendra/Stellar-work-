#!/usr/bin/env bash
set -euo pipefail

NETWORK="${1:-}"
if [[ -z "$NETWORK" ]]; then
  echo "Usage: $0 <network> [--source <identity>] [--admin <address>] [--native-token <address>]"
  echo ""
  echo "Available networks: testnet, futurenet, mainnet"
  exit 1
fi

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "futurenet" && "$NETWORK" != "mainnet" ]]; then
  echo "Error: Invalid network '$NETWORK'. Must be one of: testnet, futurenet, mainnet"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACT_DIR="$PROJECT_DIR/contracts/escrow"
ADDRESSES_FILE="$PROJECT_DIR/contract-addresses.json"

SOURCE_IDENTITY="stellarwork-admin"
ADMIN_ADDRESS=""
NATIVE_TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE_IDENTITY="$2"; shift 2 ;;
    --admin) ADMIN_ADDRESS="$2"; shift 2 ;;
    --native-token) NATIVE_TOKEN="$2"; shift 2 ;;
    *) shift ;;
  esac
done

declare -A NETWORK_CONFIG
NETWORK_CONFIG[testnet]="--rpc-url https://soroban-testnet.stellar.org --network-passphrase 'Test SDF Network ; September 2015'"
NETWORK_CONFIG[futurenet]="--rpc-url https://rpc-futurenet.stellar.org --network-passphrase 'Test SDF Future Network ; October 2022'"
NETWORK_CONFIG[mainnet]="--rpc-url https://mainnet.sorobanrpc.com --network-passphrase 'Public Global Stellar Network ; September 2015'"

echo "============================================"
echo " StellarWork Contract Deployment"
echo " Network: $NETWORK"
echo "============================================"

echo ""
echo "[1/5] Configuring Soroban network..."
if ! soroban config network ls | grep -q "^$NETWORK$"; then
  soroban config network add "$NETWORK" ${NETWORK_CONFIG[$NETWORK]}
  echo "  Network '$NETWORK' added to Soroban CLI config."
else
  echo "  Network '$NETWORK' already configured."
fi

echo ""
echo "[2/5] Building contract WASM..."
cd "$CONTRACT_DIR"
soroban contract build
WASM_PATH="$CONTRACT_DIR/target/wasm32-unknown-unknown/release/escrow.wasm"
if [[ ! -f "$WASM_PATH" ]]; then
  echo "Error: WASM not found at $WASM_PATH"
  exit 1
fi
echo "  WASM built: $WASM_PATH"

echo ""
echo "[3/5] Deploying contract to $NETWORK..."
CONTRACT_ID=$(soroban contract deploy \
  --wasm "$WASM_PATH" \
  --source "$SOURCE_IDENTITY" \
  --network "$NETWORK" 2>&1)
echo "  Contract ID: $CONTRACT_ID"

WASM_HASH=$(sha256sum "$WASM_PATH" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$WASM_PATH" 2>/dev/null | cut -d' ' -f1 || echo "")
DEPLOYING_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

echo ""
echo "[4/5] Saving contract address to registry..."
if [[ ! -f "$ADDRESSES_FILE" ]]; then
  echo '{}' > "$ADDRESSES_FILE"
fi
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$ADDRESSES_FILE', 'utf8'));
data['$NETWORK'] = data['$NETWORK'] || {};
data['$NETWORK'].contractId = '$CONTRACT_ID';
data['$NETWORK'].wasmHash = '$WASM_HASH';
data['$NETWORK'].deployingCommit = '$DEPLOYING_COMMIT';
data['$NETWORK'].admin = '$ADMIN_ADDRESS' || data['$NETWORK'].admin || '';
data['$NETWORK'].nativeToken = '$NATIVE_TOKEN' || data['$NETWORK'].nativeToken || '';
data['$NETWORK'].deployedAt = new Date().toISOString();
data['$NETWORK'].source = '$SOURCE_IDENTITY';
fs.writeFileSync('$ADDRESSES_FILE', JSON.stringify(data, null, 2) + '\n');
"
echo "  Validating updated registry..."
node "$PROJECT_DIR/scripts/validate-registry.js"
echo "  Address and WASM hash saved to $ADDRESSES_FILE"

echo ""
echo "[5/5] Saving environment file..."
ENV_FILE="$PROJECT_DIR/.env.$NETWORK"
cat > "$ENV_FILE" << EOF
# StellarWork $NETWORK deployment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
NEXT_PUBLIC_NETWORK=$NETWORK
NEXT_PUBLIC_SOROBAN_RPC=$(echo "${NETWORK_CONFIG[$NETWORK]}" | grep -o 'https://[^ ]*')
EOF
echo "  Environment saved to $ENV_FILE"

echo ""
echo "============================================"
echo " Deployment complete!"
echo " Contract ID: $CONTRACT_ID"
echo " Network:     $NETWORK"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Initialize the contract:"
echo "     ./scripts/init.sh $NETWORK --contract-id $CONTRACT_ID --admin <ADMIN_ADDRESS> --native-token <TOKEN_ADDRESS>"
echo ""
echo "  2. Configure frontend:"
echo "     cp .env.$NETWORK frontend/.env.local"
echo ""
