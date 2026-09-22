import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const description = "Install/upgrade DoorDash CLI + agent skill from a release tarball (install | check)";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WIN = process.platform === "win32";
const SKILL_DIRS = [
  join(homedir(), ".copilot", "skills", "dd-cli-usage"),
  join(homedir(), ".claude", "skills", "dd-cli-usage"),
];

// Windows has no native build, so we use the linux-amd64 build inside WSL.
const PLATFORM = WIN
  ? "linux-amd64"
  : `${process.platform}-${process.arch === "arm64" ? "arm64" : "amd64"}`;

// Runs as root in WSL. On non-x86 WSL (Windows on ARM) it adds amd64 multiarch + qemu so the
// x86-64 build can run. wslu provides `wslview`, which lets `dd-cli login` open the Windows browser.
const WSL_ROOT_SETUP = String.raw`
set -e
export DEBIAN_FRONTEND=noninteractive
pkgs="wslu"
if [ "$(uname -m)" != x86_64 ]; then
  if ! dpkg --print-foreign-architectures | grep -qx amd64; then
    src=/etc/apt/sources.list.d/ubuntu.sources
    [ -f "$src" ] || { echo "Expected $src (Ubuntu 24.04+ deb822 sources)" >&2; exit 1; }
    grep -q '^Architectures:' "$src" || sed -i "/^Types: deb/a Architectures: $(dpkg --print-architecture)" "$src"
    . /etc/os-release
    cat > /etc/apt/sources.list.d/ubuntu-amd64.sources <<EOF
Types: deb
URIs: http://archive.ubuntu.com/ubuntu/
Suites: $VERSION_CODENAME $VERSION_CODENAME-updates $VERSION_CODENAME-security
Components: main universe
Architectures: amd64
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
    dpkg --add-architecture amd64
  fi
  pkgs="$pkgs qemu-user-static binfmt-support libc6:amd64 zlib1g:amd64"
fi
missing=$(for p in $pkgs; do dpkg -s "$p" >/dev/null 2>&1 || echo "$p"; done)
if [ -n "$missing" ]; then
  echo "Installing:" $missing
  apt-get update -qq
  apt-get install -y -qq $missing >/dev/null
fi
`;

const INSTALL = String.raw`
set -e
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
tar -xzf "$1" -C "$tmp"
dir=$(dirname "$(find "$tmp" -maxdepth 2 -name install.sh | head -1)")
bash "$dir/install.sh" </dev/null
`;

const WSL_SHELL_SETUP = String.raw`
rc="$HOME/.bashrc"
grep -q '.local/bin' "$rc" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$rc"
sed -i '/^export BROWSER=.*winbrowser/d' "$rc"
grep -q '^export BROWSER=' "$rc" || echo 'export BROWSER=wslview' >> "$rc"
`;

const VENDOR_SKILL = `tar -xzOf "$1" --wildcards '*/skills/dd-cli-usage/SKILL.md'`;
const INSTALLED_VERSION = `"$HOME/.local/bin/dd-cli" --version 2>/dev/null | sed 's/.*version //'`;

export default function main(args) {
  const [cmd = "check", tarballArg] = args;
  if (!["install", "check"].includes(cmd)) {
    console.log("Usage: s dd-cli [install|check] [path/to/dd-cli-vX.Y.Z-<platform>.tar.gz]");
    console.log(`Defaults to the newest dd-cli-v*-${PLATFORM}.tar.gz in ~/Downloads.`);
    process.exit(cmd === "-h" || cmd === "--help" ? 0 : 1);
  }

  const tarball = tarballArg ? resolve(tarballArg) : findTarball();
  const available = tarball.match(/dd-cli-v([\d.]+)-/)?.[1] ?? "unknown";
  const installed = bash(INSTALLED_VERSION).stdout.trim() || "none";
  const skill = buildSkill(tarball);
  const drifted = SKILL_DIRS.filter((d) => readOr(join(d, "SKILL.md")) !== skill);

  console.log(`Installed: ${installed}`);
  console.log(`Tarball:   ${available}  (${tarball})`);

  if (cmd === "check") {
    console.log(`Binary:    ${installed === available ? "✓ matches tarball" : "⚠ differs — run: s dd-cli install"}`);
    console.log(`Skill:     ${drifted.length ? "⚠ out of sync — run: s dd-cli install" : "✓ in sync"}`);
    for (const d of drifted) console.log(`  ${d}`);
    return;
  }

  if (WIN) {
    console.log("Preparing WSL (may take a minute the first time)...");
    bash(WSL_ROOT_SETUP, [], { root: true, inherit: true });
    bash(WSL_SHELL_SETUP, [], { inherit: true });
  }

  console.log("Installing binary...");
  bash(INSTALL, [toBashPath(tarball)], { inherit: true });

  for (const d of SKILL_DIRS) {
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "SKILL.md"), skill);
    console.log(`Skill:     ${join(d, "SKILL.md")}`);
  }

  console.log(`✓ dd-cli ${bash(INSTALLED_VERSION).stdout.trim()} installed.`);
  console.log("Restart your agent (or /skills reload) to pick up the skill. First time? Run: dd-cli login");
}

function findTarball() {
  const downloads = join(homedir(), "Downloads");
  const re = new RegExp(`^dd-cli-v([\\d.]+)-${PLATFORM}\\.tar\\.gz$`);
  const newest = readdirSync(downloads)
    .map((f) => ({ f, v: f.match(re)?.[1] }))
    .filter((x) => x.v)
    .sort((a, b) => compareVersions(b.v, a.v))[0];
  if (!newest) {
    console.error(`No dd-cli-v*-${PLATFORM}.tar.gz in ${downloads}.`);
    console.error("Download it from the dd-cli GitHub releases page, or pass a path.");
    process.exit(1);
  }
  return join(downloads, newest.f);
}

// DoorDash's SKILL.md ships in the tarball and is used verbatim; only our notes are appended.
function buildSkill(tarball) {
  const vendor = bash(VENDOR_SKILL, [toBashPath(tarball)]);
  if (vendor.status !== 0 || !vendor.stdout.trim()) {
    console.error("Tarball does not contain skills/dd-cli-usage/SKILL.md.");
    process.exit(1);
  }
  let skill = vendor.stdout.trimEnd() + "\n";
  if (WIN) skill += "\n" + readFileSync(join(ROOT, "skills", "dd-cli-usage", "windows-notes.md"), "utf8").trim() + "\n";
  return skill;
}

function bash(script, args = [], { root = false, inherit = false } = {}) {
  const [exe, argv] = WIN
    ? ["wsl.exe", [...(root ? ["-u", "root"] : []), "-e", "bash", "-c", script, "bash", ...args]]
    : ["bash", ["-c", script, "bash", ...args]];
  const r = spawnSync(exe, argv, { encoding: "utf8", stdio: inherit ? "inherit" : "pipe" });
  if (inherit && r.status !== 0) {
    console.error(`✗ Step failed (exit ${r.status}).`);
    process.exit(1);
  }
  return r;
}

function toBashPath(p) {
  if (!WIN) return p;
  return spawnSync("wsl.exe", ["-e", "wslpath", "-a", p], { encoding: "utf8" }).stdout.trim();
}

function readOr(p) {
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
