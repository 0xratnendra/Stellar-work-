import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import middleware from "../middleware";
import { NextRequest } from "next/server";

describe("Security Headers Configuration", () => {
  it("enforces strict Content-Security-Policy without unsafe-inline or unsafe-eval", async () => {
    expect(nextConfig.headers).toBeDefined();

    if (typeof nextConfig.headers === "function") {
      const headersConfig = await nextConfig.headers();
      const globalRouteHeaders = headersConfig.find(
        (item) => item.source === "/:path*",
      );

      expect(globalRouteHeaders).toBeDefined();
      const headersMap = new Map(
        globalRouteHeaders?.headers.map((h) => [h.key, h.value]),
      );

      // Verify CSP header presence
      const cspValue =
        headersMap.get("Content-Security-Policy") ||
        headersMap.get("Content-Security-Policy-Report-Only");
      expect(cspValue).toBeDefined();
      expect(cspValue).toContain("default-src 'self'");
      expect(cspValue).toContain("script-src 'self'");
      expect(cspValue).toContain("style-src 'self'");
      expect(cspValue).toContain("connect-src");
      expect(cspValue).toContain("frame-ancestors 'none'");
      expect(cspValue).toContain("report-uri /api/csp-report");
      expect(cspValue).toContain("report-to csp-endpoint");

      // Assert no unsafe keywords appear in the emitted policy
      expect(cspValue).not.toContain("'unsafe-inline'");
      expect(cspValue).not.toContain("'unsafe-eval'");

      // Verify standard security headers
      expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headersMap.get("X-Frame-Options")).toBe("DENY");
      expect(headersMap.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(headersMap.get("Strict-Transport-Security")).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );

      // Verify Reporting headers
      expect(headersMap.get("Report-To")).toBeDefined();
      expect(headersMap.get("Reporting-Endpoints")).toBe(
        'csp-endpoint="/api/csp-report"',
      );
    }
  });

  it("does not contain bare https: or wss: wildcards in connect-src or img-src", async () => {
    if (typeof nextConfig.headers === "function") {
      const headersConfig = await nextConfig.headers();
      const globalRouteHeaders = headersConfig.find(
        (item) => item.source === "/:path*",
      );
      const headersMap = new Map(
        globalRouteHeaders?.headers.map((h) => [h.key, h.value]),
      );
      const cspValue =
        headersMap.get("Content-Security-Policy") ||
        headersMap.get("Content-Security-Policy-Report-Only");

      expect(cspValue).toBeDefined();
      const directives = cspValue!.split(";").map((d) => d.trim());

      const connectSrc = directives.find((d) => d.startsWith("connect-src"));
      expect(connectSrc).toBeDefined();
      const connectTokens = connectSrc!.split(/\s+/);
      expect(connectTokens).not.toContain("https:");
      expect(connectTokens).not.toContain("wss:");

      const imgSrc = directives.find((d) => d.startsWith("img-src"));
      expect(imgSrc).toBeDefined();
      const imgTokens = imgSrc!.split(/\s+/);
      expect(imgTokens).not.toContain("https:");
      expect(imgTokens).not.toContain("wss:");
    }
  });

  it("restricts images remotePatterns to explicit allowlists", () => {
    expect(nextConfig.images).toBeDefined();
    const patterns = nextConfig.images?.remotePatterns;
    expect(patterns).toBeDefined();
    expect(patterns?.length).toBeGreaterThan(0);

    for (const pattern of patterns || []) {
      expect(pattern.hostname).not.toBe("**");
      expect(pattern.protocol).toBe("https");
    }
  });

  it("supports report-only mode via process.env.CSP_REPORT_ONLY", async () => {
    const originalEnv = process.env.CSP_REPORT_ONLY;
    try {
      process.env.CSP_REPORT_ONLY = "true";
      if (typeof nextConfig.headers === "function") {
        const headersConfig = await nextConfig.headers();
        const globalRouteHeaders = headersConfig.find(
          (item) => item.source === "/:path*",
        );
        const headersMap = new Map(
          globalRouteHeaders?.headers.map((h) => [h.key, h.value]),
        );

        expect(headersMap.has("Content-Security-Policy-Report-Only")).toBe(
          true,
        );
        const reportCsp = headersMap.get("Content-Security-Policy-Report-Only");
        expect(reportCsp).not.toContain("'unsafe-inline'");
        expect(reportCsp).not.toContain("'unsafe-eval'");
      }
    } finally {
      process.env.CSP_REPORT_ONLY = originalEnv;
    }
  });

  it("attaches nonce and strict-dynamic via middleware", () => {
    const req = new NextRequest("http://localhost:3000/en");
    const res = middleware(req);

    const csp =
      res.headers.get("Content-Security-Policy") ||
      res.headers.get("Content-Security-Policy-Report-Only");
    const nonce = res.headers.get("x-nonce");

    expect(nonce).toBeDefined();
    expect(typeof nonce).toBe("string");
    expect(csp).toBeDefined();
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
