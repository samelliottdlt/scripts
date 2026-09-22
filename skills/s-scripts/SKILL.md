---
name: s-scripts
description: >-
  Sam's personal `s` command and its public scripts repo (github.com/samelliottdlt/scripts).
  Use when running an `s <script>` utility, or when the user wants a new reusable
  script, CLI helper, installer, or agent skill that should work across machines. New generic
  utilities belong in this repo as `s` scripts.
---

# `s`: personal scripts repo

`s` is a small Node CLI. `s <name> [args]` runs `scripts/<name>.mjs` from a local clone of
**github.com/samelliottdlt/scripts**. Running `s` with no arguments lists every script and
its description.

- Find the clone with `s which`. It's usually `~/.s`, or wherever `S_DIR` points.
- Update it with `s update`. That pulls, re-links, and reinstalls the repo's skills.
- Check it against the remote with `s status`.

Before writing a one-off script somewhere else, run `s` to see whether a script already
does the job.

## ⚠ This repo is PUBLIC

Only **generic, reusable utilities** go here. Never commit:

- Work or employer material: internal hostnames, URLs, repo names, project or team names,
  ticket IDs, or internal tooling details.
- Secrets, tokens, credentials, or API keys, including in examples and test fixtures.
- Personal data: email addresses, phone numbers, physical addresses, account IDs, or
  machine-specific paths such as `C:\Users\<name>`. Use `homedir()` or `~`.
- Third-party binaries or vendor-licensed files. Download them at install time instead.
  For example, `s dd-cli` pulls DoorDash's binary and `SKILL.md` from the user's release tarball.

Anything machine- or work-specific belongs in local, untracked config such as
`~/.config/s/<script>.json`, which the script reads at runtime. It never goes in the repo.
If you're unsure whether something is generic, ask the user before committing it.
Review `git diff --staged` for leaks before every commit.

## Adding a script

Create `scripts/<name>.mjs`. The file name becomes the command name, so use kebab-case.

```js
export const description = "One line shown in `s` usage";

export default async function main(args) {
  // args = everything after `s <name>`
}
```

Conventions:

- Use Node ≥18 built-ins only (`node:fs`, `node:child_process`, …). Keep `package.json`
  dependency-free unless a dependency is truly necessary.
- ES modules, 2-space indent, double quotes. Use `spawnSync` with an argv array rather than
  shell strings when arguments come from the user.
- Support Windows (`win32`), macOS and Linux, or fail with a clear message. Build paths
  with `join(homedir(), …)`.
- Make scripts idempotent, since re-running `install`-style scripts must be safe. Put a
  read-only `check` subcommand next to anything that changes the machine.
- Put shared helpers in `lib/*.mjs`. `bin/s.mjs` only lists `scripts/`.
- If a tool needs a command on PATH (like `dd-cli`), add a shim in `bin/` and register it
  under `package.json` `bin`. `npm link` then exposes it.
- Add a short section for each new script under **Scripts** in `README.md`.

## Agent skills

- **Repo-owned skills:** `skills/<name>/SKILL.md`. `s skills install` copies every one of
  them to `~/.copilot/skills/<name>/` and `~/.claude/skills/<name>/`, and `s skills check`
  reports drift. Edit the copy in the repo and reinstall. Never edit the installed copies.
- **Vendor skills** that ship with a tool: don't commit the vendor's `SKILL.md`. Commit
  only local overlay notes, such as `skills/dd-cli-usage/windows-notes.md`. The tool's
  installer script combines them using `installSkill()` from `lib/skills.mjs`.
- This skill is `skills/s-scripts/SKILL.md`. Update it when the repo's conventions change.

## Testing and shipping

- Run from the clone without relinking: `node bin/s.mjs <name> [args]`.
  `npm run dev -- <name>` also works on macOS and Linux.
- Test on the current OS, and reason through the other platforms' branches.
- Work on a branch, commit, and open a PR against `main`. Don't push straight to `main`
  unless the user asks.
