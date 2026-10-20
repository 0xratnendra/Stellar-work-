# Sentry Operations Guide

This document covers how to configure, deploy, and operate the Sentry integration in StellarWork.

---

## Initial Setup

### 1. Create a Sentry project

1. Log in to [sentry.io](https://sentry.io) and navigate to **Settings → Projects → Create Project**.
2. Select **Next.js** as the platform.
3. Name it `stellarwork-frontend`.
4. Copy the **DSN** from **Settings → Projects → stellarwork-frontend → Client Keys (DSN)**.

### 2. Configure environment variables

Add the following to your `.env.local` (copy from `.env.example`):

```bash
# Public — safe to expose in browser bundles
NEXT_PUBLIC_SENTRY_DSN=https://your-key@oXXXXXX.ingest.sentry.io/YYYYYY

# Build-time only — keep secret, never prefix with NEXT_PUBLIC_
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=stellarwork-frontend
SENTRY_AUTH_TOKEN=sntrys_...
```

The DSN (`NEXT_PUBLIC_SENTRY_DSN`) is the only variable required for error capture at runtime. The auth token is only needed for source map uploads at build time.

### 3. Generate a Sentry auth token

1. Go to **Settings → Account → API → Auth Tokens → Create New Token**.
2. Required scopes: `project:releases`, `org:read`.
3. Add the token as `SENTRY_AUTH_TOKEN` in:
   - Your local `.env.local` (for manual source map uploads)
   - GitHub repo secrets: **Settings → Secrets and variables → Actions → New repository secret**

### 4. Add CI/CD secrets

In your GitHub repository, add these secrets and variables:

| Name | Type | Value |
|------|------|-------|
| `SENTRY_DSN` | Secret | Your project DSN |
| `SENTRY_AUTH_TOKEN` | Secret | The auth token from step 3 |
| `SENTRY_ORG` | Variable | Your Sentry org slug |
| `SENTRY_PROJECT` | Variable | `stellarwork-frontend` |

---

## How It Works

### Architecture

```
Browser                  Next.js Server              Sentry
  │                           │                         │
  │  Unhandled error          │                         │
  ├─ captureException ──────► │ /sentry-tunnel ────────►│
  │                           │   (proxy, bypasses      │
  │  Page transition          │    ad-blockers)         │
  ├─ captureRouterTransition  │                         │
  │                           │                         │
  │  callContract() span      │                         │
  ├─ startSpan(rpc.soroban) ──┤                         │
```

### Files changed

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Browser SDK init — sample rates, PII scrubbing, replay |
| `sentry.server.config.ts` | Node.js server SDK init — server components, route handlers |
| `sentry.edge.config.ts` | Edge runtime SDK init — middleware |
| `instrumentation-client.ts` | Next.js 16 client entry point, re-exports `onRouterTransitionStart` |
| `instrumentation.ts` | Next.js server/edge entry point, exports `onRequestError` |
| `next.config.ts` | Wraps config with `withSentryConfig` (source maps, tunnel, auto-instrumentation) |
| `middleware.ts` | Excludes `/sentry-tunnel` from next-intl matcher |
| `app/error.tsx` | Calls `Sentry.captureException` with `errorId` tag |
| `components/ErrorBoundary.tsx` | Calls `Sentry.captureException` with component stack |
| `lib/stellar.ts` | Wraps `callContract` with `Sentry.startSpan(rpc.soroban)` |

### Sample rates

| Runtime | Environment | Traces | Replays (session) | Replays (on error) |
|---------|-------------|--------|--------------------|--------------------|
| Client | production | 10% | 5% | 100% |
| Client | preview/dev | 100% | 5% | 100% |
| Server (Node) | production | 10% | — | — |
| Server (Node) | preview/dev | 100% | — | — |
| Edge | production | 5% | — | — |
| Edge | preview/dev | 100% | — | — |

Adjust `tracesSampleRate` in the relevant config file based on traffic volume and Sentry quota.

---

## Performance Tracing — Contract RPC Calls

Every `callContract()` call creates a Sentry span with these attributes:

| Attribute | Example value | Purpose |
|-----------|---------------|---------|
| `op` | `rpc.soroban` | Identifies span type in Performance view |
| `name` | `invoke accept_job` | Method and call type |
| `stellar.contract_id` | `CAAAAA12…` | First 8 chars of the contract ID |
| `stellar.method` | `accept_job` | Smart contract method name |
| `stellar.network` | `mainnet` | Active Stellar network |
| `stellar.call_type` | `write` | `read` (simulate) or `write` (submit) |
| `stellar.outcome` | `success` | `success` or `error` |
| `stellar.error_kind` | `timeout` | Bucketed error class (no PII) |
| `stellar.duration_ms` | `1240` | End-to-end duration including retries |

Use **Performance → Queries** in Sentry, filter by `op:rpc.soroban`, to see p50/p95 latency per contract method.

---

## PII Policy

This integration is aligned with the log-masking approach in `lib/sanitize.ts`:

**Kept** (useful debugging signal, not personal data):
- Stellar public keys (`G…55`) — pseudonymous blockchain addresses
- Transaction hashes — needed to look up failures on Horizon/Stellar Expert
- Contract error messages (from `lib/contract-errors.ts`)
- Stack traces and breadcrumbs
- Network name (`testnet` / `mainnet`)

**Removed** before sending to Sentry:
- IP addresses and user agent strings (`dataCollection.userInfo: false`)
- Cookie headers (may contain session tokens)
- `Authorization` / `x-api-key` headers
- Request bodies sent to `/api/metrics`
- All Session Replay text, inputs, and media are masked by default

The built-in Sentry denylist additionally redacts fields whose keys match `auth`, `password`, `secret`, `token`, `key`, and similar patterns.

---

## Verifying the Integration

### Trigger a test event (local)

Add this temporarily to any page component, click the button, then remove it:

```tsx
<button
  type="button"
  onClick={() => { throw new Error("Sentry integration test"); }}
>
  Test Sentry
</button>
```

Check **Issues** in your Sentry project — the event should appear within a few seconds.

### Verify source maps (CI)

After a build with `SENTRY_AUTH_TOKEN` set, go to **Settings → Projects → stellarwork-frontend → Source Maps**. You should see artifacts for the release tagged with the current commit SHA.

Stack frames in Sentry issues should resolve to original TypeScript lines rather than minified bundle code.

### Verify performance tracing

1. Open the app and perform a contract call (e.g. post a job on testnet).
2. In Sentry, go to **Performance → Traces**.
3. Filter by `op:rpc.soroban` — you should see a span for the call.

### Verify Session Replay

1. Navigate around the app and trigger an error.
2. In Sentry, open the issue and check the **Replay** tab.
3. The replay should show the user's session up to the point of the error, with all text masked.

---

## Alerts (Recommended)

Set up these alerts in **Alerts → Create Alert** after verifying the integration:

| Alert | Condition | Threshold |
|-------|-----------|-----------|
| High error rate | `count()` per minute | > 50 errors/min |
| Contract RPC errors | `op:rpc.soroban stellar.outcome:error` | > 10/min |
| p95 RPC latency | `p95(transaction.duration)` on `op:rpc.soroban` | > 10 000 ms |
| New issue | Any new issue created | Immediately |

---

## Troubleshooting

### Sentry events are not appearing

1. Check the browser console for the warning `[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set`.
2. Confirm `NEXT_PUBLIC_SENTRY_DSN` is set in your environment and starts with `https://`.
3. If an ad-blocker is active locally, events should still reach Sentry via the `/sentry-tunnel` proxy. Check the Network tab for requests to `/sentry-tunnel`.

### Source maps are not uploading

1. Confirm `SENTRY_AUTH_TOKEN` is set in CI secrets.
2. Check the build log for lines beginning with `[Sentry]` — the plugin prints upload progress when `CI=true`.
3. Confirm the token has `project:releases` and `org:read` scopes.

### Tunnel route returns 404

Ensure `sentry-tunnel` is excluded from the next-intl matcher in `middleware.ts`. The current pattern is:

```ts
matcher: ["/((?!sentry-tunnel|_next|api|favicon.ico|.*\\..*).*)"],
```

### Too many events / quota exceeded

Reduce `tracesSampleRate` in `sentry.client.config.ts` and `sentry.server.config.ts`. The recommended production values are already conservative (10% traces, 5% replays). For very high-traffic deployments, lower to 0.01 (1%).
