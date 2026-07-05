#!/bin/sh
# ============================================================================
# VibeSHell Bridge — Start Script (Proot)
#
# Bridge sunucusunu proot ile Debian rootfs içinde başlatır.
# Manuel kullanım veya foreground service tarafından çağrılabilir.
#
# Kullanım:
#   ./start.sh              # Foreground'da başlat
#   ./start.sh --daemon     # Arka planda başlat (nohup)
# ============================================================================

set -euo pipefail

VIBESHELL_DIR="${HOME}/.vibeshell"
PROOT_BIN="${VIBESHELL_DIR}/proot/proot"
ROOTFS_DIR="${VIBESHELL_DIR}/rootfs"
PID_FILE="${VIBESHELL_DIR}/bridge.pid"
LOG_FILE="${VIBESHELL_DIR}/bridge.log"

# Kontroller
if [ ! -f "$PROOT_BIN" ]; then
  echo "[ERROR] Proot binary bulunamadı: $PROOT_BIN"
  echo "        Önce bootstrap.sh çalıştırın."
  exit 1
fi

if [ ! -d "$ROOTFS_DIR" ]; then
  echo "[ERROR] Rootfs bulunamadı: $ROOTFS_DIR"
  echo "        Önce bootstrap.sh çalıştırın."
  exit 1
fi

# Zaten çalışıyor mu?
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[WARN] Bridge zaten çalışıyor (PID: $OLD_PID)"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

mkdir -p "$VIBESHELL_DIR"

# Bridge komutu (Alpine + proot --kill-on-exit -S)
BRIDGE_CMD="$PROOT_BIN --kill-on-exit -S $ROOTFS_DIR /usr/bin/node /root/bridge/server.js"

if [ "${1:-}" = "--daemon" ]; then
  # Arka planda çalıştır
  nohup $BRIDGE_CMD > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "[OK] Bridge başlatıldı (PID: $(cat "$PID_FILE"))"
  echo "     Log: $LOG_FILE"
else
  # Foreground'da çalıştır
  echo "[INFO] Bridge başlatılıyor (Ctrl+C ile durdur)..."
  exec $BRIDGE_CMD
fi
