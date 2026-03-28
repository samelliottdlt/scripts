import { execSync } from "node:child_process";
import { writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const description = "Pull latest scripts and re-link";

export default async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");

  try {
    const head = (sha) => execSync(`git rev-parse ${sha}`, { cwd: root, encoding: "utf8" }).trim();
    const before = head("HEAD");

    console.log("Pulling latest...");
    execSync("git pull --ff-only", { cwd: root, stdio: "ignore" });

    const after = head("HEAD");
    const pulled = before !== after;

    console.log("Installing dependencies...");
    const lockExists = await stat(join(root, "package-lock.json")).then(() => true, () => false);
    execSync(lockExists ? "npm ci --silent" : "npm i --silent", { cwd: root, stdio: "ignore" });

    console.log("Re-linking...");
    execSync("npm link --force --silent", { cwd: root, stdio: "ignore" });

    await writeFile(join(root, ".last-update-check"), String(Date.now()));
    console.log(pulled ? `✓ Updated! (${before.slice(0, 7)} → ${after.slice(0, 7)})` : "✓ Already up to date.");
  } catch {
    console.error("Update failed. Try manually: cd ~/.s && git pull");
    process.exit(1);
  }
}
