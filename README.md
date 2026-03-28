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

## How it works

- `bin/s.mjs` is a tiny Node CLI dispatcher registered via npm's `bin` field.
- `npm link` symlinks it into your global `node_modules/.bin`, making `s` available everywhere.
- Each script is an ES module in `scripts/` that exports a `default` function and an optional `description`.
- The install script clones this repo and runs `npm link` — safe to re-run to update.
