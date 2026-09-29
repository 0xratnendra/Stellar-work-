# Deployment Guide

This document explains how to deploy the StellarWork frontend to Vercel for both production and preview environments.

## Overview

| Environment | Trigger | Branch | URL |
|---|---|---|---|
| Production | Push to `main` | `main` | Your configured production domain |
| Preview | Open / update a pull request | Any branch | Unique auto-generated URL per PR |

Deployments are handled by two GitHub Actions workflows:
- `.github/workflows/deploy-production.yml` — production
- `.github/workflows/deploy-preview.yml` — PR previews

The workflows run lint, type-check, and build before deploying, so a broken build is never published.

---

## Prerequisites

- A [Vercel](https://vercel.com) account (free tier is enough for preview deployments)
- The repository connected to your Vercel team/org
- Three GitHub Actions secrets configured (see below)

---

## Initial Vercel Project Setup

### 1. Import the repository

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the `Stellar-work-` repository.
3. Set **Root Directory** to `frontend`.
4. Vercel will detect Next.js automatically. Leave the framework preset as **Next.js**.
5. Click **Deploy** once to create the project — you can cancel it mid-way, the GitHub integration will take over.

### 2. Collect project credentials

You need three values from Vercel:

| Value | Where to find it |
|---|---|
| `VERCEL_TOKEN` | Vercel Dashboard → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Vercel Dashboard → Settings → General → Team ID (or your personal account ID) |
| `VERCEL_PROJECT_ID` | Vercel Dashboard → Your Project → Settings → General → Project ID |

The `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` values are also written to `frontend/.vercel/project.json` after running `vercel link` locally:

```bash
cd frontend
npx vercel link
cat .vercel/project.json
```

### 3. Add GitHub Actions secrets

In the GitHub repository go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | Token from step 2 |
| `VERCEL_ORG_ID` | Org/team ID from step 2 |
| `VERCEL_PROJECT_ID` | Project ID from step 2 |

### 4. Configure environment variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** and add the following.

#### All environments (production + preview + development)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_IPFS_GATEWAY_URL` | `https://dweb.link/ipfs/` | Public IPFS gateway |
| `NEXT_PUBLIC_WEB3_STORAGE_TOKEN` | `<your token>` | Optional; enables IPFS uploads |

#### Production only

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_NETWORK` | `mainnet` | Set to `testnet` for testnet production |
| `NEXT_PUBLIC_CONTRACT_ID` | `C...` | Mainnet contract ID |
| `NEXT_PUBLIC_SOROBAN_RPC` | `https://...` | Mainnet Soroban RPC endpoint |
| `NEXT_PUBLIC_NATIVE_TOKEN` | `C...` | Mainnet native XLM token contract |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | `G...` | Admin wallet address |

#### Preview only

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_NETWORK` | `testnet` | Always testnet for previews |
| `NEXT_PUBLIC_CONTRACT_ID` | `C...` | Testnet contract ID |
| `NEXT_PUBLIC_SOROBAN_RPC` | `https://soroban-testnet.stellar.org` | Public testnet RPC |
| `NEXT_PUBLIC_NATIVE_TOKEN` | `C...` | Testnet native token contract |

> **Tip:** Vercel lets you scope variables per environment (Production / Preview / Development). Setting different contract IDs per environment ensures preview deployments always hit testnet and can never affect production funds.

---

## Production Domain

To add a custom domain:

1. Vercel Dashboard → Your Project → **Settings → Domains**.
2. Add your domain and follow the DNS instructions.
3. Vercel automatically provisions an HTTPS certificate via Let's Encrypt.

---

## Preview Deployments

Every pull request against `main` that touches `frontend/**` automatically gets a preview deployment:

1. The `deploy-preview.yml` workflow runs lint, typecheck, and build.
2. Vercel creates a unique URL like `stellarwork-pr-42-<hash>.vercel.app`.
3. A bot comment on the PR shows the preview URL, branch, and commit SHA.
4. The comment is updated (not duplicated) each time new commits are pushed to the PR.

Preview deployments use the **Preview** environment variables configured in Vercel, so they always connect to testnet.

---

## Deployment-Aware Behaviour

The frontend exposes deployment utilities in `lib/deployment.ts`:

```typescript
import {
  getDeploymentEnvironment,
  isVercel,
  isProduction,
  isPreview,
  getDeploymentUrl,
  getCommitSha,
  getCommitRef,
} from "@/lib/deployment";

// "production" | "preview" | "development" | "local"
const env = getDeploymentEnvironment();

// true on any Vercel deployment
if (isVercel()) { ... }

// true only on Vercel production
if (isProduction()) { ... }

// true on PR preview deployments
if (isPreview()) { ... }

// e.g. "https://stellarwork.vercel.app"
const url = getDeploymentUrl();

// short SHA, e.g. "a1b2c3d"
const sha = getCommitSha();
```

These functions read both the server-side `VERCEL_*` variables and the browser-accessible `NEXT_PUBLIC_VERCEL_*` mirrors. Mirror the variables you need in the browser by adding them to Vercel's environment variable settings with the `NEXT_PUBLIC_` prefix.

---

## Vercel Configuration (`vercel.json`)

`frontend/vercel.json` configures:

- **Framework**: Next.js
- **Region**: `iad1` (US East, closest to Stellar's primary infrastructure)
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- **Cache headers**: Immutable cache for static assets (JS, CSS, fonts, images)
- **Redirect**: `/home` → `/`
- **Default env vars**: Non-secret defaults baked in (can be overridden in the dashboard)

---

## Local Vercel Development

To replicate the Vercel environment locally:

```bash
# Install Vercel CLI (once)
npm install -g vercel

# Link to your Vercel project (once, from frontend/)
cd frontend
vercel link

# Pull environment variables from Vercel
vercel env pull .env.local

# Run the dev server (identical to vercel dev)
vercel dev
```

This pulls the exact environment variables from Vercel's Preview environment into `.env.local`, so your local dev matches a preview deployment.

---

