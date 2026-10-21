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
