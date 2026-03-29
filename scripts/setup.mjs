import { execSync } from "node:child_process";
import { access } from "node:fs/promises";

export const description = "Check dev environment for required tools";

const TOOLS = [
  {
    name: "git",
    cmd: "git --version",
    parse: (out) => out.match(/git version ([\d.]+)/)?.[1],
    install: {
      darwin: "brew install git",
      arch: "sudo pacman -S git",
      linux: "sudo apt install git   # or your distro's package manager",
      win32: "winget install Git.Git",
    },
  },
  {
    name: "chezmoi",
    cmd: "chezmoi --version",
    parse: (out) => out.match(/v?([\d.]+)/)?.[1],
    install: {
      darwin: "brew install chezmoi",
      arch: "sudo pacman -S chezmoi",
      linux: 'sh -c "$(curl -fsLS get.chezmoi.io)"',
      win32: "winget install twpayne.chezmoi",
    },
  },
  {
    name: "fnm",
    cmd: "fnm --version",
    parse: (out) => out.match(/(\d[\d.]+)/)?.[1],
    install: {
      darwin: "brew install fnm",
      arch: "sudo pacman -S fnm",
      linux: "curl -fsSL https://fnm.vercel.app/install | bash",
      win32: "winget install Schniz.fnm",
    },
  },
  {
    name: "node",
    cmd: "node --version",
    parse: (out) => out.match(/v?([\d.]+)/)?.[1],
    install: {
      _all: "fnm install --lts   # requires fnm",
    },
  },
  {
    name: "npm",
    cmd: "npm --version",
    parse: (out) => out.trim(),
    install: {
      _all: "Comes with Node — install Node first",
    },
  },
  {
    name: "rustup",
    cmd: "rustup --version",
    parse: (out) => out.match(/rustup ([\d.]+)/)?.[1],
    install: {
      darwin: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
      arch: "sudo pacman -S rustup && rustup default stable",
      linux: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
      win32: "winget install Rustlang.Rustup",
    },
  },
  {
    name: "cargo",
    cmd: "cargo --version",
    parse: (out) => out.match(/cargo ([\d.]+)/)?.[1],
    install: {
      _all: "Comes with Rust — install rustup first, then: rustup default stable",
    },
  },
  {
    name: "gh",
    cmd: "gh --version",
    parse: (out) => out.match(/gh version ([\d.]+)/)?.[1],
    install: {
      darwin: "brew install gh",
      arch: "sudo pacman -S github-cli",
      linux: "https://github.com/cli/cli/blob/trunk/docs/install_linux.md",
      win32: "winget install GitHub.cli",
    },
  },
];

function detectPlatform() {
  if (process.platform === "win32") return "win32";
  if (process.platform === "darwin") return "darwin";

  // Distinguish Arch from other Linux
  try {
    execSync("test -f /etc/arch-release", { stdio: "ignore" });
    return "arch";
  } catch {
    return "linux";
  }
}

function checkTool(tool) {
  try {
    const out = execSync(tool.cmd, { encoding: "utf8", timeout: 5_000, stdio: ["ignore", "pipe", "ignore"] });
    const version = tool.parse(out) ?? "unknown";
    return { ...tool, installed: true, version };
  } catch {
    return { ...tool, installed: false };
  }
}

function getInstallHint(tool, platform) {
  const inst = tool.install;
  return inst._all ?? inst[platform] ?? inst.linux ?? "See official docs";
}

const PLATFORM_LABELS = {
  darwin: "macOS",
  arch: "Arch Linux",
  linux: "Linux",
  win32: "Windows",
};

export default function main() {
  const platform = detectPlatform();
  console.log(`Platform: ${PLATFORM_LABELS[platform]}\n`);

  const results = TOOLS.map(checkTool);
  const missing = results.filter((r) => !r.installed);

  // ── Status table ──
  const maxName = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const label = r.name.padEnd(maxName);
    if (r.installed) {
      console.log(`  ✓  ${label}  ${r.version}`);
    } else {
      console.log(`  ✗  ${label}  not found`);
    }
  }

  // ── Missing tool guidance ──
  if (missing.length === 0) {
    console.log("\n✓ All tools installed!");
    return;
  }

  console.log(`\n${missing.length} missing tool${missing.length > 1 ? "s" : ""}:\n`);
  for (const tool of missing) {
    const hint = getInstallHint(tool, platform);
    console.log(`  ${tool.name}`);
    console.log(`    → ${hint}\n`);
  }

  process.exit(1);
}
