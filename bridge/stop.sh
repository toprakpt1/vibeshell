#!/bin/sh
# ============================================================================
# VibeSHell Bridge — Stop Script
#
# Bridge sunucusunu durdurur.
#
# Kullanım:
#   ./stop.sh
# ============================================================================

set -euo pipefail

VIBESHELL_DIR="${HOME}/.vibeshell"
PID_FILE="${VIBESHELL_DIR}/bridge.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "[WARN] PID dosyası bulunamadı: $PID_FILE"
  # Yine de tüm proot process'lerini öldür
  pkill -f "proot.*server.js" 2>/dev/null || true
  echo "[OK] Proot process'leri temizlendi."
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  echo "[INFO] Bridge durduruluyor (PID: $PID)..."
  kill "$PID"
  sleep 1

  # Hâlâ yaşıyor mu?
  if kill -0 "$PID" 2>/dev/null; then
    echo "[WARN] Graceful shutdown başarısız, force killing..."
    kill -9 "$PID"
  fi

  rm -f "$PID_FILE"
  echo "[OK] Bridge durduruldu."
else
  echo "[WARN] Process zaten ölmüş (PID: $PID)"
  rm -f "$PID_FILE"
fi
