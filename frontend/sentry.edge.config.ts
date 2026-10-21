// Sentry edge runtime SDK configuration.
//
// Loaded via instrumentation.ts when NEXT_RUNTIME === "edge".
// Runs in Vercel's edge runtime (V8 isolates) for the Next.js middleware
// and any Route Handlers explicitly marked with `export const runtime = "edge"`.
//
// The edge runtime is a restricted environment: no Node.js APIs, no filesystem
// access, and limited memory. Keep this config minimal — no heavy integrations.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

const environment =
  process.env.NEXT_PUBLIC_DEPLOY_ENV ??
  process.env.NEXT_PUBLIC_NETWORK ??
  process.env.NODE_ENV ??
  "development";

const release =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
  process.env.SENTRY_RELEASE ??
  process.env.NEXT_PUBLIC_COMMIT_SHA ??
  undefined;

Sentry.init({
  dsn: dsn || undefined,

  environment,
  release,

  // Low sample rate for edge traces — middleware runs on every request so
  // 100% tracing at edge would blow through quota quickly.
  tracesSampleRate: environment === "production" ? 0.05 : 1.0,

  dataCollection: {
    userInfo: false,
  },
});
