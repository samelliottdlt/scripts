#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptsDir = join(__dirname, "..", "scripts");

const [scriptName, ...args] = process.argv.slice(2);

if (!scriptName || scriptName === "--help" || scriptName === "-h") {
  await listScripts();
  process.exit(0);
}

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
