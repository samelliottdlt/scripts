#!/usr/bin/env bash
# Install the s command.
#
#   curl -fsSL https://raw.githubusercontent.com/samelliottdlt/scripts/main/install.sh | bash
#
# Env vars:
#   S_DIR  — where to clone the repo (default: ~/.s)
set -euo pipefail

REPO="https://github.com/samelliottdlt/scripts.git"
S_DIR="${S_DIR:-$HOME/.s}"

# ── preflight ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required (>=18). Install it first:"
  echo "  https://nodejs.org  or  brew install node  or  nvm install --lts"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js >=18 required (found v$(node -v))"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "Error: npm is required but not found."
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo "Error: git is required but not found."
  exit 1
fi

# ── clone or update ──────────────────────────────────────────────────────────
if [ -d "$S_DIR/.git" ]; then
  echo "Updating $S_DIR ..."
  git -C "$S_DIR" pull --ff-only --quiet 2>/dev/null || echo "  (pull skipped — using local copy)"
else
  echo "Cloning into $S_DIR ..."
  git clone --quiet "$REPO" "$S_DIR"
fi

# ── install deps + link ───────────────────────────────────────────────────────
cd "$S_DIR"

if [ -f package-lock.json ]; then
  npm ci --silent
else
  npm i --silent
fi

npm link --force --silent 2>/dev/null || npm link --force

echo ""
echo "✓ Installed! Run: s hello-world"
echo "  Scripts live in $S_DIR/scripts/"
