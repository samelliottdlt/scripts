#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const scriptsDir = join(rootDir, "scripts");
const checkFile = join(rootDir, ".last-update-check");

const [scriptName, ...args] = process.argv.slice(2);

// ── built-in commands ───────────────────────────────────────────────────────
if (scriptName === "update") {
  await update();
  process.exit(0);
}

if (!scriptName || scriptName === "--help" || scriptName === "-h") {
  await listScripts();
  process.exit(0);
}

// ── run script ──────────────────────────────────────────────────────────────
await checkForUpdates();

const scriptPath = join(scriptsDir, `${scriptName}.mjs`);

try {
  const mod = await import(pathToFileURL(scriptPath).href);
  if (typeof mod.default === "function") {
    await mod.default(args);
  }
} catch (err) {
  if (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "ENOENT") {
    console.error(`Unknown script: ${scriptName}\n`);
    await listScripts();
    process.exit(1);
  }
  throw err;
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function update() {
  console.log("Updating scripts...");
  try {
    execSync("git pull --ff-only", { cwd: rootDir, stdio: "inherit" });
    execSync("npm link --force --silent", { cwd: rootDir, stdio: "inherit" });
    await writeFile(checkFile, String(Date.now()));
    console.log("✓ Up to date.");
  } catch {
    console.error("Update failed. Try manually: cd ~/.s && git pull");
    process.exit(1);
  }
}

async function checkForUpdates() {
  try {
    const ONE_DAY = 86400000;
    let lastCheck = 0;
    try {
      lastCheck = Number(await readFile(checkFile, "utf8"));
    } catch {}
    if (Date.now() - lastCheck < ONE_DAY) return;

    await writeFile(checkFile, String(Date.now()));
    execSync("git fetch --quiet", { cwd: rootDir, timeout: 5000 });

    const local = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
    const remote = execSync("git rev-parse @{u}", { cwd: rootDir, encoding: "utf8" }).trim();
    if (local !== remote) {
      console.log("Update available! Run: s update\n");
    }
  } catch {
    // network down, no upstream, etc — silently skip
  }
}

async function listScripts() {
  console.log("Usage: s <script-name> [...args]\n");
  console.log("Available scripts:");
  try {
    const files = await readdir(scriptsDir);
    const scripts = files
      .filter((f) => extname(f) === ".mjs")
      .map((f) => basename(f, ".mjs"));
    for (const s of scripts) {
      let description = "";
      try {
        const mod = await import(
          pathToFileURL(join(scriptsDir, `${s}.mjs`)).href
        );
        if (mod.description) description = ` - ${mod.description}`;
      } catch {}
      console.log(`  ${s}${description}`);
    }
  } catch {
    console.log("  (none)");
  }
}
