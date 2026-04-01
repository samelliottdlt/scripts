import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { execSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";

export const description = "Launch daily workspace in tmux/pmux";

const CONFIG_DIR = join(homedir(), ".config", "s");
const CONFIG_PATH = join(CONFIG_DIR, "work.json");

const DEFAULT_CONFIG = {
  defaults: {
    multiplexer: "auto",
    editor: "code",
    sessionName: "work",
    agent: { invoke: "copilot" },
  },
  projects: [],
};

// ── Utilities ────────────────────────────────────────────────────────────────

function expandHome(p) {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
  return p;
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function saveConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

function run(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "ignore"],
    ...opts,
  }).trim();
}

async function prompt(rl, question, fallback) {
  const suffix = fallback != null ? ` [${fallback}]` : "";
  const answer = (await rl.question(`  ${question}${suffix}: `)).trim();
  return answer || (fallback ?? "");
}

async function choose(rl, question, options, defaultIdx = 0) {
  console.log(`\n  ${question}`);
  options.forEach((o, i) => console.log(`    ${i + 1}. ${o}`));
  const answer = await prompt(rl, "Choice", String(defaultIdx + 1));
  const idx = parseInt(answer, 10) - 1;
  return idx >= 0 && idx < options.length ? options[idx] : options[defaultIdx];
}

function detectMux(preference) {
  if (preference && preference !== "auto") {
    try {
      run(`${preference} -V`);
      return preference;
    } catch {
      return null;
    }
  }
  for (const m of ["pmux", "tmux"]) {
    try {
      run(`${m} -V`);
      return m;
    } catch {}
  }
  return null;
}

// ── Container management ─────────────────────────────────────────────────────

function cname(project) {
  return `s-work-${project}`;
}
function vname(project) {
  return `s-work-${project}-data`;
}

function isRunning(name) {
  try {
    return run(`docker inspect -f "{{.State.Running}}" ${name}`) === "true";
  } catch {
    return false;
  }
}

function cExists(name) {
  try {
    run(`docker inspect ${name}`);
    return true;
  } catch {
    return false;
  }
}

function ensureContainer(project, config) {
  const cn = cname(project.name);

  try {
    if (isRunning(cn)) {
      console.log(`  ✓  ${cn} running`);
      return true;
    }

    if (cExists(cn)) {
      console.log(`  ▸  Starting ${cn}...`);
      execSync(`docker start ${cn}`, { stdio: "inherit", timeout: 30_000 });
      return true;
    }

    const image = project.image || "node:22-bookworm";
    console.log(`  ▸  Creating ${cn} (${image})...`);

    const args = ["run", "-d", "--name", cn, "-w", "/workspace"];

    // Volume strategy: bind-mount if path is set, named volume otherwise
    if (project.path) {
      args.push("-v", `${expandHome(project.path)}:/workspace`);
    } else {
      args.push("-v", `${vname(project.name)}:/workspace`);
    }

    for (const e of project.env || []) args.push("-e", e);
    for (const v of project.volumes || []) args.push("-v", v);
    if (project.platform) args.push("--platform", project.platform);
    args.push(image, "sleep", "infinity");

    spawnSync("docker", args, { stdio: "inherit", timeout: 120_000 });

    // Clone repo into volume if workspace is empty (volume mode only)
    if (project.repo && !project.path) {
      try {
        const listing = run(`docker exec ${cn} ls -A /workspace`, {
          timeout: 5_000,
        });
        if (!listing) {
          console.log(`  ▸  Cloning ${project.repo}...`);
          spawnSync(
            "docker",
            ["exec", "-w", "/workspace", cn, "git", "clone", project.repo, "."],
            { stdio: "inherit", timeout: 300_000 },
          );
        }
      } catch {}
    }

    // Install agent inside container
    const installCmd = project.agent?.install || config.defaults?.agent?.install;
    if (installCmd) {
      console.log(`  ▸  Installing agent...`);
      try {
        spawnSync("docker", ["exec", cn, "sh", "-c", installCmd], {
          stdio: "inherit",
          timeout: 120_000,
        });
      } catch {
        console.log(`  ⚠  Agent install failed — install manually`);
      }
    }

    // Project-specific setup
    if (project.setup) {
      console.log(`  ▸  Running setup: ${project.setup}`);
      try {
        spawnSync("docker", ["exec", "-w", "/workspace", cn, "sh", "-c", project.setup], {
          stdio: "inherit",
          timeout: 300_000,
        });
      } catch {
        console.log(`  ⚠  Setup command failed`);
      }
    }

    console.log(`  ✓  ${cn} ready`);
    return true;
  } catch (err) {
    console.log(`  ✗  Failed to start ${cn}: ${err.message || err}`);
    return false;
  }
}

// ── tmux/pmux session builder ────────────────────────────────────────────────

function muxRun(mux, args) {
  spawnSync(mux, args, { stdio: "ignore", timeout: 5_000 });
}

function sessionUp(mux, name) {
  return spawnSync(mux, ["has-session", "-t", name], { stdio: "ignore" }).status === 0;
}

function buildSession(mux, session, projects, config) {
  const defaultInvoke = config.defaults?.agent?.invoke || "copilot";

  // Single window with all projects as panes
  muxRun(mux, ["new-session", "-d", "-s", session, "-n", "work"]);
  const win = `${session}:work`;

  projects.forEach((p, i) => {
    const invoke = p.agent?.invoke || defaultInvoke;

    // First project uses the initial pane; subsequent ones split
    if (i > 0) {
      muxRun(mux, ["split-window", "-t", win, "-h"]);
      muxRun(mux, ["select-layout", "-t", win, "tiled"]);
    }

    const pane = `${win}.${i}`;

    if (p.type === "container") {
      const cn = cname(p.name);
      muxRun(mux, ["send-keys", "-t", pane, `docker exec -it ${cn} ${invoke}`, "Enter"]);
    } else if (p.type === "remote") {
      muxRun(mux, ["send-keys", "-t", pane, p.command, "Enter"]);
    } else {
      const dir = expandHome(p.path || ".");
      muxRun(mux, ["send-keys", "-t", pane, `cd "${dir}" && ${invoke}`, "Enter"]);
    }
  });

  // Final tiled layout for even distribution, then select first pane
  muxRun(mux, ["select-layout", "-t", win, "tiled"]);
  muxRun(mux, ["select-pane", "-t", `${win}.0`]);
}

// ── Subcommands ──────────────────────────────────────────────────────────────

async function runInit() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log("\n▸ s code — configuration wizard\n");

    if (await fileExists(CONFIG_PATH)) {
      const ans = await prompt(rl, "Config already exists. Overwrite? (y/N)", "n");
      if (ans.toLowerCase() !== "y") {
        console.log("  Aborted.");
        return;
      }
    }

    // ── Defaults ──
    console.log("\n── Defaults ──");
    const muxChoice = await choose(rl, "Terminal multiplexer:", [
      "auto (detect tmux/pmux)",
      "tmux",
      "pmux",
    ]);
    const muxVal = muxChoice.startsWith("auto") ? "auto" : muxChoice;
    const editor = await prompt(rl, "Editor", "vim");
    const sessionName = await prompt(rl, "Session name", "work");

    // ── Agent ──
    console.log("\n── Agent ──");
    const agentInstall = await prompt(rl, "Install command (empty = skip)", "");
    const agentInvoke = await prompt(rl, "Invoke command", "copilot");

    // ── Projects ──
    console.log("\n── Projects ──");
    console.log("  Add projects. Enter empty name to finish.\n");
    const projects = [];

    while (true) {
      const name = await prompt(rl, "Project name (empty = done)", "");
      if (!name) break;

      const typeLabel = await choose(rl, "Type:", [
        "container — isolated Docker environment",
        "local — open directly on host",
        "remote — arbitrary command (e.g. gh codespace ssh -- copilot)",
      ]);
      const type = typeLabel.split(" —")[0];
      const project = { name, type };

      if (type === "container") {
        project.image = await prompt(rl, "Docker image", "node:22-bookworm");
        const repo = await prompt(rl, "Git repo URL (empty = skip)", "");
        if (repo) project.repo = repo;
        const hostPath = await prompt(rl, "Host path to bind-mount instead of volume (empty = use volume)", "");
        if (hostPath) project.path = hostPath;
        const setup = await prompt(rl, "Setup command (e.g. npm ci, empty = skip)", "");
        if (setup) project.setup = setup;
      } else if (type === "local") {
        project.path = await prompt(rl, "Project path", "");
      } else {
        project.command = await prompt(rl, "Command", "");
      }

      projects.push(project);
      console.log(`  ✓ Added ${name}\n`);
    }

    const config = {
      defaults: {
        multiplexer: muxVal,
        editor,
        sessionName,
        agent: {
          ...(agentInstall ? { install: agentInstall } : {}),
          invoke: agentInvoke,
        },
      },
      projects,
    };

    await saveConfig(config);
    console.log(`\n✓ Saved to ${CONFIG_PATH}`);
    console.log(`  Edit anytime: s code --edit`);
    console.log(`  Launch:       s code\n`);
  } finally {
    rl.close();
  }
}

async function runEdit(config) {
  const editor = config?.defaults?.editor || process.env.EDITOR || "vim";

  if (!(await fileExists(CONFIG_PATH))) {
    console.log("  No config found — creating default...\n");
    await saveConfig(DEFAULT_CONFIG);
  }

  spawnSync(editor, [CONFIG_PATH], { stdio: "inherit" });
}

async function runStop(config) {
  const mux = detectMux(config?.defaults?.multiplexer);
  const session = config?.defaults?.sessionName || "work";

  if (mux && sessionUp(mux, session)) {
    spawnSync(mux, ["kill-session", "-t", session], { stdio: "ignore" });
    console.log(`  ✓  Killed ${mux} session "${session}"`);
  } else {
    console.log(`  ·  No active session "${session}"`);
  }

  const containers = (config?.projects || [])
    .filter((p) => p.type === "container")
    .map((p) => cname(p.name));

  for (const cn of containers) {
    if (isRunning(cn)) {
      console.log(`  ▸  Stopping ${cn}...`);
      execSync(`docker stop ${cn}`, { stdio: "ignore", timeout: 30_000 });
      console.log(`  ✓  ${cn} stopped (volume preserved)`);
    }
  }

  if (!containers.length) console.log("  ·  No containers configured");
  console.log();
}

function printHelp() {
  console.log(`
Usage: s code [flags]

  Launch a daily workspace with tmux/pmux sessions for your projects.

Flags:
  (none)         Launch all projects
  --select       Interactively pick which projects to launch
  --init,  -i    Interactive configuration wizard
  --edit,  -e    Open config in editor
  --stop,  -s    Stop containers and kill session
  --help,  -h    Show this help

Config: ${CONFIG_PATH}

Project types:
  container   Runs in a Docker container (Linux containers via WSL on Windows).
              Persistence: named Docker volumes survive container stop/remove.
              Use "path" to bind-mount a host directory instead.
              Fields: image, repo, path, setup, env, volumes, platform

  local       Opens directly on the host filesystem (e.g. Visual Studio projects).
              Fields: path

  remote      Runs an arbitrary command (e.g. "gh codespace ssh -- copilot").
              You control the full command, including any agent invocation.
              Fields: command

All projects open as tiled panes in a single window, each running
the AI coding agent (configurable via defaults.agent.invoke). Use
the agent's built-in shell support for running commands directly.

Per-project agent override: set "agent": { "invoke": "..." } on any project.

VS Code + containers:
  Attach via Dev Containers extension (Ctrl+Shift+P → "Attach to Running Container")
`);
}

async function runWork(selectMode = false) {
  const config = await loadConfig();

  if (!config) {
    console.log("  No config found. Run: s code --init\n");
    process.exit(1);
  }
  if (!config.projects?.length) {
    console.log("  No projects configured. Run: s code --edit\n");
    process.exit(1);
  }

  const mux = detectMux(config.defaults?.multiplexer);
  if (!mux) {
    console.log("  ✗ No multiplexer found. Install tmux or pmux.\n");
    process.exit(1);
  }

  const session = config.defaults?.sessionName || "work";
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    // Existing session — offer to re-attach
    if (sessionUp(mux, session)) {
      const ans = await prompt(rl, `Session "${session}" exists. Attach? (Y/n)`, "y");
      if (ans.toLowerCase() !== "n") {
        rl.close();
        spawnSync(mux, ["attach", "-t", session], { stdio: "inherit" });
        return;
      }
      spawnSync(mux, ["kill-session", "-t", session], { stdio: "ignore" });
    }

    // Select projects
    let selected;
    if (selectMode) {
      console.log("\nProjects:\n");
      config.projects.forEach((p, i) => {
        const info =
          p.type === "container"
            ? `container: ${p.image || "node:22-bookworm"}`
            : p.type === "remote"
              ? `remote: ${p.command}`
              : `local: ${p.path || "."}`;
        console.log(`  ${i + 1}. ${p.name} (${info})`);
      });

      const sel = await prompt(rl, "\nSelect projects (e.g. 1,3 or all)", "all");
      if (sel.toLowerCase() === "all") {
        selected = [...config.projects];
      } else {
        const nums = sel
          .split(",")
          .map((s) => parseInt(s.trim(), 10) - 1);
        selected = nums
          .filter((i) => i >= 0 && i < config.projects.length)
          .map((i) => config.projects[i]);
      }

      if (!selected.length) {
        console.log("  No projects selected.");
        return;
      }
    } else {
      selected = [...config.projects];
    }

    rl.close();

    // Start containers
    const containers = selected.filter((p) => p.type === "container");
    if (containers.length) {
      try {
        run("docker info", { timeout: 10_000 });
      } catch {
        console.log("  ✗ Docker is not running. Start Docker and try again.\n");
        process.exit(1);
      }

      console.log("\n▸ Containers\n");
      let failures = 0;
      for (const p of containers) {
        if (!ensureContainer(p, config)) failures++;
      }
      if (failures) {
        console.log(`\n  ⚠ ${failures} container(s) failed — they will be skipped.`);
        selected = selected.filter(
          (p) => p.type !== "container" || isRunning(cname(p.name)),
        );
        if (!selected.length) {
          console.log("  No projects remaining.");
          return;
        }
      }
    }

    // Build and attach session
    console.log(`\n▸ Creating ${mux} session "${session}"...\n`);
    buildSession(mux, session, selected, config);
    spawnSync(mux, ["attach", "-t", session], { stdio: "inherit" });
  } finally {
    // Ensure rl is closed even on unexpected exit
    try {
      rl.close();
    } catch {}
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

export default async function main(args = []) {
  const has = (...flags) => flags.some((f) => args.includes(f));

  if (has("--help", "-h", "help")) return printHelp();
  if (has("--init", "-i", "init")) return runInit();

  const config = await loadConfig();
  if (has("--edit", "-e", "edit")) return runEdit(config);
  if (has("--stop", "-s", "stop")) return runStop(config);

  return runWork(has("--select"));
}
