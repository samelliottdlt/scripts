#!/usr/bin/env node

// Forwards to the real dd-cli binary installed by `s dd-cli install`.
// On Windows the binary lives inside WSL, so arguments are handed to wsl.exe as argv
// (no cmd.exe re-parsing, so quotes and newlines survive).

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);

const result =
  process.platform === "win32"
    ? spawnSync("wsl.exe", ["-e", "sh", "-c", 'exec "$HOME/.local/bin/dd-cli" "$@"', "dd-cli", ...args], {
        stdio: "inherit",
      })
    : spawnSync(join(homedir(), ".local", "bin", "dd-cli"), args, { stdio: "inherit" });

if (result.error) {
  console.error(`dd-cli: ${result.error.message}`);
  console.error("Is it installed? Run: s dd-cli install");
  process.exit(1);
}
if (process.platform === "win32" && result.status === 127) {
  console.error("dd-cli is not installed in WSL. Run: s dd-cli install");
}
process.exit(result.status ?? 1);
