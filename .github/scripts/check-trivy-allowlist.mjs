#!/usr/bin/env node
/**
 * check-trivy-allowlist.mjs
 *
 * Cross-references a Trivy JSON vulnerability report against the container
 * scan allowlist (.github/container-scan-allowlist.json) and exits non-zero
 * if any CRITICAL or HIGH finding is not covered by a valid, unexpired entry.
 *
 * Usage:
 *   node .github/scripts/check-trivy-allowlist.mjs \
 *     --input  <path-to-trivy-results.json> \
 *     --allowlist <path-to-container-scan-allowlist.json>
 *
 * Exit codes:
 *   0  All CRITICAL/HIGH findings are allowlisted and no entries are expired.
 *   1  One or more findings are unapproved, or one or more allowlist entries
 *      have expired. A human-readable summary is printed to stderr.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
}

const inputPath = flag("--input");
const allowlistPath = flag("--allowlist");

if (!inputPath || !allowlistPath) {
  console.error("Usage: check-trivy-allowlist.mjs --input <file> --allowlist <file>");
  process.exit(1);
}

// ── Load files ────────────────────────────────────────────────────────────────

let trivyReport;
try {
  trivyReport = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
} catch (err) {
  console.error(`[allowlist] Failed to read Trivy report at ${inputPath}: ${err.message}`);
  process.exit(1);
}

let allowlistFile;
try {
  allowlistFile = JSON.parse(readFileSync(resolve(allowlistPath), "utf8"));
} catch (err) {
  console.error(`[allowlist] Failed to read allowlist at ${allowlistPath}: ${err.message}`);
  process.exit(1);
}

const allowlist = allowlistFile.vulnerabilities ?? [];

// ── Collect findings from Trivy report ───────────────────────────────────────

/** @type {{ id: string; packageName: string; severity: string; installed: string; fixed: string | null; target: string }[]} */
const findings = [];

for (const result of trivyReport.Results ?? []) {
  for (const vuln of result.Vulnerabilities ?? []) {
    if (vuln.Severity !== "CRITICAL" && vuln.Severity !== "HIGH") continue;
    findings.push({
      id: vuln.VulnerabilityID,
      packageName: vuln.PkgName,
      severity: vuln.Severity,
      installed: vuln.InstalledVersion ?? "unknown",
      fixed: vuln.FixedVersion ?? null,
      target: result.Target ?? "unknown",
    });
  }
}

if (findings.length === 0) {
  console.log("[allowlist] ✅  No CRITICAL or HIGH findings. Nothing to check.");
  process.exit(0);
}

console.log(`[allowlist] Found ${findings.length} CRITICAL/HIGH finding(s). Checking allowlist…\n`);

// ── Today's date for expiry checks ────────────────────────────────────────────

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

// ── Cross-reference ───────────────────────────────────────────────────────────

/** @type {string[]} */
const unapproved = [];

/** @type {string[]} */
const expiredEntries = [];

/** @type {string[]} */
const approved = [];

for (const finding of findings) {
  const entry = allowlist.find(
    (a) =>
      a.id === finding.id &&
      a.packageName === finding.packageName,
  );

  if (!entry) {
    unapproved.push(
      `  ✗ ${finding.severity.padEnd(8)} ${finding.id}  ${finding.packageName}@${finding.installed}` +
      (finding.fixed ? `  (fixed in ${finding.fixed})` : "  (no fix available)") +
      `  [${finding.target}]`,
    );
    continue;
  }

  // Validate required fields.
  if (!entry.reason || entry.reason.trim() === "") {
    unapproved.push(
      `  ✗ ${finding.severity.padEnd(8)} ${finding.id}  ${finding.packageName}` +
      `  — allowlist entry exists but 'reason' is empty`,
    );
    continue;
  }

  if (!entry.expiresAt) {
    unapproved.push(
      `  ✗ ${finding.severity.padEnd(8)} ${finding.id}  ${finding.packageName}` +
      `  — allowlist entry exists but 'expiresAt' is missing`,
    );
    continue;
  }

  const expiry = new Date(entry.expiresAt);
  if (isNaN(expiry.getTime())) {
    unapproved.push(
      `  ✗ ${finding.severity.padEnd(8)} ${finding.id}  ${finding.packageName}` +
      `  — allowlist 'expiresAt' is not a valid ISO date: ${entry.expiresAt}`,
    );
    continue;
  }

  if (expiry < today) {
    expiredEntries.push(
      `  ✗ ${finding.severity.padEnd(8)} ${finding.id}  ${finding.packageName}` +
      `  — allowlist entry expired on ${entry.expiresAt} (added by ${entry.addedBy ?? "unknown"})`,
    );
    continue;
  }

  approved.push(
    `  ✓ ${finding.severity.padEnd(8)} ${finding.id}  ${finding.packageName}` +
    `  — allowed until ${entry.expiresAt} (${entry.reason})`,
  );
}

// ── Print summary ─────────────────────────────────────────────────────────────

if (approved.length > 0) {
  console.log("Approved (allowlisted):");
  approved.forEach((line) => console.log(line));
  console.log();
}

const failed = unapproved.length > 0 || expiredEntries.length > 0;

if (expiredEntries.length > 0) {
  console.error("Expired allowlist entries (must be renewed or remediated):");
  expiredEntries.forEach((line) => console.error(line));
  console.error();
}

if (unapproved.length > 0) {
  console.error("Unapproved findings (not in allowlist):");
  unapproved.forEach((line) => console.error(line));
  console.error();
}

if (failed) {
  console.error(
    `[allowlist] ✗ ${unapproved.length + expiredEntries.length} finding(s) require action.\n` +
    "To resolve:\n" +
    "  1. Upgrade the affected package or rebuild with a patched base image.\n" +
    "  2. If no fix is available, add an entry to .github/container-scan-allowlist.json\n" +
    "     with a non-empty 'reason' and an 'expiresAt' date no more than 90 days away.\n" +
    "  See SECURITY.md § Container scanning for the full process.",
  );
  process.exit(1);
}

console.log(`[allowlist] ✅  All ${approved.length} finding(s) are covered by valid allowlist entries.`);
process.exit(0);
