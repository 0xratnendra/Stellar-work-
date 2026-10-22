# Content Security Policy (CSP) Rollback & Incident Runbook

## Overview
StellarWork enforces a strict, nonce-based Content Security Policy that eliminates `'unsafe-inline'` and `'unsafe-eval'` directives from `script-src` and `style-src`.

## Policy Directives
- `default-src 'self'`
- `script-src 'self' 'nonce-{NONCE}' 'strict-dynamic'`
- `style-src 'self'`
- `img-src 'self' data: blob: https:`
- `font-src 'self' data:`
- `connect-src 'self' https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://horizon.stellar.org https://rpc-futurenet.stellar.org https://ipfs.io https://*.pinata.cloud https://*.nftstorage.link wss: https: https://*.sentry.io https://o*.ingest.sentry.io`
- `frame-ancestors 'none'`
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`

## Rollback Procedures

### Step 1: Switch to Report-Only Mode (Immediate Mitigation)
If a critical UI malfunction or broken script execution is detected in production without an identified origin:
1. In the Vercel / Kubernetes deployment environment, set the environment variable:
   ```env
   CSP_REPORT_ONLY=true
   ```
2. Trigger an immediate redeployment or rolling restart.
3. In `CSP_REPORT_ONLY=true` mode, browser violations will be logged to Sentry / browser console without blocking script execution or resource loading.

### Step 2: Emergency Hotfix (Directive Relaxation)
If an external dependency requires inline execution or an unhashed stylesheet before code remediation:
1. In `frontend/next.config.ts` and `frontend/middleware.ts`, temporarily add `'unsafe-inline'` or the specific sha256 hash reported in the violation logs.
2. Commit and deploy with emergency tag:
   ```bash
   git commit -m "fix(security): emergency relaxation of CSP directives for [incident-id]"
   ```

### Step 3: Verifying Resolution & Restoring Strict Mode
1. Monitor violation logs in Sentry under `csp-reports` tag.
2. Ensure no valid application script or resource is triggering violations.
3. Unset `CSP_REPORT_ONLY` (or set `CSP_REPORT_ONLY=false`) and redeploy to restore enforcement.
