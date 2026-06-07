#!/bin/bash
# =============================================================================
# Local Development Startup Script — Report Template Engine (Frontend)
# =============================================================================
# Starts the Angular dev server with a proxy to the backend API.
#
#   Proxy: /api  →  http://127.0.0.1:8101  (Spring Boot backend)
#   Dev server:      http://localhost:4200
#
# Run from anywhere:
#   ./scripts/dev.sh
#
# Prerequisites: Node.js 18+, npm
# Make sure the backend is already running on port 8101 before starting this.
# =============================================================================

set -e

# Resolve paths relative to this script, regardless of CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Preflight checks ──────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || error "Node.js 18+ is not installed or not on PATH."
command -v npm  >/dev/null 2>&1 || error "npm is not installed or not on PATH."

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Report Template Engine — Frontend Dev    ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

cd "$PROJECT_ROOT"

# ── Step 1: Install dependencies if node_modules is missing ───────────────────
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  info "node_modules not found — running npm install..."
  npm install
  success "Dependencies installed."
else
  info "node_modules already present. Skipping npm install."
  info "  (Run 'npm install' manually if you want to refresh packages.)"
fi

# ── Step 2: Check backend reachability (non-blocking warning) ─────────────────
echo ""
if curl -sf --max-time 3 http://127.0.0.1:8101/actuator/health >/dev/null 2>&1; then
  success "Backend API detected on http://127.0.0.1:8101"
else
  warn "Backend API not reachable on port 8101."
  warn "Start the backend first (scripts/dev.sh in ReportTemplate_BackEnd)."
  warn "The Angular dev server will still start; API calls will fail until the backend is up."
fi

# ── Step 3: Start Angular dev server ─────────────────────────────────────────
echo ""
info "Starting Angular dev server on http://localhost:4200"
info "  API proxy:  /api  →  http://127.0.0.1:8101"
echo -e "${YELLOW}  (Press Ctrl+C to stop)${NC}"
echo ""

npm start
