#!/usr/bin/env bash
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
err()   { echo -e "${RED}[error]${NC} $*"; }

# ── Locate project root ─────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# ── Pick docker compose command ──────────────────────────────────────────────
if docker compose version &>/dev/null; then
    DC="docker compose"
elif command -v docker-compose &>/dev/null; then
    DC="docker-compose"
else
    err "docker compose is not installed. Run ./install.sh first."
    exit 1
fi

# ── Cleanup on exit ──────────────────────────────────────────────────────────
cleanup() {
    echo ""
    info "Shutting down..."
    $DC down 2>/dev/null || true
    # Kill background vite if still running
    if [ -n "${VITE_PID:-}" ] && kill -0 "$VITE_PID" 2>/dev/null; then
        kill "$VITE_PID" 2>/dev/null || true
    fi
    ok "Stopped"
}
trap cleanup EXIT INT TERM

# ── Pre-flight checks ───────────────────────────────────────────────────────
if ! docker info &>/dev/null; then
    err "Docker daemon is not running. Start Docker Desktop and try again."
    exit 1
fi

if [ ! -d "$ROOT/node_modules" ]; then
    err "Frontend dependencies not installed. Run ./install.sh first."
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  C Struct Visualizer — Run${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ── 1. Start trace server ───────────────────────────────────────────────────
info "Starting trace server (Docker)..."
$DC up -d --build

# Wait for the server to be healthy
info "Waiting for trace server..."
RETRIES=0
MAX_RETRIES=30
until curl -sf http://localhost:3001/health >/dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
        err "Trace server failed to start after ${MAX_RETRIES}s"
        echo "    Check logs with: $DC logs"
        exit 1
    fi
    sleep 1
done
ok "Trace server is running on http://localhost:3001"

# ── 2. Start frontend dev server ────────────────────────────────────────────
echo ""
info "Starting frontend dev server..."
npx vite &
VITE_PID=$!

# Wait for vite to bind
sleep 2
if kill -0 "$VITE_PID" 2>/dev/null; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Ready!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "  Frontend:     http://localhost:5173"
    echo "  Trace server: http://localhost:3001"
    echo ""
    echo "  Press Ctrl+C to stop everything."
    echo ""
else
    err "Vite failed to start"
    exit 1
fi

# ── 3. Wait for Ctrl+C ──────────────────────────────────────────────────────
wait "$VITE_PID" 2>/dev/null || true
