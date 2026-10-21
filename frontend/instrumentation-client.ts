// Next.js 16 App Router — client-side instrumentation entry point.
//
// Next.js automatically picks up this file and runs it in the browser before
// any app code. It must:
//   1. Call Sentry.init() (delegated to sentry.client.config.ts so the config
//      stays co-located with the server/edge configs).
//   2. Re-export `onRouterTransitionStart` so Next.js can hook into App Router
//      soft-navigations and create Sentry spans for page transitions.
//
// Do not import server-only modules here — this file runs in the browser.

import "./sentry.client.config";
import * as Sentry from "@sentry/nextjs";

// Required export for Next.js 16 App Router performance tracing.
// This wires Sentry into the router's transition lifecycle so page-load spans
// appear in Sentry's Traces view alongside contract RPC spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
