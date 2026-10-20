// Next.js instrumentation hook — server & edge runtime entry point.
//
// Next.js 15+ picks this file up automatically (no experimental flag needed).
// It runs once per process start in the Node.js runtime and once per isolate
// in the edge runtime.
//
// `register()` conditionally imports the right Sentry config so that:
//   - Node.js server process gets the full sentry.server.config.ts
//   - Edge isolates get the lightweight sentry.edge.config.ts
//
// `onRequestError` is the Next.js 15+ hook that fires for every unhandled
// error in Server Components, Route Handlers, Server Actions, and middleware.
// Exporting it here gives Sentry complete server-side error coverage without
// any manual try/catch in application code.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures unhandled errors thrown inside Server Components, Route Handlers,
// Server Actions, and middleware. Next.js calls this before returning the
// 500/error response to the client.
export const onRequestError = Sentry.captureRequestError;
