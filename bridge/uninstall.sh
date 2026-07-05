#!/bin/sh
# ============================================================================
# VibeSHell Bridge — Uninstall Script
#
# VibeSHell bridge kurulumunu tamamen temizler.
#
# Kullanım:
#   chmod +x uninstall.sh && ./uninstall.sh
# ============================================================================

set -euo pipefail

VIBESHELL_DIR="${HOME}/.vibeshell"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()    { echo -e "${RED}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }

echo ""
echo "==========================================="
echo "  VibeSHell Bridge — Uninstall"
echo "==========================================="
echo ""

# Bridge'i durdur
if [ -f "${VIBESHELL_DIR}/bridge.pid" ]; then
  PID=$(cat "${VIBESHELL_DIR}/bridge.pid")
  if kill -0 "$PID" 2>/dev/null; then
    log_info "Bridge durduruluyor (PID: $PID)..."
    kill "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "${VIBESHELL_DIR}/bridge.pid"
fi

# Proot process'lerini öldür
pkill -f "proot.*server.js" 2>/dev/null || true

# Dizinleri sil
echo ""
log_info "Temizleniyor..."

if [ -d "$VIBESHELL_DIR" ]; then
  rm -rf "$VIBESHELL_DIR"
  log_success "VibeSHell dizini silindi: $VIBESHELL_DIR"
else
  log_warn "VibeSHell dizini bulunamadı: $VIBESHELL_DIR"
fi

# Token'ı sil
if [ -f "${HOME}/.vibeshell-token" ]; then
  rm -f "${HOME}/.vibeshell-token"
  log_success "Auth token silindi."
fi

echo ""
log_success "Temizlik tamamlandı!"
echo ""
