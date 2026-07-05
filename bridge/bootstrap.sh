#!/bin/sh
# ============================================================================
# VibeSHell Bridge — Proot Bootstrap Script
#
# Termux bağımlılığı olmadan proot ile Debian rootfs kurulumu yapar.
# Bu script Termux, Linux veya macOS'ta çalışabilir.
#
# Adımlar:
#   1. Proot binary'sini indirir
#   2. Debian minimal rootfs oluşturur
#   3. Node.js ve git kurar
#   4. Bridge kodunu rootfs'e kopyalar
#   5. Auth token oluşturur
#   6. start.sh ve stop.sh scriptleri oluşturur
#
# Kullanım:
#   chmod +x bootstrap.sh && ./bootstrap.sh
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Sabitler
# ---------------------------------------------------------------------------
VIBESHELL_DIR="${HOME}/.vibeshell"
BRIDGE_DIR="${VIBESHELL_DIR}/bridge"
PROOT_DIR="${VIBESHELL_DIR}/proot"
ROOTFS_DIR="${VIBESHELL_DIR}/rootfs"
TOKEN_PATH="${HOME}/.vibeshell-token"
NODE_VERSION="22"
# Termux proot paketi (aarch64, Android uyumlu)
PROOT_DEB_URL="https://packages.termux.org/apt/termux-main/pool/main/p/proot/proot_5.1.107.82_aarch64.deb"

# Alpine Linux minirootfs (aarch64, ~3.8MB)
ALPINE_ROOTFS_URL="https://dl-cdn.alpinelinux.org/alpine/v3.21/releases/aarch64/alpine-minirootfs-3.21.3-aarch64.tar.gz"

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------
log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# Mimari tespiti
detect_arch() {
  local arch
  arch=$(uname -m)
  case "$arch" in
    aarch64|arm64) echo "aarch64" ;;
    armv7*|armhf)  echo "arm" ;;
    x86_64)        echo "x86_64" ;;
    i*86)          echo "i686" ;;
    *)
      log_error "Desteklenmeyen mimari: $arch"
      exit 1
      ;;
  esac
}

# OS tespiti
detect_os() {
  local os
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$os" in
    linux)  echo "linux" ;;
    darwin) echo "darwin" ;;
    *)
      log_error "Desteklenmeyen işletim sistemi: $os"
      exit 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Adım 1: Proot binary'sini Termux paketinden indir
# ---------------------------------------------------------------------------
install_proot() {
  log_info "Proot kuruluyor..."

  mkdir -p "$PROOT_DIR"

  local proot_bin="${PROOT_DIR}/proot"
  local loader_bin="${PROOT_DIR}/loader"

  if [ -f "$proot_bin" ] && [ -f "$loader_bin" ]; then
    log_warn "Proot zaten mevcut: $proot_bin"
    return 0
  fi

  local tmpdir
  tmpdir=$(mktemp -d)

  log_info "Termux proot paketi indiriliyor..."
  curl -sL "$PROOT_DEB_URL" -o "${tmpdir}/proot.deb"

  # Deb'den data.tar.xz'i çıkar
  log_info "Paket çıkarılıyor..."
  cd "$tmpdir"
  ar x proot.deb 2>/dev/null || {
    # ar yoksa dd ile header atla
    dd if=proot.deb bs=64 skip=1 of=data.tar.xz 2>/dev/null
  }

  if [ -f data.tar.xz ]; then
    # data.tar.xz'den proot ve loader'ı çıkar
    tar xf data.tar.xz --wildcards '*/bin/proot' '*/libexec/proot/loader' 2>/dev/null || \
    tar xf data.tar.xz 2>/dev/null || true

    # Proot binary'yi bul ve kopyala
    find . -name "proot" -type f -not -name "*.deb" -not -name "data.tar*" -not -name "control.tar*" | while read f; do
      cp "$f" "$proot_bin"
      chmod +x "$proot_bin"
    done

    # Loader binary'yi bul ve kopyala
    find . -name "loader" -type f | while read f; do
      cp "$f" "$loader_bin"
      chmod +x "$loader_bin"
    done
  fi

  cd - > /dev/null
  rm -rf "$tmpdir"

  if [ -f "$proot_bin" ] && [ -f "$loader_bin" ]; then
    log_success "Proot kuruldu: $proot_bin + $loader_bin"
  else
    log_error "Proot kurulamadı!"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Adım 2: Alpine rootfs indir ve çıkar
# ---------------------------------------------------------------------------
setup_rootfs() {
  log_info "Alpine rootfs oluşturuluyor..."

  if [ -d "$ROOTFS_DIR" ] && [ -f "$ROOTFS_DIR/bin/sh" ]; then
    log_warn "Rootfs zaten mevcut: $ROOTFS_DIR"
    return 0
  fi

  local tmpdir
  tmpdir=$(mktemp -d)

  log_info "Alpine rootfs indiriliyor (~3.8MB)..."
  curl -sL "$ALPINE_ROOTFS_URL" -o "${tmpdir}/alpine.tar.gz"

  log_info "Rootfs çıkarılıyor..."
  mkdir -p "$ROOTFS_DIR"
  tar -xzf "${tmpdir}/alpine.tar.gz" -C "$ROOTFS_DIR"

  # Gerekli dizinleri oluştur
  mkdir -p "$ROOTFS_DIR"/{dev,proc,sys,tmp,root/bridge}
  chmod 1777 "$ROOTFS_DIR/tmp"

  rm -rf "$tmpdir"

  log_success "Alpine rootfs hazır: $ROOTFS_DIR"
}

# ---------------------------------------------------------------------------
# Adım 3: Node.js ve git kur (proot içinde — Alpine apk ile)
# ---------------------------------------------------------------------------
install_node_in_proot() {
  log_info "Proot ortamında Node.js kuruluyor..."

  local proot_bin="${PROOT_DIR}/proot"
  local loader_bin="${PROOT_DIR}/loader"

  if [ ! -f "$proot_bin" ]; then
    log_error "Proot binary bulunamadı: $proot_bin"
    return 1
  fi

  # Proot ile Alpine'de paket kur
  $proot_bin \
    --kill-on-exit \
    -S "$ROOTFS_DIR" \
    /bin/sh -c '
      export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

      # apk güncelle ve curl + git + nodejs kur
      apk update --quiet
      apk add --quiet curl git nodejs npm

      # Versiyonları kontrol et
      echo "--- Kurulum Sonuçları ---"
      node --version 2>/dev/null || echo "node: YOK"
      npm --version 2>/dev/null || echo "npm: YOK"
      git --version 2>/dev/null || echo "git: YOK"
  ' || {
    log_warn "Proot içinde kurulum başarısız oldu"
    return 1
  }

  log_success "Node.js ve git kuruldu."
}

# ---------------------------------------------------------------------------
# Adım 4: Bridge kodunu rootfs'e kopyala
# ---------------------------------------------------------------------------
setup_bridge() {
  log_info "Bridge kodu rootfs'e kopyalanıyor..."

  local bridge_dest="${ROOTFS_DIR}/root/bridge"
  mkdir -p "$bridge_dest"

  # Bridge dosyalarını kopyala
  if [ -f "${BRIDGE_DIR}/server.js" ]; then
    cp "${BRIDGE_DIR}/server.js" "$bridge_dest/"
    cp "${BRIDGE_DIR}/package.json" "$bridge_dest/"
  else
    # GitHub'dan indir
    log_info "Bridge dosyaları GitHub'dan indiriliyor..."
    local repo_raw="https://raw.githubusercontent.com/toprakpt1/vibeshell/master/bridge"
    curl -sL "$repo_raw/server.js" -o "$bridge_dest/server.js"
    curl -sL "$repo_raw/package.json" -o "$bridge_dest/package.json"
  fi

  # npm bağımlılıklarını kur (proot içinde)
  local proot_bin="${PROOT_DIR}/proot"
  if [ -f "$proot_bin" ] && [ -f "$bridge_dest/package.json" ]; then
    $proot_bin \
      --kill-on-exit \
      -S "$ROOTFS_DIR" \
      /bin/sh -c "cd /root/bridge && npm install --production" 2>/dev/null || {
        log_warn "npm install başarısız, manuel bağımlılıklar kontrol edilecek"
      }
  fi

  log_success "Bridge kodu kopyalandı: $bridge_dest"
}

# ---------------------------------------------------------------------------
# Adım 5: Auth token oluştur
# ---------------------------------------------------------------------------
setup_token() {
  if [ -f "$TOKEN_PATH" ] && [ -s "$TOKEN_PATH" ]; then
    log_warn "Auth token zaten mevcut: $TOKEN_PATH"
  else
    log_info "Auth token oluşturuluyor..."

    # Node.js varsa onunla, yoksa openssl ile
    if command -v node >/dev/null 2>&1; then
      TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    elif command -v openssl >/dev/null 2>&1; then
      TOKEN=$(openssl rand -hex 32)
    else
      # Fallback: /dev/urandom
      TOKEN=$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1)
    fi

    echo "$TOKEN" > "$TOKEN_PATH"
    chmod 600 "$TOKEN_PATH"
    log_success "Auth token oluşturuldu: $TOKEN_PATH"
  fi
}

# ---------------------------------------------------------------------------
# Adım 6: start.sh ve stop.sh oluştur
# ---------------------------------------------------------------------------
setup_scripts() {
  log_info "Scriptler oluşturuluyor..."

  # start.sh
  cat > "${VIBESHELL_DIR}/start.sh" << 'STARTEOF'
#!/bin/sh
# VibeSHell Bridge — Start Script (Proot + Alpine)
set -euo pipefail

VIBESHELL_DIR="${HOME}/.vibeshell"
PROOT_BIN="${VIBESHELL_DIR}/proot/proot"
LOADER_BIN="${VIBESHELL_DIR}/proot/loader"
ROOTFS_DIR="${VIBESHELL_DIR}/rootfs"
PID_FILE="${VIBESHELL_DIR}/bridge.pid"

# Zaten çalışıyor mu?
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[WARN] Bridge zaten çalışıyor (PID: $OLD_PID)"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

echo "[INFO] Bridge başlatılıyor..."

# Proot ile bridge'i başlat
nohup "$PROOT_BIN" \
  --kill-on-exit \
  -S "$ROOTFS_DIR" \
  /usr/bin/node /root/bridge/server.js \
  > "${VIBESHELL_DIR}/bridge.log" 2>&1 &

echo $! > "$PID_FILE"
echo "[OK] Bridge başlatıldı (PID: $(cat "$PID_FILE"))"
STARTEOF
  chmod +x "${VIBESHELL_DIR}/start.sh"

  # stop.sh
  cat > "${VIBESHELL_DIR}/stop.sh" << 'STOPEOF'
#!/bin/sh
# VibeSHell Bridge — Stop Script
set -euo pipefail

VIBESHELL_DIR="${HOME}/.vibeshell"
PID_FILE="${VIBESHELL_DIR}/bridge.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "[WARN] Bridge PID dosyası bulunamadı"
  # Yine de tüm proot process'lerini öldür
  pkill -f "proot.*server.js" 2>/dev/null || true
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  echo "[INFO] Bridge durduruluyor (PID: $PID)..."
  kill "$PID"
  sleep 1

  # Hâlâ yaşıyor mu?
  if kill -0 "$PID" 2>/dev/null; then
    echo "[WARN] Force killing..."
    kill -9 "$PID"
  fi

  rm -f "$PID_FILE"
  echo "[OK] Bridge durduruldu."
else
  echo "[WARN] Process zaten ölmüş (PID: $PID)"
  rm -f "$PID_FILE"
fi
STOPEOF
  chmod +x "${VIBESHELL_DIR}/stop.sh"

  # status.sh
  cat > "${VIBESHELL_DIR}/status.sh" << 'STATUSEOF'
#!/bin/sh
# VibeSHell Bridge — Status Script
VIBESHELL_DIR="${HOME}/.vibeshell"
PID_FILE="${VIBESHELL_DIR}/bridge.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "[OK] Bridge çalışıyor (PID: $PID)"
    echo "     Logs: ${VIBESHELL_DIR}/bridge.log"
    exit 0
  fi
fi

echo "[STOPPED] Bridge çalışmıyor"
exit 1
STATUSEOF
  chmod +x "${VIBESHELL_DIR}/status.sh"

  log_success "Scriptler oluşturuldu."
}

# ---------------------------------------------------------------------------
# Ana kurulum
# ---------------------------------------------------------------------------
main() {
  echo ""
  echo "==========================================="
  echo "  VibeSHell Bridge — Proot Bootstrap"
  echo "==========================================="
  echo ""

  mkdir -p "$VIBESHELL_DIR"

  install_proot
  setup_rootfs
  install_node_in_proot
  setup_bridge
  setup_token
  setup_scripts

  echo ""
  echo "==========================================="
  log_success "Bootstrap tamamlandı!"
  echo "==========================================="
  echo ""
  log_info "Dizinler:"
  log_info "  Proot:    ${PROOT_DIR}"
  log_info "  Rootfs:   ${ROOTFS_DIR}"
  log_info "  Bridge:   ${ROOTFS_DIR}/root/bridge"
  log_info "  Token:    ${TOKEN_PATH}"
  echo ""
  log_info "Kullanım:"
  log_info "  Başlat:   ${VIBESHELL_DIR}/start.sh"
  log_info "  Durdur:   ${VIBESHELL_DIR}/stop.sh"
  log_info "  Durum:    ${VIBESHELL_DIR}/status.sh"
  log_info "  Log:      ${VIBESHELL_DIR}/bridge.log"
  echo ""
  log_info "Auth token:"
  echo -e "  ${GREEN}$(cat "$TOKEN_PATH")${NC}"
  echo ""
}

main "$@"
