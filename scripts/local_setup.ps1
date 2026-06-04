# =============================================================================
# Local Development Startup Script — Report Template Engine (Frontend)
# =============================================================================
# Starts the Angular dev server with a proxy to the backend API.
#
#   Proxy: /api  →  http://127.0.0.1:8101  (Spring Boot backend)
#   Dev server:      http://localhost:4200
#
# Run from anywhere:
#   .\scripts\dev.ps1
#
# Prerequisites: Node.js 18+, npm
# Make sure the backend is already running on port 8101 before starting this.
# =============================================================================

$ErrorActionPreference = "Stop"

# Resolve paths relative to this script, regardless of CWD
$ProjectRoot = Resolve-Path "$PSScriptRoot/.."

# ── Preflight checks ──────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 18+ is not installed or not on PATH."; exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed or not on PATH."; exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Report Template Engine — Frontend Dev    " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Set-Location $ProjectRoot

# ── Step 1: Install dependencies if node_modules is missing ───────────────────
$nodeModules = Join-Path $ProjectRoot "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "[INFO]  node_modules not found — running npm install..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed."; exit 1 }
    Write-Host "[OK]    Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "[INFO]  node_modules already present. Skipping npm install." -ForegroundColor Cyan
    Write-Host "        (Run 'npm install' manually if you want to refresh packages.)" -ForegroundColor Cyan
}

# ── Step 2: Check backend reachability (non-blocking warning) ─────────────────
Write-Host ""
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8101/actuator/health" `
        -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "[OK]    Backend API detected on http://127.0.0.1:8101" -ForegroundColor Green
} catch {
    Write-Host "[WARN]  Backend API not reachable on port 8101." -ForegroundColor Yellow
    Write-Host "        Start the backend first (scripts\dev.ps1 in ReportTemplate_BackEnd)." -ForegroundColor Yellow
    Write-Host "        The Angular dev server will still start; API calls will fail until the backend is up." -ForegroundColor Yellow
}

# ── Step 3: Start Angular dev server ─────────────────────────────────────────
Write-Host ""
Write-Host "[INFO]  Starting Angular dev server on http://localhost:4200" -ForegroundColor Cyan
Write-Host "        API proxy:  /api  ->  http://127.0.0.1:8101" -ForegroundColor Cyan
Write-Host "        (Press Ctrl+C to stop)" -ForegroundColor Yellow
Write-Host ""

npm start
