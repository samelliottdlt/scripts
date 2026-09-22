#!/usr/bin/env node

// Forwards to the real dd-cli binary installed by `s dd-cli install`.
// On Windows the binary lives inside WSL, so arguments are handed to wsl.exe as argv
// (no cmd.exe re-parsing, so quotes and newlines survive).
// In WSL it also selects the file-backed keyring that `s dd-cli install` drops next to the
// binary, so gnome-keyring never prompts to be unlocked.

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);

const WSL_RUN = String.raw`
bin="$HOME/.local/bin"
[ -f "$bin/_internal/s_file_keyring.py" ] && export PYTHON_KEYRING_BACKEND=s_file_keyring.Keyring
exec "$bin/dd-cli" "$@"
`;

const result =
  process.platform === "win32"
    ? spawnSync("wsl.exe", ["-e", "sh", "-c", WSL_RUN, "dd-cli", ...args], { stdio: "inherit" })
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
