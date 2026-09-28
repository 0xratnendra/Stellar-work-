# Post-Deploy Production Smoke Test Checklist

## Overview
This checklist MUST be executed within 15 minutes following any production or testnet deployment to verify system health, contract address alignment, and frontend bundle integrity.

---

## Assigned Roles & Time Limits
- **Owner**: On-Call Release Lead / DevOps Engineer
- **Time Limit**: 15 minutes post-deploy completion
- **Execution Mode**: Automated verification script + Manual UI sanity checks

---

## 1. Automated Verification Step
Run the post-deploy smoke test script against the target network:

```bash
node ./scripts/verify-post-deploy-smoke.js production
```

Verify that all 4 checks pass:
- [x] Soroban RPC endpoint returns health status OK.
- [x] Contract ID format matches standard 56-character `C...` address.
- [x] Horizon API endpoint responds cleanly.
- [x] Explorer base URLs are reachable and correctly formatted.

---

## 2. Production Smoke Test Checklist

### A. Frontend Bundle & Route Verification
- [ ] **Home Page**: Loads cleanly with HTTP 200 without JavaScript console errors.
- [ ] **Job List / Explorer**: Renders current on-chain jobs and contract metadata.
- [ ] **Wallet Connection**: Connect button opens Freighter / Albedo / WalletConnect modal cleanly.
- [ ] **Read Contract Calls**: Fetching job details or escrow parameters completes without HTTP 500/400 errors.

### B. Environment & Address Alignment
- [ ] Deployed Contract ID matches entry in `contract-addresses.json`.
- [ ] Network passphrase matches expected chain (`Public Global Stellar Network ; September 2015` for mainnet).
- [ ] Transaction links route correctly to `stellar.expert` explorer.

### C. Incident & Rollback Escalation
If any critical check fails:
1. Revert production DNS / CDN target to previous stable release tag.
2. File an incident issue with tag `release-failure`.
3. Notify the engineering team in `#deployments`.
