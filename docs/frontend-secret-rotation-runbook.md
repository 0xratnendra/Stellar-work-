# Runbook: Rotating Exposed Frontend Configuration and Secrets

## Overview
This runbook defines the emergency protocol and step-by-step procedures for rotating exposed or compromised frontend credentials, configuration values, and API keys.

---

## 1. Inventory of Frontend Secrets & Configuration Values

| Secret / Configuration Name | Purpose | Owner / Provider | Impact of Exposure |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SOROBAN_RPC` | Soroban RPC endpoint URL | DevOps / Infrastructure | RPC traffic manipulation, rate limiting |
| `NEXT_PUBLIC_HORIZON_URL` | Stellar Horizon API URL | DevOps / Infrastructure | Horizon rate limit exhaustion |
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed Contract Address | Core Protocol Engineering | Misdirection to rogue contract |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend Error Tracking DSN | QA / Security Team | Telemetry spamming / telemetry injection |
| `NEXT_PUBLIC_ANALYTICS_KEY` | User telemetry & event key | Marketing / Product Analytics | Metric distortion |
| `IPFS_GATEWAY_API_TOKEN` | Pinning service credential | Storage / Platform Team | Unauthorized pinning quota consumption |

---

## 2. Emergency Rotation Order & Procedure

When a leak is detected, credentials MUST be rotated in the following strict order to minimize exposure windows:

### Step 2.1: Revoke Compromised Provider Credential
1. Log into the issuing provider console (e.g., Infura/QuickNode, Sentry, IPFS Pinning Provider).
2. Generate a new API key / token immediately.
3. Keep the old token active with restricted permissions or mark it for 1-hour delayed revocation if zero-downtime is required, or immediately revoke if actively abused.

### Step 2.2: Update Infrastructure Secrets & CI/CD Pipeline
1. Update secret variables in GitHub Repository Settings (`Settings > Secrets and variables > Actions`).
2. Update local `.env.production` and staging secrets stored in HashiCorp Vault / AWS Secrets Manager.

### Step 2.3: Rebuild and Redeploy Frontend
1. Trigger a fresh production deployment pipeline (`.github/workflows/deploy-production.yml`).
2. Verify build logs confirm integration of new environment variables.
3. Invalidate CDN cache (Cloudflare / Vercel Edge Cache) to flush stale static asset bundles containing old secrets.

---

## 3. History Purging & Artifact Clean-Up

1. **Build Logs**: Retain incident logs for audit, then delete compromised GitHub Actions run logs.
2. **Git Commit History**: If a secret was committed to the repository:
   - Use `git-filter-repo` or BFG Repo-Cleaner to purge the string across git history.
   - Force-push updated branches: `git push origin --force --all`.
3. **Artifact Caches**: Invalidate GitHub Actions cache storage (`gh extension exec actions-cache delete`).

---

## 4. Verification & Rollback Plan

### Post-Rotation Checklist
- [ ] Production frontend bundle loads cleanly with HTTP 200.
- [ ] Network tab confirms requests use the newly rotated RPC endpoint / API key.
- [ ] Error tracking telemetry (Sentry) receives test telemetry event with new DSN.
- [ ] No CORS or HTTP 401/403 authorization failures occur during wallet connect or contract interaction.

### Rollback Criteria
If the new credential fails due to provider misconfiguration:
- Temporarily fallback to secondary backup RPC URL / credential.
- Notify Security Lead and Incident Commander immediately.

---

## 5. Disclosure Timeline & Notification Protocol

- **T+0 mins**: Secret leak identified & logged in Incident Channel (`#incident-response`).
- **T+15 mins**: Provider credential revoked & new key provisioned.
- **T+30 mins**: CDN invalidated and new frontend bundle deployed.
- **T+60 mins**: Incident report published to security team & advisory posted if user data or wallet security was implicated.
