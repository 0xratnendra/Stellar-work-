import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.1.0",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_COMMIT_SHA:
      process.env.COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_DEPLOY_ENV:
      process.env.DEPLOY_ENV ?? process.env.VERCEL_ENV ?? "development",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    dangerouslyAllowSVG: true,
  },
  headers: async () => {
    const isReportOnly = process.env.CSP_REPORT_ONLY === "true";
    const cspHeaderKey = isReportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // *.sentry.io is added so the Sentry SDK can send events when the
      // sentry-tunnel proxy is not available (e.g. during local development).
      // In production the tunnel route (/sentry-tunnel) handles all Sentry
      // traffic so these origins are only a fallback.
      "connect-src 'self' https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://horizon.stellar.org https://rpc-futurenet.stellar.org https://ipfs.io https://*.pinata.cloud https://*.nftstorage.link wss: https: https://*.sentry.io https://o*.ingest.sentry.io",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: cspHeaderKey, value: cspDirectives },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

// ── Sentry build-time configuration ──────────────────────────────────────────
//
// `withSentryConfig` does two things at build time:
//   1. Injects the Sentry webpack plugin that uploads source maps to Sentry
//      after each production build so stack traces in the Sentry UI show
//      original TypeScript source lines instead of minified bundles.
//   2. Auto-instruments Server Components and Route Handlers with OpenTelemetry
//      spans so RPC call timings appear in Sentry's Performance view without
//      any manual instrumentation in application code.
//
// Source map uploads only happen when SENTRY_AUTH_TOKEN is present (CI/CD).
// In local development the plugin is silent and uploads are skipped.

const sentryWebpackOptions = {
  org: process.env.SENTRY_ORG ?? "stellarwork",
  project: process.env.SENTRY_PROJECT ?? "stellarwork-frontend",

  // Upload a wider set of source maps for more precise stack frames in the
  // Sentry UI (includes lazy-loaded chunks, not just the main bundle).
  widenClientFileUpload: true,

  // Auth token for source map uploads. Set SENTRY_AUTH_TOKEN in CI.
  // When absent (local dev), the plugin runs in dry-run mode — no uploads,
  // no errors, build succeeds normally.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Route all Sentry event traffic through our own Next.js server to bypass
  // ad-blockers and privacy extensions. The tunnel route is excluded from the
  // next-intl middleware matcher in middleware.ts.
  tunnelRoute: "/sentry-tunnel",

  // Only print plugin logs in CI to avoid cluttering local dev output.
  silent: !process.env.CI,

  // Automatically tree-shake Sentry debug code in production builds.
  disableLogger: true,

  // Automatically wrap Route Handlers to capture exceptions.
  autoInstrumentServerFunctions: true,

  // Automatically wrap middleware to capture edge runtime exceptions.
  autoInstrumentMiddleware: true,

  // Tag each release with the commit SHA so Sentry can associate errors with
  // the exact code version that produced them.
  release: {
    name:
      process.env.SENTRY_RELEASE ??
      process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
      process.env.COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      undefined,
    // Tell the plugin which files to include in the release artifact.
    // setCommits wires up the GitHub integration so Sentry can show which
    // commit introduced a regression.
    setCommits: {
      auto: true,
    },
  },
};

export default withSentryConfig(
  withBundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
  })(withNextIntl(nextConfig)),
  sentryWebpackOptions,
);
