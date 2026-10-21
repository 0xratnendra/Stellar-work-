# Environment Reference

This page lists the environment variables used by StellarWork and how they differ between local development, Testnet, and Mainnet.

## Frontend Variables

Create `frontend/.env.local` from `frontend/.env.example` for local development.

| Variable | Required | Default | Used by | Description |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_CONTRACT_ID` | Yes | None | `frontend/lib/contract.ts` | Deployed escrow contract ID for the selected network. This is printed by `soroban contract deploy` and usually starts with `C`. |
| `NEXT_PUBLIC_NETWORK` | No | `testnet` | `frontend/lib/stellar.ts` | Selects the Stellar network passphrase and explorer links. Set to `mainnet` for public network; any other value uses Testnet. |
| `NEXT_PUBLIC_SOROBAN_RPC` | No | `https://soroban-testnet.stellar.org` | `frontend/lib/stellar.ts` | Soroban RPC endpoint used for simulations, reads, and transaction submission. Set this explicitly for Mainnet. |
| `NEXT_PUBLIC_NATIVE_TOKEN` | No | Empty string | `frontend/app/post-job/page.tsx` | Optional token contract address used to prefill the Post Job form. Users can still type a token address manually. |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | No | Empty string | `frontend/app/navigation.tsx`, `frontend/app/admin/page.tsx` | Admin Stellar address (starting with `G`). When set, the Admin link and panel are accessible only to this exact connected wallet (case-sensitive). When unset, admin features and navigation links are hidden and mutating actions are disabled for safety. |

### Build-Time Validation (#645)

`npm run build` runs `npm run prebuild` first, which invokes
`frontend/scripts/validate-env.mjs`. It checks the same required variables as
`frontend/lib/config.ts`'s `validateConfig()`, but fails the build (exit code
1) rather than surfacing a runtime error to a user in the browser:

- Missing `NEXT_PUBLIC_CONTRACT_ID` (and no per-network fallback set) — error
- `NEXT_PUBLIC_CONTRACT_ID` that isn't a well-formed Soroban contract ID
  (`C` + 55 base32 characters) — error
- `NEXT_PUBLIC_NETWORK=mainnet` combined with a `NEXT_PUBLIC_SOROBAN_RPC`
  that still points at a testnet endpoint — error
- Unrecognized `NEXT_PUBLIC_NETWORK` value, missing `NEXT_PUBLIC_NATIVE_TOKEN`,
  missing `NEXT_PUBLIC_ADMIN_ADDRESS` — warning only, build continues

Run it standalone at any time with `npm run validate-env` from `frontend/`.

## Local Development
## Environment Overview

This page summarizes the environment variables and target environments for StellarWork.

## Environment Variables

All environment variables are prefixed with `NEXT_PUBLIC_` to make them available in the browser.

### Required Variables

| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed escrow contract ID on Stellar | *None* (required) | Used in `frontend/lib/contract.ts` to identify the contract to interact with |

### Optional Variables

| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `NEXT_PUBLIC_NETWORK` | Target Stellar network | `testnet` | Controls network passphrase and explorer URLs. Set to `mainnet` for production. |
| `NEXT_PUBLIC_SOROBAN_RPC` | Soroban RPC endpoint URL | `https://soroban-testnet.stellar.org` | Used in `frontend/lib/stellar.ts` for RPC connections |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | Admin wallet address for admin panel access | *None* | Controls access to admin features. When set, access is granted only to this exact case-sensitive address. When unset, admin features are disabled for safety. |
| `NEXT_PUBLIC_NATIVE_TOKEN` | Default native token contract address | *None* | Pre-fills the token address field in the post-job form |

### Deprecated/Documented Variables

The following variables are documented in `frontend/README.md` but **not currently used** in the codebase:

| Variable | Status | Note |
|----------|--------|------|
| `NEXT_PUBLIC_HORIZON_URL` | Not used | Documented but not referenced in code |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Not used | Code uses `NEXT_PUBLIC_SOROBAN_RPC` instead |

## Target Environments

### Testnet (Default)

- **Network Passphrase**: `Test SDF Network ; September 2015`
- **RPC URL**: `https://soroban-testnet.stellar.org`
- **Explorer**: `https://stellar.expert/explorer/testnet/tx`
- **Purpose**: Development and testing
- **Funding**: Available via [Stellar Friendbot](https://laboratory.stellar.org/#account-creator?network=testnet)

### Mainnet (Production)

- **Network Passphrase**: `Public Global Stellar Network ; September 2015`
- **RPC URL**: Configure via `NEXT_PUBLIC_SOROBAN_RPC`
- **Explorer**: `https://stellar.expert/explorer/public/tx`
- **Purpose**: Production deployment
- **Configuration**: Set `NEXT_PUBLIC_NETWORK=mainnet`

## Configuration Files

### Frontend

Create `frontend/.env.local` from the template:

```bash
cd frontend
cp .env.example .env.local
```

For a local Testnet-backed frontend, set at least:

```bash
NEXT_PUBLIC_CONTRACT_ID=<TESTNET_CONTRACT_ID>
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC=https://soroban-testnet.stellar.org
```

`NEXT_PUBLIC_NATIVE_TOKEN` and `NEXT_PUBLIC_ADMIN_ADDRESS` are optional, but setting them makes the Post Job and Admin flows easier to test.

## Testnet Notes

- Use a contract deployed with `--network testnet`.
- Keep `NEXT_PUBLIC_NETWORK=testnet`.
- The default Soroban RPC is `https://soroban-testnet.stellar.org`.
- Testnet wallets must be funded separately from Mainnet wallets.
- If the contract is redeployed, update `NEXT_PUBLIC_CONTRACT_ID` and restart the frontend dev server.

## Mainnet Notes

- Use a contract deployed to the Stellar public network.
- Set `NEXT_PUBLIC_NETWORK=mainnet`.
- Set `NEXT_PUBLIC_SOROBAN_RPC` to a Mainnet Soroban RPC endpoint from the deployment provider.
- Use Mainnet token contract addresses for `NEXT_PUBLIC_NATIVE_TOKEN`.
- Verify `NEXT_PUBLIC_ADMIN_ADDRESS` before deployment because it controls access to the Admin UI.
- Never reuse Testnet contract IDs or token addresses on Mainnet.

## Docker Development Variables

`docker-compose.yml` sets these container-only development values:

| Variable | Value | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runs the frontend in development mode. |
| `WATCHPACK_POLLING` | `true` | Improves hot reload reliability with mounted volumes. |
| `CHOKIDAR_USEPOLLING` | `true` | Improves file watching inside Docker. |

The frontend Dockerfile also sets production runtime values such as `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, and `PORT=3000`. These do not replace the `NEXT_PUBLIC_*` deployment values above.
**Note**: A `.env.example` file should be created to document the expected variables.

### Docker

The `docker-compose.yml` file sets the following environment variables for the frontend container:

- `NODE_ENV=development`
- `WATCHPACK_POLLING=true`
- `CHOKIDAR_USEPOLLING=true`

## Network Detection Logic

The network is determined in `frontend/lib/stellar.ts`:

```typescript
const getNetwork = () =>
  process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";

const getNetworkPassphrase = () =>
  process.env.NEXT_PUBLIC_NETWORK === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;
```

If `NEXT_PUBLIC_NETWORK` is not set or is not `"mainnet"`, the application defaults to testnet.

## Explorer URLs

Transaction explorer URLs are generated based on the network:

- **Testnet**: `https://stellar.expert/explorer/testnet/tx/{hash}`
- **Mainnet**: `https://stellar.expert/explorer/public/tx/{hash}`

See `frontend/lib/stellar.ts` `getExplorerTxUrl()` function.

## Deployment Considerations

### Testnet Deployment

Follow the [testnet deployment guide](./testnet-deployment-guide.md) for step-by-step instructions.

Key steps:
1. Configure Soroban identity and network
2. Build and deploy contract
3. Initialize contract with admin and native token
4. Set `NEXT_PUBLIC_CONTRACT_ID` in `frontend/.env.local`

### Mainnet Deployment

For mainnet deployment:

1. Set `NEXT_PUBLIC_NETWORK=mainnet`
2. Configure `NEXT_PUBLIC_SOROBAN_RPC` to mainnet RPC endpoint
3. Deploy contract to mainnet
4. Update `NEXT_PUBLIC_CONTRACT_ID` to mainnet contract ID
5. Set `NEXT_PUBLIC_ADMIN_ADDRESS` if admin access is restricted
6. Verify explorer URLs point to mainnet

## Access Control & Exact Match Requirements

### `NEXT_PUBLIC_ADMIN_ADDRESS` Exact Match & Case Sensitivity

Access to administrative controls (the Admin navigation link and the `/admin` management dashboard) is strictly gated by the `NEXT_PUBLIC_ADMIN_ADDRESS` environment variable:

- **Case-Sensitive Comparison**: Stellar public keys (56-character base32 strings beginning with `G`) are evaluated using strict equality (`walletAddress === envAdmin`). A case mismatch or truncated address will fail authentication.
- **Unset Safety Behavior**: When `NEXT_PUBLIC_ADMIN_ADDRESS` is unset or empty, the application disables all admin features for safety. The "Admin" navigation link is hidden, and direct access to `/admin` renders an access-denied state.
- **Client-Side Baking**: Because Next.js App Router bakes `NEXT_PUBLIC_*` variables into static assets during build time, changes to this variable require restarting the local development server (`npm run dev`) or triggering a frontend redeployment in production.

### Troubleshooting: Admin Link Does Not Appear

If `NEXT_PUBLIC_ADMIN_ADDRESS` has been set in your environment configuration but the "Admin" link does not appear in the navigation bar:

1. **Verify Exact Case & Formatting**: Compare your connected Freighter address character-by-character with the value in `.env.local` or your hosting environment. Ensure there are no accidental spaces, leading/trailing whitespace, or quotes around the address.
2. **Confirm Wallet Connection**: The Admin navigation link only renders once a wallet is actively connected to the site. If no wallet is connected, the link remains hidden.
3. **Verify Variable Name Prefix**: Ensure the variable is prefixed with `NEXT_PUBLIC_` (i.e. `NEXT_PUBLIC_ADMIN_ADDRESS`, not `ADMIN_ADDRESS`). Variables without this prefix are not bundled into client-side JavaScript.
4. **Dev Server Restart / Build Invalidation**: When modifying `frontend/.env.local`, you must stop and restart the Next.js development server (`npm run dev`). If deploying to production (e.g. Vercel, Docker, Kubernetes), trigger a new build and redeploy.

### Checklist: Updating Admin Address After Ownership Transfer

When performing a platform contract admin rotation or transferring governance ownership:

- [ ] **1. Execute On-Chain Transfer**: Call `transfer_admin` on the Soroban escrow contract and ensure the transaction confirms on-chain.
- [ ] **2. Update Environment Configuration**: Update `NEXT_PUBLIC_ADMIN_ADDRESS` to the new admin's Stellar public key in `frontend/.env.local` (local), Kubernetes ConfigMaps, or Vercel environment variables.
- [ ] **3. Trigger Frontend Rebuild & Deploy**: Re-run `npm run build` or trigger a deployment pipeline so the new public key is baked into client bundles.
- [ ] **4. Verify New Admin Access**: Connect with the new admin wallet and verify that the "Admin" navigation link appears and fee withdrawal/dispute resolution tools load successfully.
- [ ] **5. Confirm Old Admin Locked Out**: Connect with the retired admin wallet and verify that the "Admin" link is gone and visiting `/admin` directly displays "Access Denied".

## Common Issues

- **`NEXT_PUBLIC_CONTRACT_ID is not configured`**: Ensure `frontend/.env.local` exists and contains the contract ID. Restart the dev server after changes.
- **Wrong network**: Verify `NEXT_PUBLIC_NETWORK` matches the deployed contract network.
- **RPC connection errors**: Check that `NEXT_PUBLIC_SOROBAN_RPC` is accessible and matches the target network.

## Synchronization with Code

This document is synchronized with the codebase as of the latest commit. When adding new environment variables:

1. Add the variable to the appropriate section above
2. Update the `.env.example` file (if it exists)
3. Update relevant documentation (README.md, deployment guides)
4. Ensure the variable is properly documented with its default value and usage
