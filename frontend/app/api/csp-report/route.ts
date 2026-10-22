import { recordCspViolation } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/** Maximum allowed payload size for a CSP report (16 KB). */
const MAX_BODY_BYTES = 16 * 1024;

/** Simple in-memory sliding-window rate limiter per client IP */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;
const clientRequestMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const entry = clientRequestMap.get(clientIp);

  if (!entry || now > entry.resetAt) {
    clientRequestMap.set(clientIp, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    // Cleanup expired entries when map gets large
    if (clientRequestMap.size > 1000) {
      for (const [ip, e] of clientRequestMap.entries()) {
        if (now > e.resetAt) clientRequestMap.delete(ip);
      }
    }
    return false;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  entry.count += 1;
  return false;
}

interface CspReportPayload {
  "csp-report"?: {
    "document-uri"?: string;
    referrer?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    disposition?: string;
    "blocked-uri"?: string;
    "status-code"?: number;
  };
  // Reporting API v1 format
  type?: string;
  body?: {
    documentURL?: string;
    effectiveDirective?: string;
    blockedURL?: string;
    disposition?: string;
    statusCode?: number;
  };
  // Direct fields fallback
  "document-uri"?: string;
  "violated-directive"?: string;
  "effective-directive"?: string;
  "blocked-uri"?: string;
}

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return new Response("Payload Too Large", { status: 413 });
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";

  if (isRateLimited(clientIp)) {
    return new Response("Too Many Requests", { status: 429 });
  }

  let text: string;
  try {
    text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return new Response("Payload Too Large", { status: 413 });
    }
  } catch {
    return new Response("Failed to read body", { status: 400 });
  }

  if (!text.trim()) {
    return new Response("Empty body", { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const reports: CspReportPayload[] = Array.isArray(parsed)
    ? parsed
    : [parsed as CspReportPayload];

  let ingestedCount = 0;

  for (const item of reports) {
    if (!item || typeof item !== "object") continue;

    let directive = "";
    let blockedUri = "";
    let documentUri = "";

    if (item["csp-report"]) {
      const rep = item["csp-report"];
      directive = rep["effective-directive"] || rep["violated-directive"] || "";
      blockedUri = rep["blocked-uri"] || "";
      documentUri = rep["document-uri"] || "";
    } else if (item.type === "csp-violation" && item.body) {
      directive = item.body.effectiveDirective || "";
      blockedUri = item.body.blockedURL || "";
      documentUri = item.body.documentURL || "";
    } else if (
      item["violated-directive"] ||
      item["effective-directive"] ||
      item["blocked-uri"]
    ) {
      directive =
        item["effective-directive"] || item["violated-directive"] || "";
      blockedUri = item["blocked-uri"] || "";
      documentUri = item["document-uri"] || "";
    }

    if (!directive && !blockedUri) {
      continue;
    }

    recordCspViolation(directive, blockedUri, documentUri);
    ingestedCount++;

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[CSP Violation] directive=${directive} blockedUri=${blockedUri} documentUri=${documentUri}`,
      );
    }
  }

  if (ingestedCount === 0) {
    return new Response("Malformed report payload", { status: 400 });
  }

  return new Response(null, { status: 204 });
}
