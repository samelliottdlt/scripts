import { execSync } from "node:child_process";
import { writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const description = "Pull latest scripts and re-link";

export default async function main() {
  if (process.env.S_DEV) {
    console.error("Error: 'update' is disabled in dev mode — it would overwrite your local checkout.");
    console.error("Run 's update' from the global installation instead.");
    process.exit(1);
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), "..");

  try {
    const head = () => execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
    const before = head();

    console.log("Pulling latest...");
    execSync("git pull --ff-only --quiet", { cwd: root, stdio: "inherit" });

    const after = head();
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
