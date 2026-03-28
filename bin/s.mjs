#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join, dirname, basename, extname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS_DIR = join(ROOT, "scripts");
const CHECK_FILE = join(ROOT, ".last-update-check");

const [name, ...args] = process.argv.slice(2);

if (!name || name === "--help" || name === "-h") {
  await printUsage();
  process.exit(0);
}

await notifyIfOutdated();
await runScript(name, args);

async function runScript(name, args) {
  const path = join(SCRIPTS_DIR, `${name}.mjs`);

  try {
    const { default: main } = await import(pathToFileURL(path).href);
    if (typeof main === "function") await main(args);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "ENOENT") {
      console.error(`Unknown script: ${name}\n`);
      await printUsage();
      process.exit(1);
    }
    throw err;
  }
}

async function printUsage() {
  console.log("Usage: s <script> [...args]\n");
  console.log("Scripts:");

  const files = await readdir(SCRIPTS_DIR).catch(() => []);

  for (const file of files) {
    if (extname(file) !== ".mjs") continue;
    const script = basename(file, ".mjs");
    try {
      const { description } = await import(pathToFileURL(join(SCRIPTS_DIR, file)).href);
      console.log(`  ${script}${description ? ` — ${description}` : ""}`);
    } catch {
      console.log(`  ${script}`);
    }
  }
}

async function notifyIfOutdated() {
  try {
    const ONE_HOUR = 3_600_000;
    const lastCheck = Number(await readFile(CHECK_FILE, "utf8").catch(() => "0"));
    if (Date.now() - lastCheck < ONE_HOUR) return;

    await writeFile(CHECK_FILE, String(Date.now()));
    execSync("git fetch --quiet", { cwd: ROOT, timeout: 5_000 });

    const head = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
    const upstream = execSync("git rev-parse @{u}", { cwd: ROOT, encoding: "utf8" }).trim();

    if (head !== upstream) {
      console.log("Update available! Run: s update\n");
    }
  } catch {
    // Offline or no upstream — skip silently
  }
}
