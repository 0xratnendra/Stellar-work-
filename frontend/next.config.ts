import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// ── Documented external host allowlists ─────────────────────────────────────
// Add any new legitimate external RPC, storage, or image endpoints here.
export const ALLOWED_IMAGE_HOSTS = [
  "ipfs.io",
  "*.ipfs.io",
  "dweb.link",
  "*.dweb.link",
  "*.pinata.cloud",
  "*.nftstorage.link",
  "avatars.githubusercontent.com",
  "raw.githubusercontent.com",
] as const;

export const ALLOWED_CONNECT_HOSTS = [
  "'self'",
  "https://horizon-testnet.stellar.org",
  "https://soroban-testnet.stellar.org",
  "https://horizon.stellar.org",
  "https://horizon-futurenet.stellar.org",
  "https://rpc-futurenet.stellar.org",
  "https://mainnet.sorobanrpc.com",
  "https://soroban-rpc.mainnet.stellar.org",
  "https://ipfs.io",
  "https://*.ipfs.io",
  "https://dweb.link",
  "https://*.dweb.link",
  "https://*.pinata.cloud",
  "https://*.nftstorage.link",
  "https://*.web3.storage",
  "https://api.web3.storage",
  "https://*.sentry.io",
  "https://o*.ingest.sentry.io",
] as const;

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
    remotePatterns: ALLOWED_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    })),
    dangerouslyAllowSVG: true,
  },
  headers: async () => {
    const isReportOnly = process.env.CSP_REPORT_ONLY === "true";
    const cspHeaderKey = isReportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";

    const imgSrcDirectives = [
      "'self'",
      "data:",
      "blob:",
      ...ALLOWED_IMAGE_HOSTS.map((h) => `https://${h}`),
    ].join(" ");

    const connectSrcDirectives = ALLOWED_CONNECT_HOSTS.join(" ");

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imgSrcDirectives}`,
      "font-src 'self' data:",
      // *.sentry.io is added so the Sentry SDK can send events when the
      // sentry-tunnel proxy is not available (e.g. during local development).
      // In production the tunnel route (/sentry-tunnel) handles all Sentry
      // traffic so these origins are only a fallback.
      `connect-src ${connectSrcDirectives}`,
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ].join("; ");

    const reportToHeaderValue = JSON.stringify({
      group: "csp-endpoint",
      max_age: 10886400,
      endpoints: [{ url: "/api/csp-report" }],
    });

    return [
      {
        source: "/:path*",
        headers: [
          { key: cspHeaderKey, value: cspDirectives },
          { key: "Report-To", value: reportToHeaderValue },
          {
            key: "Reporting-Endpoints",
            value: 'csp-endpoint="/api/csp-report"',
          },
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
const sentryWebpackOptions = {
  org: process.env.SENTRY_ORG ?? "stellarwork",
  project: process.env.SENTRY_PROJECT ?? "stellarwork-frontend",
  widenClientFileUpload: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: "/sentry-tunnel",
  silent: !process.env.CI,
  disableLogger: true,
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  release: {
    name:
      process.env.SENTRY_RELEASE ??
      process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
      process.env.COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      undefined,
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
