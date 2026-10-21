import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../app/api/csp-report/route";
import * as metrics from "../lib/metrics";

describe("CSP Report Ingestion Route Handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully ingests legacy CSP report and records metric", async () => {
    const recordSpy = vi.spyOn(metrics, "recordCspViolation");

    const req = new Request("https://example.com/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "https://example.com/job/1",
          "violated-directive": "script-src 'self'",
          "effective-directive": "script-src",
          "blocked-uri": "https://evil.com/malicious.js",
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(recordSpy).toHaveBeenCalledWith(
      "script-src",
      "https://evil.com/malicious.js",
      "https://example.com/job/1",
    );
  });

  it("successfully ingests Reporting API v1 format", async () => {
    const recordSpy = vi.spyOn(metrics, "recordCspViolation");

    const req = new Request("https://example.com/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/reports+json" },
      body: JSON.stringify([
        {
          type: "csp-violation",
          body: {
            documentURL: "https://example.com/dashboard",
            effectiveDirective: "connect-src",
            blockedURL: "https://unauthorized-api.com",
          },
        },
      ]),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(recordSpy).toHaveBeenCalledWith(
      "connect-src",
      "https://unauthorized-api.com",
      "https://example.com/dashboard",
    );
  });

  it("rejects malformed payloads with 400", async () => {
    const req = new Request("https://example.com/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ other: "data" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects non-JSON payload with 400", async () => {
    const req = new Request("https://example.com/api/csp-report", {
      method: "POST",
      body: "not json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
