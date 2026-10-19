# Production Launch Checklist

Pre-launch checklist for deploying StellarWork to production. Complete every item and record the result before going live. Do not skip items — each one protects users or funds.

> Work through this checklist in order. Items in earlier sections must be complete before later sections are meaningful.

---

## How to Use This Checklist

- Work through each section top-to-bottom.
- Mark each item ✅ when complete or ❌ if blocked (note the blocker inline).
- Assign a responsible person and a completion timestamp for each section.
- Keep a copy of the completed checklist in the deployment log.

---

## Section 1 — Code & Contract Readiness

**Owner:** ____________  **Completed:** ____________

### 1.1 Contract

- [ ] All contract unit tests pass: `cd contracts/escrow && cargo test`
- [ ] Contract builds without warnings: `soroban contract build`
- [ ] WASM artifact exists at `target/wasm32-unknown-unknown/release/escrow.wasm`
- [ ] WASM SHA-256 hash recorded and stored in deployment log
- [ ] Contract version number (`CONTRACT_VERSION`) matches the intended release
- [ ] No `todo!()`, `unimplemented!()`, or `#[allow(dead_code)]` items that affect production paths
- [ ] Contract reviewed for arithmetic overflow — all maths uses checked helpers (`checked_mul_div`, `checked_add`, `checked_sub`)
- [ ] Upgrade timelock constant (`UPGRADE_TIMELOCK_SECS = 86_400`) confirmed as intentional

### 1.2 Frontend

- [ ] `npm run typecheck` passes with zero errors: `cd frontend && npm run typecheck`
- [ ] `npm run lint` passes with zero errors: `cd frontend && npm run lint`
- [ ] `npm run build` succeeds locally with production environment values
- [ ] No hardcoded testnet contract IDs, addresses, or secrets in source code
- [ ] No `console.log` statements exposing sensitive data (wallet keys, contract details)
- [ ] All pages load without JavaScript errors in a production build (`npm run start`)
- [ ] Freighter wallet connection works on the production build
- [ ] All destructive actions (cancel job, approve work, raise dispute, withdraw fees) show confirmation dialogs

### 1.3 Dependencies

- [ ] `npm audit` in `frontend/` shows zero critical or high severity vulnerabilities
- [ ] `cargo audit` in `contracts/escrow/` shows no known vulnerabilities (install: `cargo install cargo-audit`)
- [ ] All dependencies are pinned to specific versions (no open `*` or `^latest` ranges for security-critical packages)
- [ ] `@stellar/freighter-api` is on a stable, non-pre-release version
- [ ] `@stellar/stellar-sdk` is on a stable, non-pre-release version

---

## Section 2 — Infrastructure & Secrets

**Owner:** ____________  **Completed:** ____________

### 2.1 Admin Key

- [ ] Admin Stellar keypair generated on a secure machine (offline or air-gapped preferred)
- [ ] Admin secret key stored in a hardware wallet or secrets manager (not in plain text files)
- [ ] Admin secret key backed up in at least **two** physically separate locations
- [ ] Backup verified: import from backup, confirm public key matches admin address
- [ ] Admin public key recorded in deployment log
- [ ] No team member has admin secret key stored in a personal password manager without HSM/2FA protection
- [ ] Admin address funded with at least 10 XLM on mainnet

### 2.2 Vercel Project

- [ ] Vercel project created and linked to the GitHub repository
- [ ] Root directory set to `frontend/` in Vercel project settings
- [ ] GitHub Actions secrets added: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- [ ] GitHub Actions workflows (`deploy-production.yml`, `deploy-preview.yml`) enabled
- [ ] Vercel production environment variables set (see [DEPLOYMENT.md §3.1](./DEPLOYMENT.md#31-environment-variables)):
  - [ ] `NEXT_PUBLIC_CONTRACT_ID`
  - [ ] `NEXT_PUBLIC_NETWORK` = `mainnet`
  - [ ] `NEXT_PUBLIC_SOROBAN_RPC`
  - [ ] `NEXT_PUBLIC_ADMIN_ADDRESS`
  - [ ] `NEXT_PUBLIC_NATIVE_TOKEN`
- [ ] Preview environment variables point to **testnet** contract (not production)

### 2.3 Domain & DNS

- [ ] Domain registered and DNS provider configured
- [ ] A record (or CNAME) pointing to Vercel confirmed propagated: `dig stellarwork.app` or `nslookup stellarwork.app`
- [ ] HTTPS certificate issued and valid: `curl -sv https://stellarwork.app 2>&1 | grep "SSL certificate verify ok"`
- [ ] `www` subdomain configured and redirects to apex (or vice versa) — no broken redirect loops
- [ ] HSTS header is present in production responses

### 2.4 Repository & CI

- [ ] `main` branch is protected: direct pushes blocked, PR reviews required
- [ ] CI workflow (`frontend.yml`) runs on every PR and must pass before merge
- [ ] Contract CI workflow (`contract.yml`) runs on every PR and must pass before merge
- [ ] No secrets are stored in repository files (`.env`, `*.pem`, `secrets.json`, etc.)
- [ ] `.gitignore` covers `.env.local`, `.vercel/`, and any secrets files

---

## Section 3 — Contract Deployment

**Owner:** ____________  **Completed:** ____________

Follow [DEPLOYMENT.md §2](./DEPLOYMENT.md#2-contract-deployment) for full step-by-step instructions.

- [ ] Soroban CLI configured with mainnet network profile
- [ ] Admin identity added to Soroban CLI
- [ ] Contract deployed — contract ID recorded: `_______________________________`
- [ ] `initialize` called with correct admin address and native token
- [ ] `get_admin` returns expected admin address ✓
- [ ] `get_fee_bps` returns 250 (2.5%) ✓
- [ ] `get_job_count` returns 0 ✓
- [ ] `get_contract_version` returns 1 ✓
- [ ] `get_native_token` returns expected native token address ✓
- [ ] Any additional allowed tokens added via `add_allowed_token`
- [ ] Contract ID stored in: secrets manager ☐, Vercel env vars ☐, deployment log ☐
- [ ] Deployment transaction hash recorded: `_______________________________`
- [ ] Deployment timestamp recorded: `_______________________________`

---

## Section 4 — Frontend Deployment

**Owner:** ____________  **Completed:** ____________

- [ ] Production environment variables confirmed in Vercel before first deploy
- [ ] Triggered production deployment (push to `main` or manual redeploy)
- [ ] Vercel deployment status shows **Ready**
- [ ] No errors in Vercel build log
- [ ] Production URL resolves: `curl -s -o /dev/null -w "%{http_code}\n" https://stellarwork.app` → 200
- [ ] Custom domain active (not the `.vercel.app` default URL)
- [ ] HTTPS is the default — HTTP redirects to HTTPS automatically
- [ ] Network badge in nav displays "Mainnet"

---

## Section 5 — End-to-End Verification

**Owner:** ____________  **Completed:** ____________

Use two wallets: one for the client role, one for the freelancer.

Complete the [pre-release messaging and meetings QA checklist](./messaging-meetings-qa-checklist.md) against the release candidate and record its result before release sign-off.

### 5.1 Wallet Connection

- [ ] "Connect Wallet" button opens Freighter popup
- [ ] Approving connection shows short wallet address in nav header
- [ ] WalletMenu dropdown shows full address, "Switch Account", and "Disconnect"
- [ ] Disconnecting clears wallet state and nav returns to "Connect Wallet"

### 5.2 Job Lifecycle (Full Cycle Test)

- [ ] **Post Job** — client posts a job for 10 XLM; confirmation dialog shown; Freighter prompted; job appears in job list with "Open" status
- [ ] **Accept Job** — freelancer accepts the job; Freighter prompted; status changes to "In Progress"
- [ ] **Submit Work** — freelancer submits work; confirmation dialog shown; status changes to "Submitted for Review"
- [ ] **Approve Work** — client approves work; confirmation dialog shown; status changes to "Completed"
- [ ] **Payment verified** — freelancer wallet received ~9.75 XLM (10 XLM minus 2.5% fee)
- [ ] **Fee verified** — Admin panel shows ~0.25 XLM in accrued fees

### 5.3 Admin Functions

- [ ] Admin panel accessible to admin wallet; "Unauthorized" shown for other wallets
- [ ] Accrued fees visible in Admin panel
- [ ] "Withdraw Fees" shows confirmation dialog; Freighter prompted; admin wallet balance increases
- [ ] Fee balance resets to 0 after withdrawal

### 5.4 Dispute Flow

- [ ] Raising a dispute shows confirmation dialog
- [ ] Job status changes to "Disputed" after dispute is raised
- [ ] Dispute visible in the Disputes page
- [ ] Admin can resolve the dispute with a custom split
- [ ] Funds distributed according to split after resolution

### 5.5 Error Handling

- [ ] Attempting a contract action without wallet shows "Connect your wallet" message
- [ ] Attempting an action on a job in wrong status shows a clear error message
- [ ] RPC timeout shows user-friendly error (not a raw stack trace)

---

## Section 6 — Security Review

**Owner:** ____________  **Completed:** ____________

- [ ] No private keys or secrets visible in browser DevTools → Network tab during any operation
- [ ] No internal wallet addresses or secrets visible in page source
- [ ] `X-Frame-Options: SAMEORIGIN` header present (prevents clickjacking)
- [ ] `X-Content-Type-Options: nosniff` header present
- [ ] No mixed content warnings (all resources loaded over HTTPS)
- [ ] Contract admin address is not the same as any user-facing freelancer or client wallet
- [ ] Freighter is the only wallet extension with access — no other extensions have been granted permission during testing
- [ ] Reviewed contract for reentrancy: all state mutations happen before token transfers ✓ (verified in contract source)
- [ ] Confirmed `initialize` can only be called once (panics with `AlreadyInitialized` on repeat calls) ✓

---

## Section 7 — Observability & Runbook Readiness

**Owner:** ____________  **Completed:** ____________

- [ ] Uptime monitoring configured for `https://stellarwork.app` (alert on non-200 for 2+ min)
- [ ] Vercel email notifications enabled for deployment failures
- [ ] Stellar network status page subscribed ([https://status.stellar.org](https://status.stellar.org))
- [ ] Sentry (or equivalent) error tracking configured in frontend
- [ ] Ops team has access to Vercel dashboard
- [ ] Ops team has access to admin keypair (or secure handoff procedure documented)
- [ ] [OPS_RUNBOOK.md](./OPS_RUNBOOK.md) reviewed by at least one ops team member
- [ ] Incident escalation path confirmed: who to contact for SEV-1 and SEV-2 ([production-escalation.md](./production-escalation.md))
- [ ] First fee withdrawal scheduled (monthly cadence recommended)

---

## Section 8 — Communications

**Owner:** ____________  **Completed:** ____________

- [ ] Release notes written and reviewed ([release-notes-guide.md](./release-notes-guide.md))
- [ ] Changelog / GitHub Release created and tagged (e.g. `v1.0.0`)
- [ ] Public announcement drafted (blog post, Discord, social)
- [ ] `README.md` updated with live production URL
- [ ] Documentation links (DEPLOY.md, CONTRACT.md, INTEGRATION.md) verified to be accurate for the released version
- [ ] [docs/README.md](./README.md) index verified — all linked docs exist and are current

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Contract lead | | | |
| Frontend lead | | | |
| Ops / security | | | |
| Project maintainer | | | |

**Final go / no-go decision:** ☐ GO — all items complete &nbsp;&nbsp; ☐ NO-GO — blocker(s) outstanding

Blockers (if no-go):
```
1.
2.
3.
```

---

*Related: [DEPLOYMENT.md](./DEPLOYMENT.md) · [OPS_RUNBOOK.md](./OPS_RUNBOOK.md) · [release-checklist.md](./release-checklist.md) · [messaging-meetings-qa-checklist.md](./messaging-meetings-qa-checklist.md) · [production-escalation.md](./production-escalation.md)*
