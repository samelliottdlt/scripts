import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const description = "Show local vs remote HEAD";

export default function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");

  execSync("git fetch --quiet", { cwd: root, timeout: 5_000 });

  const local = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  const remote = execSync("git rev-parse @{u}", { cwd: root, encoding: "utf8" }).trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, encoding: "utf8" }).trim();

  console.log(`Branch:  ${branch}`);
  console.log(`Local:   ${local}`);
  console.log(`Remote:  ${remote}`);
  console.log(`Status:  ${local === remote ? "✓ Up to date" : "⚠ Behind — run: s update"}`);
}
