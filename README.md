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
s                    # list all available scripts
s which              # show where the active checkout lives
s dd-cli check       # run a script, passing arguments
```

> **This repo is public.** Only generic, reusable utilities belong here. Never commit
> anything work-specific, private, or secret, or any vendor-licensed file. See
> [`skills/s-scripts/SKILL.md`](skills/s-scripts/SKILL.md) for the full rules.

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

### `s skills` — Agent skills

```bash
s skills install   # copy skills/*/SKILL.md to ~/.copilot/skills and ~/.claude/skills
s skills check     # report installed skills that are missing or out of date
```

The install scripts and `s update` run `s skills install` automatically.
`skills/s-scripts/SKILL.md` teaches agents (Copilot CLI and desktop, Claude Code) how
to use this repo and extend it. New reusable utilities should land here as `s` scripts.

### `s dd-cli` — DoorDash CLI + agent skill

```bash
s dd-cli check     # compare installed binary/skill against the newest tarball in ~/Downloads
s dd-cli install   # install or upgrade from that tarball (or pass a path)
```

Download the release tarball from the dd-cli GitHub releases page first. On Windows,
download the `linux-amd64` build. The binary and DoorDash's `SKILL.md` are never
committed here; both come from the tarball each time.

- **Windows:** the binary runs inside WSL. On ARM machines, the script installs amd64
  multiarch and `qemu-user-static` so the x86-64 build can run. It also installs `wslu`
  so `dd-cli login` can open the Windows browser via `wslview`, and `libsecret-tools` to copy
  an existing gnome-keyring sign-in (see Keyring below).
- **Shim:** `bin/dd-cli.mjs` is linked as `dd-cli` and forwards arguments to the real binary.
  On Windows it passes them to `wsl.exe`.
- **Keyring (Windows):** gnome-keyring in WSL re-locks every time the WSL VM restarts, so
  each `dd-cli` call would pop an unlock prompt. `s dd-cli install` drops
  `lib/s_file_keyring.py` next to dd-cli's bundled Python, and the shim selects it via
  `PYTHON_KEYRING_BACKEND`. The sign-in is then stored unencrypted in
  `~/.local/share/s/dd-cli/credentials.json` (mode 600) inside WSL, like `gh` or the AWS CLI
  do without a keyring, so dd-cli runs unattended. The install copies an existing
  gnome-keyring sign-in over once. Delete that file to sign out.
- **Skill:** the tarball's `SKILL.md` is used as-is, and on Windows
  `skills/dd-cli-usage/windows-notes.md` is appended. The result is written to
  `~/.copilot/skills/dd-cli-usage/` and `~/.claude/skills/dd-cli-usage/`.

## Development

To test scripts locally without affecting the globally linked `s`:

```bash
npm run dev -- my-script
```

## How it works

- `bin/s.mjs` is a tiny Node CLI dispatcher registered via npm's `bin` field.
- `npm link` symlinks it into your global `node_modules/.bin`, making `s` available everywhere.
- Each script is an ES module in `scripts/` that exports a `default` function and an optional `description`.
- Shared helpers live in `lib/`. Extra commands (such as the `dd-cli` shim) live in `bin/` and are registered in `package.json`.
- Agent skills live in `skills/<name>/SKILL.md`. `AGENTS.md` points agents working in this repo to them.
- The install script clones this repo, runs `npm link`, and installs skills. It's safe to re-run to update.
