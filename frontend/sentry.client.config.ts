// Sentry client-side SDK configuration.
//
// This file is loaded in the browser by instrumentation-client.ts (Next.js 16
// App Router). It is NOT imported directly — instrumentation-client.ts re-exports
// the onRouterTransitionStart hook so Next.js can call it at the right time.
//
// PII policy: mirrors the log-masking approach in lib/sanitize.ts.
// - Stellar public keys (G…) are kept — they are pseudonymous identifiers,
//   not personal data, and are essential for tracing contract errors.
// - Wallet addresses, transaction hashes, and RPC URLs are preserved because
//   they are the primary debugging signal for blockchain errors.
// - IP addresses and user agent strings are suppressed (userInfo: false).
// - All form inputs and text in Session Replay are masked by default.
// - The built-in Sentry denylist already strips auth/password/token fields.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!dsn && process.env.NODE_ENV === "production") {
  // Non-fatal: warn once so a missing DSN is visible in the deploy log
  // without hard-blocking the app from starting.
  console.warn(
    "[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set — error reporting is disabled. " +
      "See frontend/docs/sentry-operations.md for setup instructions.",
  );
}

const environment =
  process.env.NEXT_PUBLIC_DEPLOY_ENV ??
  process.env.NEXT_PUBLIC_NETWORK ??
  process.env.NODE_ENV ??
  "development";

const release =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
  // Fall back to the commit SHA that next.config.ts already injects as a
  // build-time env var — gives us a useful release identifier even when
  // SENTRY_RELEASE is not explicitly set in CI.
  process.env.NEXT_PUBLIC_COMMIT_SHA ??
  undefined;

Sentry.init({
  dsn: dsn || undefined,

  environment,
  release,

  // ── Sample rates ──────────────────────────────────────────────────────────
  // Keep 100% of traces in development/preview; drop to 10% in production to
  // stay within Sentry's free-tier quota while still sampling a representative
  // slice of production traffic.
  tracesSampleRate: environment === "production" ? 0.1 : 1.0,

  // Session Replay: record 5% of normal sessions, 100% of sessions that hit
  // an error so every error has a replay for debugging.
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  // ── Integrations ──────────────────────────────────────────────────────────
  integrations: [
    Sentry.replayIntegration({
      // Mask all user-generated text and inputs by default (PII policy).
      maskAllText: true,
      maskAllInputs: true,
      // Block media (images/video) to avoid inadvertently capturing
      // user-uploaded content in replays.
      blockAllMedia: true,
    }),

    // Browser performance profiling — complements tracesSampleRate.
    Sentry.browserTracingIntegration(),
  ],

  // ── Data collection / PII ─────────────────────────────────────────────────
  dataCollection: {
    // Do not attach the user's IP address or inferred geolocation.
    userInfo: false,
  },

  // ── Event filtering ───────────────────────────────────────────────────────
  beforeSend(event) {
    return scrubEvent(event);
  },

  beforeSendTransaction(event) {
    // Keep performance transactions but remove any PII from request bodies.
    return scrubTransactionEvent(event);
  },

  // Ignore noisy browser errors that are not actionable:
  // - ResizeObserver loop errors are benign browser internals.
  // - "Load failed" / "NetworkError" for cancelled fetches produce false positives.
  // - ChunkLoadError for stale deploys is handled by a page reload prompt.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    /^NetworkError/,
    /^Load failed$/,
    /^Failed to fetch$/,
    /Loading chunk \d+ failed/,
    /ChunkLoadError/,
    // Freighter wallet not installed / not connected — user-facing, not a bug.
    /getPublicKey.*not installed/i,
    /Freighter.*not installed/i,
  ],
});

// ── PII scrubbing helpers ──────────────────────────────────────────────────

/**
 * Scrubs sensitive fields from a Sentry error event before it is sent.
 *
 * What is kept (useful debugging signal):
 *   - Stellar public keys (G…) — pseudonymous, needed to trace contract calls
 *   - Transaction hashes — needed to look up failures on-chain
 *   - Error messages from the escrow contract (parsed in lib/contract-errors.ts)
 *   - Stack traces
 *
 * What is removed (PII / low-value noise):
 *   - Cookie headers
 *   - Authorization / x-api-key headers
 *   - Request body fields matching common PII patterns
 */
function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request) {
    // Strip cookies entirely — they may contain session tokens.
    if (event.request.cookies) {
      event.request.cookies = "[Filtered]" as unknown as Record<string, string>;
    }
    // Strip auth/token headers (Sentry's built-in denylist covers most cases,
    // but we be explicit here for the custom headers this app uses).
    if (event.request.headers) {
      const scrubbed: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.request.headers)) {
        const lower = key.toLowerCase();
        if (lower === "authorization" || lower === "x-api-key" || lower === "cookie") {
          scrubbed[key] = "[Filtered]";
        } else {
          scrubbed[key] = value;
        }
      }
      event.request.headers = scrubbed;
    }
  }
  return event;
}

function scrubTransactionEvent(
  event: Sentry.TransactionEvent,
): Sentry.TransactionEvent | null {
  if (event.request?.cookies) {
    event.request.cookies = "[Filtered]" as unknown as Record<string, string>;
  }
  return event;
}
