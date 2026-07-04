#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
# VibeSHell Bridge — Termux Installation Script
#
# This script sets up the VibeSHell bridge server inside Termux:
#   1. Installs Node.js LTS and required packages
#   2. Copies the bridge server to a persistent location
#   3. Generates an auth token
#   4. Sets up termux-services for auto-start
#   5. Acquires a wake-lock to prevent Android from killing the process
#
# Usage:
#   chmod +x install.sh && ./install.sh
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Early Termux check (before using $PREFIX)
# ---------------------------------------------------------------------------
if [ ! -d "/data/data/com.termux" ]; then
  echo "[ERROR] This script must be run inside Termux."
  echo "        Install Termux from https://f-droid.org/en/packages/com.termux/"
  exit 1
fi

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BRIDGE_DIR="$HOME/.vibeshell/bridge"
TOKEN_PATH="$HOME/.vibeshell-token"
SERVICE_DIR="$PREFIX/var/service/vibeshell-bridge"
REPO_RAW="https://raw.githubusercontent.com/toprakpt1/vibeshell/master/bridge"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

check_termux() {
  : # Already checked at script startup
}

# ---------------------------------------------------------------------------
# Step 1: Install system dependencies
# ---------------------------------------------------------------------------
install_packages() {
  log_info "Updating package index..."
  pkg update -y

  log_info "Installing Node.js LTS and required packages..."
  pkg install -y nodejs-lts git termux-services termux-api

  log_success "System packages installed."
}

# ---------------------------------------------------------------------------
# Step 2: Set up bridge directory and install npm dependencies
# ---------------------------------------------------------------------------
setup_bridge() {
  log_info "Setting up bridge directory at ${BRIDGE_DIR}..."

  mkdir -p "$BRIDGE_DIR"

  # Download server files from GitHub
  curl -sL "$REPO_RAW/server.js"    -o "$BRIDGE_DIR/server.js"
  curl -sL "$REPO_RAW/package.json" -o "$BRIDGE_DIR/package.json"

  log_info "Installing npm dependencies..."
  cd "$BRIDGE_DIR"
  npm install --production

  log_success "Bridge server installed at ${BRIDGE_DIR}."
}

# ---------------------------------------------------------------------------
# Step 3: Generate authentication token
# ---------------------------------------------------------------------------
setup_token() {
  if [ -f "$TOKEN_PATH" ] && [ -s "$TOKEN_PATH" ]; then
    log_warn "Auth token already exists at ${TOKEN_PATH}, keeping it."
  else
    log_info "Generating auth token..."
    # Generate a 32-byte random hex token using Node.js
    TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "$TOKEN" > "$TOKEN_PATH"
    chmod 600 "$TOKEN_PATH"
    log_success "Auth token saved to ${TOKEN_PATH}"
  fi
}

# ---------------------------------------------------------------------------
# Step 4: Set up termux-services for auto-start
# ---------------------------------------------------------------------------
setup_service() {
  log_info "Setting up termux-services..."

  # Create the service directory structure (runit-style)
  mkdir -p "$SERVICE_DIR/log"

  # Main run script — starts the bridge server
  cat > "$SERVICE_DIR/run" << 'RUNEOF'
#!/data/data/com.termux/files/usr/bin/bash
exec 2>&1
BRIDGE_DIR="$HOME/.vibeshell/bridge"
cd "$BRIDGE_DIR"
exec node server.js
RUNEOF
  chmod +x "$SERVICE_DIR/run"

  # Log run script — captures output with svlogd
  cat > "$SERVICE_DIR/log/run" << 'LOGEOF'
#!/data/data/com.termux/files/usr/bin/bash
LOG_DIR="$HOME/.vibeshell/logs"
mkdir -p "$LOG_DIR"
exec svlogd -tt "$LOG_DIR"
LOGEOF
  chmod +x "$SERVICE_DIR/log/run"

  # Enable the service (will start on next sv-enable or boot)
  sv-enable vibeshell-bridge 2>/dev/null || true

  log_success "Service 'vibeshell-bridge' registered."
  log_info "Control with: sv start|stop|restart vibeshell-bridge"
}

# ---------------------------------------------------------------------------
# Step 5: Acquire wake-lock
# ---------------------------------------------------------------------------
setup_wakelock() {
  log_info "Acquiring Termux wake-lock to prevent process suspension..."

  # termux-wake-lock prevents Android from dozing the process
  termux-wake-lock 2>/dev/null || {
    log_warn "Could not acquire wake-lock. The bridge may be suspended by Android."
    log_warn "You can manually run: termux-wake-lock"
  }

  log_success "Wake-lock acquired."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo ""
  echo "==========================================="
  echo "  VibeSHell Bridge — Termux Installer"
  echo "==========================================="
  echo ""

  check_termux
  install_packages
  setup_bridge
  setup_token
  setup_service
  setup_wakelock

  echo ""
  echo "==========================================="
  log_success "Installation complete!"
  echo "==========================================="
  echo ""
  log_info "Bridge directory:  ${BRIDGE_DIR}"
  log_info "Auth token:        ${TOKEN_PATH}"
  log_info "Logs:              ~/.vibeshell/logs/"
  echo ""
  log_info "To start now:      sv start vibeshell-bridge"
  log_info "To check status:   sv status vibeshell-bridge"
  log_info "To view logs:      cat ~/.vibeshell/logs/current"
  echo ""
  log_info "Your auth token:"
  echo -e "  ${GREEN}$(cat "$TOKEN_PATH")${NC}"
  echo ""
}

main "$@"
