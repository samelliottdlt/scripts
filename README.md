# scripts

Personal scripts, runnable anywhere via the `s` command.

## Install

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/samelliottdlt/scripts/main/install.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/samelliottdlt/scripts/main/install.ps1 | iex
```

Installs to `~/.s` by default. Override with `S_DIR`:

```bash
S_DIR=~/Code/scripts curl -fsSL ... | bash
```

## Usage

```bash
s hello-world        # run a script
s hello-world Sam    # pass arguments
s                    # list all available scripts
```

## Adding a new script

Create a file in `scripts/` with a `.mjs` extension:

```js
// scripts/my-script.mjs
export const description = "What this script does";

export default function main(args) {
  console.log("Running my-script with", args);
}
```

Then just run it: `s my-script`

## Scripts

### `s code` — Daily workspace launcher

Opens all your projects in a tmux/pmux session with AI coding agents. Designed
for a workflow where you start the day, run one command, and every project is
ready to go with an AI assistant and a shell.

#### Prerequisites (Windows work laptop)

You need four things installed before `s code` works. Do these in order — each
step depends on the previous one.

**1. WSL 2 (Windows Subsystem for Linux)**

WSL gives you a real Linux kernel on Windows. Docker and tmux/pmux both need it.

```powershell
# Run PowerShell as Administrator
wsl --install
```

This installs Ubuntu by default. Reboot when prompted. On first launch it asks
you to create a Linux username/password.

Verify:
```powershell
wsl --version          # should show WSL 2, kernel 5.x+
```

> **ARM laptops:** WSL 2 runs natively on ARM64 Windows — no extra steps.

**2. Docker Desktop**

Docker Desktop uses WSL 2 as its backend. Containers run as Linux containers
inside WSL — no Hyper-V overhead.

1. Download from https://www.docker.com/products/docker-desktop/
2. Run the installer — select **"Use WSL 2 instead of Hyper-V"** when prompted
3. After install, open Docker Desktop → Settings → General → confirm
   **"Use the WSL 2 based engine"** is checked
4. Settings → Resources → WSL Integration → enable for your distro (Ubuntu)

Verify (from PowerShell or WSL terminal):
```bash
docker run --rm hello-world
```

> **RAM:** Docker Desktop defaults to using up to 50% of system RAM. You can
> cap it in Settings → Resources, or create `%USERPROFILE%\.wslconfig`:
> ```ini
> [wsl2]
> memory=8GB
> ```
> 8GB is comfortable for 3–4 containers with Node projects.

> **ARM laptops:** Docker Desktop supports ARM64 natively. Most official images
> (node, python, etc.) are multi-arch — they'll pull the `linux/arm64` variant
> automatically. If a project needs an x86-only image, set `"platform":
> "linux/amd64"` in the project config — Docker will emulate via QEMU (slower
> but works).

**3. pmux (or tmux)**

pmux is a Windows-native tmux alternative written in Rust. Pick one:

**Option A — pmux (recommended for Windows):**
```powershell
# Requires Rust/cargo (run: winget install Rustlang.Rustup)
cargo install pmux
```

**Option B — tmux via WSL:**
tmux comes pre-installed on most WSL distros. If not:
```bash
# Inside WSL
sudo apt install tmux
```

> `s code` auto-detects whichever is available (tries pmux first).

**4. Node.js ≥ 18**

Needed to run the `s` CLI itself.

```powershell
# Option A: winget
winget install Schniz.fnm
fnm install --lts

# Option B: direct download
# https://nodejs.org/
```

Verify:
```bash
node --version         # should be 18+
```

**5. Install `s` itself**

```powershell
irm https://raw.githubusercontent.com/samelliottdlt/scripts/main/install.ps1 | iex
```

Then configure your workspace:
```bash
s code --init
```

#### Quick start

```bash
s code --init          # interactive setup wizard
s code                 # launch workspace
s code --edit          # tweak config in your editor
s code --stop          # tear down session + stop containers
```

#### Config

Stored at `~/.config/s/work.json`. Created by `--init` or `--edit`. Example:

```jsonc
{
  "defaults": {
    "multiplexer": "auto",       // "auto" tries pmux then tmux
    "editor": "vim",             // used by --edit
    "sessionName": "work",       // tmux/pmux session name
    "agent": {
      "install": "curl ... | sh", // run inside new containers
      "invoke": "agency copilot"  // command launched in the top pane
    }
  },
  "projects": [
    {
      "name": "frontend",
      "type": "container",
      "image": "node:22-bookworm",
      "repo": "https://dev.azure.com/org/project/_git/frontend",
      "setup": "npm ci"
    },
    {
      "name": "legacy-app",
      "type": "local",
      "path": "C:\\Projects\\legacy-app"
    },
    {
      "name": "platform",
      "type": "codespace",
      "command": "gh codespace ssh"
    }
  ]
}
```

#### Project types

| Type | What it does | When to use |
|------|-------------|-------------|
| `container` | Spins up a Docker container, mounts a volume, optionally clones a repo and runs setup. Top pane execs the agent inside the container; bottom pane opens a shell inside it. | Projects with conflicting dependencies (e.g. node 20 vs 22), or when you need a clean isolated environment per project. |
| `local` | `cd`s into a host directory. Top pane runs the agent; bottom pane opens a shell. | Visual Studio projects, or anything that doesn't need isolation. |
| `codespace` | Sends a passthrough command (e.g. `gh codespace ssh`) into the top pane. Bottom pane is a local shell. | GitHub Codespaces or any remote SSH workflow. |

#### Container config fields

| Field | Default | Description |
|-------|---------|-------------|
| `image` | `node:22-bookworm` | Docker image. Use ARM-compatible images on ARM machines (most official images support multi-arch). |
| `repo` | — | Git URL cloned into `/workspace` on first run (volume mode only). Works with ADO, GitHub, etc. |
| `path` | — | Host directory to bind-mount at `/workspace` instead of a named volume. |
| `setup` | — | Shell command run inside the container after creation (e.g. `npm ci`). |
| `env` | `[]` | Environment variables passed to `docker run -e`. |
| `volumes` | `[]` | Additional volume mounts passed to `docker run -v`. |
| `platform` | — | Docker `--platform` flag (e.g. `linux/amd64` to force x86 on ARM). |
| `agent` | inherits defaults | Per-project override: `{ "install": "...", "invoke": "..." }`. |

#### Window layout

Each project gets a tmux/pmux window with a vertical split:

```
┌─────────────────────────────────┐
│                                 │
│   AI agent (top pane, 70%)      │  ← runs agent.invoke command
│                                 │
├─────────────────────────────────┤
│   Shell (bottom pane, 30%)      │  ← for manual commands, opening VS Code
└─────────────────────────────────┘
```

Switch between project windows with standard tmux/pmux keybindings
(`Ctrl+B, n` / `Ctrl+B, p` / `Ctrl+B, <number>`).

#### Session lifecycle

```
s code              →  shows project list, asks which to open today
                       starts containers if needed, creates tmux session, attaches
Ctrl+B, d           →  detach (session keeps running in background)
s code              →  re-run detects existing session, offers to re-attach
s code --stop       →  kills tmux session + stops containers (volumes preserved)
```

#### VS Code integration

For container projects, attach VS Code using the **Dev Containers** extension:

1. Install the "Dev Containers" extension in VS Code
2. `Ctrl+Shift+P` → "Dev Containers: Attach to Running Container"
3. Select the `s-work-<project>` container

#### Design decisions & tradeoffs

**Linux containers (not Windows containers).**
Windows containers use 500MB–1GB per container just for OS overhead. Linux
containers via Docker Desktop / WSL have near-zero overhead. On a 32GB machine
running 5–6 projects, this saves 3–6GB of RAM. The config schema is
container-runtime-agnostic — switching to Windows containers later only requires
changing the `image` field.

**Named Docker volumes for persistence (not bind-mounts by default).**
Named volumes (`s-work-<project>-data`) survive `docker stop` and
`docker rm`. Your work is only lost if you explicitly `docker volume rm`. This
is safer than relying on container state. Bind-mounts are available via the
`path` field when you prefer to work directly on host files.

**pmux preferred over tmux on Windows.**
Auto-detection tries pmux first (a Rust tmux implementation for Windows), then
falls back to tmux. Both use identical command syntax, so the script works
with either.

**Agent install happens once at container creation.**
The `defaults.agent.install` command runs inside the container only when it's
first created. On subsequent `s code` runs, existing containers are simply
started — no reinstall. If you need to re-provision, remove the container
(`docker rm s-work-<name>`) and re-run.

**Project selection at launch time.**
Instead of always opening everything, `s code` shows a numbered list and asks
which projects to open. This keeps things fast on days when you only need one
or two projects.

**Tilde expansion.**
Paths in config support `~` (e.g. `~/Code/myproject`). The script resolves
this to the actual home directory at runtime because shell tilde expansion
doesn't work inside quotes.

**`sleep infinity` as the container entrypoint.**
Containers run `sleep infinity` so they stay alive for `docker exec`. There's
no long-running server process — the container is just an environment.

## Development

To test scripts locally without affecting the globally linked `s`:

```bash
npm run dev -- my-script
```

## How it works

- `bin/s.mjs` is a tiny Node CLI dispatcher registered via npm's `bin` field.
- `npm link` symlinks it into your global `node_modules/.bin`, making `s` available everywhere.
- Each script is an ES module in `scripts/` that exports a `default` function and an optional `description`.
- The install script clones this repo and runs `npm link` — safe to re-run to update.
