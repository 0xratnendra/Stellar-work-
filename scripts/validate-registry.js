#!/usr/bin/env node

/**
 * Validates the schema and completeness of contract-addresses.json
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', 'contract-addresses.json');
const VALID_NETWORKS = ['testnet', 'futurenet', 'mainnet'];
const CONTRACT_ID_REGEX = /^C[A-Z0-9]{55}$/;
const HEX_64_REGEX = /^[a-fA-F0-9]{64}$/;

function validateRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error(`Error: Registry file not found at ${REGISTRY_PATH}`);
    process.exit(1);
  }

  let data;
  try {
    const content = fs.readFileSync(REGISTRY_PATH, 'utf8');
    data = JSON.parse(content);
  } catch (err) {
    console.error(`Error parsing JSON in ${REGISTRY_PATH}: ${err.message}`);
    process.exit(1);
  }

  let hasErrors = false;

  for (const net of VALID_NETWORKS) {
    if (!data[net]) {
      console.error(`Validation Error: Missing entry for network '${net}'`);
      hasErrors = true;
      continue;
    }

    const entry = data[net];
    const { contractId, wasmHash, rpcUrl, passphrase, horizonUrl } = entry;

    if (!rpcUrl || !passphrase || !horizonUrl) {
      console.error(`Validation Error [${net}]: Missing network metadata (rpcUrl/passphrase/horizonUrl)`);
      hasErrors = true;
    }

    if (contractId && !CONTRACT_ID_REGEX.test(contractId)) {
      console.error(`Validation Error [${net}]: Invalid Contract ID format '${contractId}'`);
      hasErrors = true;
    }

    if (wasmHash && !HEX_64_REGEX.test(wasmHash)) {
      console.error(`Validation Error [${net}]: Invalid WASM hash format '${wasmHash}'`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error(`Registry validation failed!`);
    process.exit(1);
  }

  console.log(`Contract address registry validation PASSED.`);
}

validateRegistry();
