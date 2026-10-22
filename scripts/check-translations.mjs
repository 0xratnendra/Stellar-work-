#!/usr/bin/env node

/**
 * Translation Key Parity and Usage Validation Script
 *
 * This script validates internationalization catalogs in frontend/messages/:
 * 1. Locale Parity (STRICT - fails CI on drift):
 *    Compares all locales against the reference catalog (en.json).
 *    Reports missing keys in either direction (bidirectional diff).
 * 2. Unused Key Detection (ADVISORY - warns in CI):
 *    Scans frontend source code (.ts, .tsx, .js, .jsx) for references to catalog keys.
 *    Reports keys defined in catalogs that are not referenced anywhere in code.
 *
 * Correction Steps:
 * ────────────────
 * - If LOCALE PARITY fails:
 *   1. Check the list of missing keys reported below or in the GitHub Step Summary.
 *   2. If a key is missing in a non-English catalog (e.g. es.json), add the translated
 *      string under the exact same JSON path as en.json.
 *   3. If a key exists in a non-English catalog but was removed from en.json, remove
 *      the orphaned key from that catalog.
 *
 * - If UNUSED KEYS are reported:
 *   1. Check if the key is obsolete and remove it from all locale files in frontend/messages/.
 *   2. If the key is constructed dynamically via string interpolation, ensure it is
 *      documented or referenced statically.
 *
 * Usage:
 *   node scripts/check-translations.mjs [--strict-unused]
 */

import { readdir, readFile, stat, appendFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const strictUnused = args.includes("--strict-unused");

// Locate repo root and messages directory
let baseDir = process.cwd();
let messagesDir = path.join(baseDir, "frontend", "messages");
let frontendDir = path.join(baseDir, "frontend");

try {
  await stat(messagesDir);
} catch {
  // If running from inside frontend/
  messagesDir = path.join(baseDir, "messages");
  frontendDir = baseDir;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function flattenKeys(obj, prefix = "") {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys = keys.concat(flattenKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

async function getSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          ".next",
          "messages",
          ".git",
          "coverage",
          "dist",
          "build",
        ].includes(entry.name)
      ) {
        continue;
      }
      files.push(...(await getSourceFiles(res)));
    } else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) {
      files.push(res);
    }
  }
  return files;
}

// ── Main Validation ──────────────────────────────────────────────────────────

async function run() {
  console.log("==================================================");
  console.log("  StellarWork Translation Catalog Verification   ");
  console.log("==================================================\n");

  const messageFiles = (await readdir(messagesDir)).filter((f) =>
    f.endsWith(".json")
  );

  if (!messageFiles.includes("en.json")) {
    console.error("❌ Reference catalog en.json not found in", messagesDir);
    process.exit(1);
  }

  const enRaw = await readFile(path.join(messagesDir, "en.json"), "utf8");
  const enCatalog = JSON.parse(enRaw);
  const enKeys = new Set(flattenKeys(enCatalog));

  console.log(`Reference catalog (en.json): ${enKeys.size} keys found.`);

  let parityFailed = false;
  const parityReports = [];

  // 1. Check Locale Parity across all other catalogs
  for (const file of messageFiles) {
    if (file === "en.json") continue;

    const locale = path.basename(file, ".json");
    const filePath = path.join(messagesDir, file);
    const raw = await readFile(filePath, "utf8");
    let catalog = {};
    try {
      catalog = JSON.parse(raw);
    } catch (err) {
      console.error(`❌ Syntax error in ${file}: ${err.message}`);
      parityFailed = true;
      continue;
    }

    const currentKeys = new Set(flattenKeys(catalog));
    const missingInLocale = [...enKeys].filter((k) => !currentKeys.has(k));
    const extraInLocale = [...currentKeys].filter((k) => !enKeys.has(k));

    parityReports.push({
      locale,
      file,
      totalKeys: currentKeys.size,
      missingInLocale,
      extraInLocale,
    });

    if (missingInLocale.length > 0 || extraInLocale.length > 0) {
      parityFailed = true;
      console.log(`\n❌ Parity drift detected in ${file}:`);
      if (missingInLocale.length > 0) {
        console.log(`   Missing in ${file} (${missingInLocale.length}):`);
        for (const k of missingInLocale) {
          console.log(`     - ${k}`);
          if (process.env.GITHUB_ACTIONS) {
            console.log(
              `::error file=frontend/messages/${file}::Missing key in ${file}: ${k}`
            );
          }
        }
      }
      if (extraInLocale.length > 0) {
        console.log(`   Extra in ${file} (not in en.json) (${extraInLocale.length}):`);
        for (const k of extraInLocale) {
          console.log(`     + ${k}`);
          if (process.env.GITHUB_ACTIONS) {
            console.log(
              `::error file=frontend/messages/${file}::Orphaned key in ${file} (not in en.json): ${k}`
            );
          }
        }
      }
    } else {
      console.log(`✅ ${file}: 100% parity with en.json (${currentKeys.size} keys).`);
    }
  }

  // 2. Scan source files for unused keys
  console.log("\nScanning frontend source files for key usage...");
  const sourceFiles = await getSourceFiles(frontendDir);
  console.log(`Scanned ${sourceFiles.length} source files.`);

  const sourceContents = await Promise.all(
    sourceFiles.map((f) => readFile(f, "utf8"))
  );
  const combinedSource = sourceContents.join("\n");

  const unusedKeys = [];
  for (const fullKey of enKeys) {
    const parts = fullKey.split(".");
    const leaf = parts[parts.length - 1];

    // Key is considered used if full dot path appears OR leaf key token appears in quotes
    const isUsed =
      combinedSource.includes(fullKey) ||
      combinedSource.includes(`"${leaf}"`) ||
      combinedSource.includes(`'${leaf}'`) ||
      combinedSource.includes(`\`${leaf}\``);

    if (!isUsed) {
      unusedKeys.push(fullKey);
    }
  }

  if (unusedKeys.length > 0) {
    console.log(`\n⚠️  Advisory: Found ${unusedKeys.length} potentially unused translation key(s):`);
    for (const k of unusedKeys) {
      console.log(`   - ${k}`);
      if (process.env.GITHUB_ACTIONS) {
        console.log(
          `::warning file=frontend/messages/en.json::Potentially unused translation key: ${k}`
        );
      }
    }
  } else {
    console.log("✅ All catalog keys appear to be referenced in code.");
  }

  // 3. Write GitHub Step Summary if running in GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    let summary = "## 🌐 Translation Parity & Usage Check\n\n";
    summary += "| Catalog | Total Keys | Missing vs en.json | Extra vs en.json | Status |\n";
    summary += "|---------|------------|---------------------|-------------------|--------|\n";
    summary += `| \`en.json\` (ref) | ${enKeys.size} | — | — | ✅ Reference |\n`;

    for (const r of parityReports) {
      const status =
        r.missingInLocale.length === 0 && r.extraInLocale.length === 0
          ? "✅ Parity OK"
          : "❌ Drift Detected";
      summary += `| \`${r.file}\` | ${r.totalKeys} | ${r.missingInLocale.length} | ${r.extraInLocale.length} | ${status} |\n`;
    }

    if (parityFailed) {
      summary += "\n### ❌ Locale Parity Failures\n";
      for (const r of parityReports) {
        if (r.missingInLocale.length > 0) {
          summary += `\n**Missing in \`${r.file}\` (${r.missingInLocale.length}):**\n`;
          summary += r.missingInLocale.map((k) => `- \`${k}\``).join("\n") + "\n";
        }
        if (r.extraInLocale.length > 0) {
          summary += `\n**Extra in \`${r.file}\` (not in reference) (${r.extraInLocale.length}):**\n`;
          summary += r.extraInLocale.map((k) => `+ \`${k}\``).join("\n") + "\n";
        }
      }
      summary += "\n> **Action Required**: Synchronize missing or extra keys to match `en.json`.\n";
    }

    summary += "\n### 🔍 Unused Keys Report (Advisory)\n";
    if (unusedKeys.length > 0) {
      summary += `Found **${unusedKeys.length}** catalog keys not directly matched in source code:\n\n`;
      summary += unusedKeys.map((k) => `- \`${k}\``).join("\n") + "\n";
    } else {
      summary += "✅ No unreferenced translation keys found.\n";
    }

    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }

  // 4. Exit code
  if (parityFailed || (strictUnused && unusedKeys.length > 0)) {
    console.log("\n❌ Translation check failed.");
    process.exit(1);
  } else {
    console.log("\n✨ Translation check passed!");
  }
}

run().catch((err) => {
  console.error("Fatal error running translation check:", err);
  process.exit(1);
});
