# Install the s command.
#
#   irm https://raw.githubusercontent.com/samelliottdlt/scripts/main/install.ps1 | iex
#
# Env vars:
#   S_DIR  — where to clone the repo (default: ~/.s)
$ErrorActionPreference = "Stop"

$Repo = "https://github.com/samelliottdlt/scripts.git"
$SDir = if ($env:S_DIR) { $env:S_DIR } else { Join-Path $HOME ".s" }

# ── preflight ────────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is required (>=18). Install from https://nodejs.org"
    exit 1
}

$nodeMajor = [int](node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if ($nodeMajor -lt 18) {
    Write-Error "Node.js >=18 required (found $(node -v))"
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is required but not found."
    exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git is required but not found."
    exit 1
}

# ── clone or update ──────────────────────────────────────────────────────────
if (Test-Path (Join-Path $SDir ".git")) {
    Write-Host "Updating $SDir ..."
    git -C $SDir pull --ff-only --quiet
} else {
    Write-Host "Cloning into $SDir ..."
    git clone --quiet $Repo $SDir
}

# ── install deps + link ───────────────────────────────────────────────────────
Push-Location $SDir

if (Test-Path "package-lock.json") {
    npm ci --silent
} else {
    npm i --silent
}

npm link --force --silent
Pop-Location

Write-Host ""
Write-Host "Done! Run: s hello-world"
Write-Host "  Scripts live in $SDir\scripts\"
