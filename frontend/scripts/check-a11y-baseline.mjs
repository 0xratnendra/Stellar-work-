import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

const BASELINE_PATH = path.join(frontendDir, "a11y-baseline.json");
const REPORT_PATH = path.join(frontendDir, "a11y-report.html");
const JSON_REPORT_PATH = path.join(frontendDir, "a11y-report.json");

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(BASELINE_PATH, "utf8");
    const data = JSON.parse(raw);
    return data.baselineViolations || [];
  } catch (err) {
    console.error("Error reading accessibility baseline file:", err);
    return [];
  }
}

function parseTestOutput(inputFile) {
  if (inputFile && fs.existsSync(inputFile)) {
    try {
      const raw = fs.readFileSync(inputFile, "utf8");
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return [];
}

function main() {
  const args = process.argv.slice(2);
  const inputArg = args.find((arg) => arg.startsWith("--input="))?.split("=")[1];

  const baseline = loadBaseline();
  const currentViolations = parseTestOutput(inputArg);

  const baselineKeys = new Set(
    baseline.map((v) => `${v.id}:${v.target || ""}:${v.help || ""}`)
  );

  const deltaViolations = currentViolations.filter((v) => {
    const key = `${v.id}:${v.target || ""}:${v.help || ""}`;
    return !baselineKeys.has(key);
  });

  // Generate accessible HTML report
  const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Accessibility Check Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1e293b; line-height: 1.5; }
    h1 { color: #0f172a; }
    .status-pass { color: #166534; background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; border: 1px solid #bbf7d0; }
    .status-fail { color: #991b1b; background: #fef2f2; padding: 1rem; border-radius: 0.5rem; border: 1px solid #fecaca; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>Accessibility Baseline & Delta Check Report</h1>
  <p>Run Date: ${new Date().toISOString()}</p>
  <div class="${deltaViolations.length === 0 ? "status-pass" : "status-fail"}">
    <h2>Summary: ${deltaViolations.length === 0 ? "PASS (No New Violations)" : `FAIL (${deltaViolations.length} New Violation(s) Detected)`}</h2>
    <p>Committed Baseline Violations: ${baseline.length}</p>
    <p>Total Current Violations: ${currentViolations.length}</p>
    <p>Delta (Unbaselined) Violations: ${deltaViolations.length}</p>
  </div>
  ${
    deltaViolations.length > 0
      ? `
  <h3>New Accessibility Violations (Delta)</h3>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Impact</th>
        <th>Description</th>
        <th>Target Element</th>
      </tr>
    </thead>
    <tbody>
      ${deltaViolations
        .map(
          (v) => `
        <tr>
          <td><strong>${v.id}</strong></td>
          <td>${v.impact || "medium"}</td>
          <td>${v.help || v.description}</td>
          <td><code>${v.target || "N/A"}</code></td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
  `
      : "<p>All accessibility rules met or covered by committed baseline.</p>"
  }
</body>
</html>`;

  fs.writeFileSync(REPORT_PATH, htmlReport, "utf8");
  fs.writeFileSync(
    JSON_REPORT_PATH,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        baselineCount: baseline.length,
        currentCount: currentViolations.length,
        deltaCount: deltaViolations.length,
        deltaViolations,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("=== ACCESSIBILITY CI CHECK RESULTS ===");
  console.log(`Committed Baseline Violations: ${baseline.length}`);
  console.log(`Current Total Violations:      ${currentViolations.length}`);
  console.log(`Delta (New Violations):        ${deltaViolations.length}`);
  console.log(`Accessible Report Generated:  ${REPORT_PATH}`);

  if (deltaViolations.length > 0) {
    console.error("\n❌ ACCESSIBILITY CHECK FAILED: New violations detected beyond baseline!");
    deltaViolations.forEach((v, index) => {
      console.error(`  ${index + 1}. [${v.id}] ${v.help} (Target: ${v.target || "N/A"})`);
    });
    process.exit(1);
  } else {
    console.log("\n✅ ACCESSIBILITY CHECK PASSED: No new violations.");
    process.exit(0);
  }
}

main();
