#!/bin/sh
# ============================================================================
# VibeSHell Bridge — Status Script
#
# Bridge sunucusunun durumunu gösterir.
#
# Kullanım:
#   ./status.sh
# ============================================================================

VIBESHELL_DIR="${HOME}/.vibeshell"
PID_FILE="${VIBESHELL_DIR}/bridge.pid"
TOKEN_PATH="${HOME}/.vibeshell-token"

echo "=== VibeSHell Bridge Status ==="
echo ""

# Proot kontrolü
if [ -f "${VIBESHELL_DIR}/proot/proot" ]; then
  echo "[OK] Proot binary:  ${VIBESHELL_DIR}/proot/proot"
else
  echo "[--] Proot binary:  Bulunamadı"
fi

# Rootfs kontrolü
if [ -d "${VIBESHELL_DIR}/rootfs" ]; then
  echo "[OK] Rootfs:        ${VIBESHELL_DIR}/rootfs"
else
  echo "[--] Rootfs:        Bulunamadı"
fi

# Bridge process
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "[OK] Bridge:       Çalışıyor (PID: $PID)"
  else
    echo "[!!] Bridge:       Ölü (PID: $PID)"
  fi
else
  echo "[--] Bridge:       Çalışmıyor"
fi

# Token
if [ -f "$TOKEN_PATH" ] && [ -s "$TOKEN_PATH" ]; then
  echo "[OK] Auth token:   Mevcut"
else
  echo "[--] Auth token:   Bulunamadı"
fi

echo ""
