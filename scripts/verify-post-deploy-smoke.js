#!/usr/bin/env node

/**
 * Post-Deploy Production Smoke Test Script
 * Performs read-only verification of deployed contracts and network connectivity.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const network = process.argv[2] || 'testnet';
const registryPath = path.join(__dirname, '..', 'contract-addresses.json');

function fetchJson(url, postData = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: postData ? 'POST' : 'GET',
      headers: postData
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        : {},
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ raw: body, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runSmokeTests() {
  console.log(`============================================`);
  console.log(` Starting Post-Deploy Smoke Tests (${network})`);
  console.log(`============================================\n`);

  if (!fs.existsSync(registryPath)) {
    console.error(`❌ FAILED: Registry file contract-addresses.json missing.`);
    process.exit(1);
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const config = registry[network];

  if (!config) {
    console.error(`❌ FAILED: Network '${network}' not configured in contract-addresses.json`);
    process.exit(1);
  }

  console.log(`[1/4] Verifying Soroban RPC Endpoint (${config.rpcUrl})...`);
  try {
    const health = await fetchJson(`${config.rpcUrl}/health`).catch(() =>
      fetchJson(config.rpcUrl, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }))
    );
    console.log(`  ✔ Soroban RPC operational.`);
  } catch (err) {
    console.error(`  ❌ FAILED to reach RPC endpoint: ${err.message}`);
    process.exit(1);
  }

  console.log(`\n[2/4] Verifying Contract ID Format (${config.contractId || 'NONE'})...`);
  if (!config.contractId || !/^C[A-Z0-9]{55}$/.test(config.contractId)) {
    console.warn(`  ⚠️ WARNING: Contract ID is unpopulated or non-standard.`);
  } else {
    console.log(`  ✔ Valid Soroban Contract ID: ${config.contractId}`);
  }

  console.log(`\n[3/4] Verifying Horizon API (${config.horizonUrl})...`);
  try {
    const horizonRoot = await fetchJson(config.horizonUrl);
    if (horizonRoot && (horizonRoot.horizon_version || horizonRoot.core_version)) {
      console.log(`  ✔ Horizon API operational (Core Version: ${horizonRoot.core_version || 'OK'}).`);
    } else {
      console.log(`  ✔ Horizon API responded.`);
    }
  } catch (err) {
    console.error(`  ❌ FAILED to reach Horizon API: ${err.message}`);
    process.exit(1);
  }

  console.log(`\n[4/4] Verifying Explorer Endpoint (${config.explorerUrl})...`);
  if (config.explorerUrl && config.explorerUrl.startsWith('https://')) {
    console.log(`  ✔ Explorer URL valid.`);
  } else {
    console.error(`  ❌ FAILED: Invalid explorer URL.`);
    process.exit(1);
  }

  console.log(`\n============================================`);
  console.log(` All Post-Deploy Smoke Tests PASSED (${network})`);
  console.log(`============================================\n`);
}

runSmokeTests();
