#!/bin/sh
# ============================================================================
# VibeSHell Bridge — Installation Script (Proot-based, Termux-free)
#
# Bu script VibeSHell bridge sunucusunu proot ile Debian rootfs içinde kurar.
# Termux gerektirmez — herhangi bir Linux veya Android terminalinde çalışabilir.
#
# Adımlar:
#   1. Proot binary'sini indirir (yoksa)
#   2. Debian rootfs oluşturur (yoksa)
#   3. Node.js ve git kurar
#   4. Bridge kodunu rootfs'e kopyalar
#   5. Auth token oluşturur
#   6. Startup scriptleri oluşturur
#
# Kullanım:
#   chmod +x install.sh && ./install.sh
#
# Notlar:
#   - Android'de foreground service için React Native tarafında
#     ProotModule ve BridgeForegroundService zaten mevcut.
#   - Bu script sadece proot ortamını hazırlar.
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

  log_info "Paket çıkarılıyor..."
  cd "$tmpdir"
  ar x proot.deb 2>/dev/null || true

  if [ -f data.tar.xz ]; then
    tar xf data.tar.xz --wildcards '*/bin/proot' '*/libexec/proot/loader' 2>/dev/null || \
    tar xf data.tar.xz 2>/dev/null || true

    find . -name "proot" -type f -not -name "*.deb" -not -name "data.tar*" -not -name "control.tar*" | while read f; do
      cp "$f" "$proot_bin"
      chmod +x "$proot_bin"
    done

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
  if [ -d "$ROOTFS_DIR" ] && [ -f "$ROOTFS_DIR/bin/sh" ]; then
    log_warn "Rootfs zaten mevcut ve kurulu: $ROOTFS_DIR"
    return 0
  fi

  log_info "Alpine rootfs oluşturuluyor..."

  local tmpdir
  tmpdir=$(mktemp -d)

  log_info "Alpine rootfs indiriliyor (~3.8MB)..."
  curl -sL "$ALPINE_ROOTFS_URL" -o "${tmpdir}/alpine.tar.gz"

  log_info "Rootfs çıkarılıyor..."
  mkdir -p "$ROOTFS_DIR"
  tar -xzf "${tmpdir}/alpine.tar.gz" -C "$ROOTFS_DIR"

  mkdir -p "$ROOTFS_DIR"/{dev,proc,sys,tmp,root/bridge}
  chmod 1777 "$ROOTFS_DIR/tmp"

  rm -rf "$tmpdir"

  log_success "Alpine rootfs hazır: $ROOTFS_DIR"
}

# ---------------------------------------------------------------------------
# Adım 3: Node.js ve git kur (Alpine apk ile)
# ---------------------------------------------------------------------------
install_packages() {
  log_info "Proot ortamında Node.js ve git kuruluyor..."

  local proot_bin="${PROOT_DIR}/proot"

  $proot_bin \
    --kill-on-exit \
    -S "$ROOTFS_DIR" \
    /bin/sh -c '
      export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
      apk update --quiet
      apk add --quiet curl git nodejs npm

      echo "--- Kurulum Sonuçları ---"
      node --version 2>/dev/null || echo "node: YOK"
      npm --version 2>/dev/null || echo "npm: YOK"
      git --version 2>/dev/null || echo "git: YOK"
  '

  log_success "Node.js ve git kuruldu."
}

# ---------------------------------------------------------------------------
# Adım 4: Bridge kodunu kopyala
# ---------------------------------------------------------------------------
setup_bridge() {
  log_info "Bridge kodu kopyalanıyor..."

  local bridge_dest="${ROOTFS_DIR}/root/bridge"
  mkdir -p "$bridge_dest"

  # Bridge dosyalarını kopyala
  if [ -f "${BRIDGE_DIR}/server.js" ]; then
    cp "${BRIDGE_DIR}/server.js" "$bridge_dest/"
    cp "${BRIDGE_DIR}/package.json" "$bridge_dest/"
  else
    log_info "Bridge dosyaları GitHub'dan indiriliyor..."
    mkdir -p "$BRIDGE_DIR"
    curl -sL "$REPO_RAW/server.js" -o "$bridge_dest/server.js"
    curl -sL "$REPO_RAW/package.json" -o "$bridge_dest/package.json"
  fi

  # npm bağımlılıklarını kur
  local proot_bin="${PROOT_DIR}/proot"
  if [ -f "$proot_bin" ] && [ -f "$bridge_dest/package.json" ]; then
    log_info "npm bağımlılıkları kuruluyor..."
    $proot_bin \
      --kill-on-exit \
      -S "$ROOTFS_DIR" \
      /bin/sh -c "cd /root/bridge && npm install --production"
  fi

  log_success "Bridge kodu hazır: $bridge_dest"
}

# ---------------------------------------------------------------------------
# Adım 5: Auth token
# ---------------------------------------------------------------------------
setup_token() {
  if [ -f "$TOKEN_PATH" ] && [ -s "$TOKEN_PATH" ]; then
    log_warn "Auth token zaten mevcut: $TOKEN_PATH"
  else
    log_info "Auth token oluşturuluyor..."
    TOKEN=$(openssl rand -hex 32 2>/dev/null || \
            node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || \
            cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1)
    echo "$TOKEN" > "$TOKEN_PATH"
    chmod 600 "$TOKEN_PATH"
    log_success "Auth token oluşturuldu: $TOKEN_PATH"
  fi
}

# ---------------------------------------------------------------------------
# Adım 6: Scriptleri kopyala
# ---------------------------------------------------------------------------
setup_scripts() {
  log_info "Scriptler hazırlanıyor..."

  mkdir -p "$VIBESHELL_DIR"

  # start.sh, stop.sh, status.sh'yi bridge/ dizininden kopyala
  for script in start.sh stop.sh status.sh; do
    if [ -f "${BRIDGE_DIR}/${script}" ]; then
      cp "${BRIDGE_DIR}/${script}" "${VIBESHELL_DIR}/${script}"
      chmod +x "${VIBESHELL_DIR}/${script}"
    fi
  done

  log_success "Scriptler hazır: ${VIBESHELL_DIR}/{start,stop,status}.sh"
}

# ---------------------------------------------------------------------------
# Ana kurulum
# ---------------------------------------------------------------------------
main() {
  echo ""
  echo "==========================================="
  echo "  VibeSHell Bridge — Proot Installer"
  echo "  (Termux bağımsız)"
  echo "==========================================="
  echo ""

  mkdir -p "$VIBESHELL_DIR"

  install_proot
  setup_rootfs
  install_packages
  setup_bridge
  setup_token
  setup_scripts

  echo ""
  echo "==========================================="
  log_success "Kurulum tamamlandı!"
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
  log_info "Android'de foreground service ile başlatmak için:"
  log_info "  Uygulamayı açın → Bridge otomatik başlayacaktır."
  echo ""
}

main "$@"
