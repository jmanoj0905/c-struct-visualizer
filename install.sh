#!/usr/bin/env bash
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No colour

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
err()   { echo -e "${RED}[error]${NC} $*"; }

# ── Locate project root (same dir as this script) ───────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  C Struct Visualizer — Install${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ── 1. Check for Node.js / npm ──────────────────────────────────────────────
info "Checking for Node.js..."
if command -v node &>/dev/null; then
    NODE_VER="$(node -v)"
    ok "Node.js ${NODE_VER} found"
else
    err "Node.js is not installed."
    echo "    Install it from https://nodejs.org (v18+ recommended)"
    exit 1
fi

if command -v npm &>/dev/null; then
    ok "npm $(npm -v) found"
else
    err "npm is not installed."
    exit 1
fi

# ── 2. Check for Docker ─────────────────────────────────────────────────────
info "Checking for Docker..."
if command -v docker &>/dev/null; then
    ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') found"
else
    err "Docker is not installed."
    echo ""
    case "$(uname -s)" in
        Darwin)
            echo "    Install Docker Desktop for Mac:"
            echo "    https://docs.docker.com/desktop/install/mac-install/"
            echo ""
            if command -v brew &>/dev/null; then
                echo "    Or via Homebrew:"
                echo "      brew install --cask docker"
            fi
            ;;
        Linux)
            echo "    Install Docker Engine:"
            echo "    https://docs.docker.com/engine/install/"
            echo ""
            echo "    Quick install (Ubuntu/Debian):"
            echo "      curl -fsSL https://get.docker.com | sh"
            echo "      sudo usermod -aG docker \$USER"
            ;;
        *)
            echo "    https://docs.docker.com/get-docker/"
            ;;
    esac
    exit 1
fi

# Verify Docker daemon is running
info "Checking Docker daemon..."
if docker info &>/dev/null; then
    ok "Docker daemon is running"
else
    err "Docker daemon is not running."
    case "$(uname -s)" in
        Darwin)
            echo "    Open Docker Desktop and wait for it to start."
            ;;
        Linux)
            echo "    Try: sudo systemctl start docker"
            ;;
    esac
    exit 1
fi

# ── 3. Check for docker-compose / docker compose ────────────────────────────
info "Checking for docker compose..."
if docker compose version &>/dev/null; then
    ok "docker compose (plugin) found"
elif command -v docker-compose &>/dev/null; then
    ok "docker-compose (standalone) found"
else
    err "docker compose is not available."
    echo "    It usually comes with Docker Desktop."
    echo "    https://docs.docker.com/compose/install/"
    exit 1
fi

# ── 4. Install frontend dependencies ────────────────────────────────────────
echo ""
info "Installing frontend dependencies..."
npm install
ok "Frontend dependencies installed"

# ── 5. Generate server package-lock.json if missing ─────────────────────────
if [ ! -f "$ROOT/server/package-lock.json" ]; then
    info "Generating server package-lock.json..."
    (cd "$ROOT/server" && npm install --package-lock-only)
    ok "Server lock file generated"
else
    ok "Server package-lock.json already exists"
fi

# ── 6. Ensure .env has VITE_TRACE_API_URL ────────────────────────────────────
info "Checking .env configuration..."
if [ -f "$ROOT/.env" ]; then
    if grep -q "^VITE_TRACE_API_URL=http" "$ROOT/.env"; then
        ok ".env already configured"
    elif grep -q "^VITE_TRACE_API_URL=$" "$ROOT/.env"; then
        sed -i.bak 's|^VITE_TRACE_API_URL=$|VITE_TRACE_API_URL=http://localhost:3001|' "$ROOT/.env"
        rm -f "$ROOT/.env.bak"
        ok ".env updated with trace server URL"
    else
        echo "VITE_TRACE_API_URL=http://localhost:3001" >> "$ROOT/.env"
        ok "Added trace server URL to .env"
    fi
else
    echo "VITE_TRACE_API_URL=http://localhost:3001" > "$ROOT/.env"
    ok "Created .env with trace server URL"
fi

# ── 7. Build the Docker image ────────────────────────────────────────────────
echo ""
info "Building trace server Docker image (this may take a minute)..."
if docker compose build 2>/dev/null || docker-compose build 2>/dev/null; then
    ok "Docker image built successfully"
else
    err "Docker image build failed. Check the output above."
    exit 1
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Run the project with:"
echo "    ./run.sh"
echo ""
echo "  Or manually:"
echo "    docker compose up -d    # start trace server"
echo "    npm run dev              # start frontend"
echo ""
