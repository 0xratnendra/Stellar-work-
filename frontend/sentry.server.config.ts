// Sentry server-side SDK configuration (Node.js runtime).
//
// Loaded via instrumentation.ts when NEXT_RUNTIME === "nodejs".
// Runs in the Next.js server process — Server Components, Route Handlers,
// Server Actions, and API routes all share this init.
//
// Keep this file free of browser globals (window, document, navigator).

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (!dsn && process.env.NODE_ENV === "production") {
  console.warn(
    "[Sentry] Neither NEXT_PUBLIC_SENTRY_DSN nor SENTRY_DSN is set — " +
      "server-side error reporting is disabled. " +
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
  process.env.SENTRY_RELEASE ??
  process.env.NEXT_PUBLIC_COMMIT_SHA ??
  undefined;

Sentry.init({
  dsn: dsn || undefined,

  environment,
  release,

  // Server traces: keep 100% in non-production, 10% in production.
  // Contract RPC Route Handlers (e.g. /api/metrics) are automatically
  // instrumented — traces show the full server-side request lifecycle.
  tracesSampleRate: environment === "production" ? 0.1 : 1.0,

  // ── Data collection / PII ─────────────────────────────────────────────────
  dataCollection: {
    // Never attach the requester's IP address on the server side.
    userInfo: false,
  },

  // ── Event filtering ───────────────────────────────────────────────────────
  beforeSend(event) {
    return scrubServerEvent(event);
  },
});

// ── PII scrubbing ──────────────────────────────────────────────────────────

function scrubServerEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request) {
    // Remove cookies — may contain session tokens or NextAuth JWTs.
    if (event.request.cookies) {
      event.request.cookies = "[Filtered]" as unknown as Record<string, string>;
    }

    // Scrub sensitive headers.
    if (event.request.headers) {
      const scrubbed: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.request.headers)) {
        const lower = key.toLowerCase();
        if (
          lower === "authorization" ||
          lower === "x-api-key" ||
          lower === "cookie" ||
          lower === "set-cookie"
        ) {
          scrubbed[key] = "[Filtered]";
        } else {
          scrubbed[key] = value;
        }
      }
      event.request.headers = scrubbed;
    }

    // Remove the request body — POST bodies for /api/metrics contain metric
    // samples that are not useful for error debugging and may contain paths
    // (page URLs) that act as navigation fingerprints.
    if (event.request.data) {
      event.request.data = "[Filtered]";
    }
  }
  return event;
}
