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
REPO_RAW="https://raw.githubusercontent.com/toprakpt1/vibeshell/master/bridge"

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
# Adım 1: Proot binary'sini indir
# ---------------------------------------------------------------------------
install_proot() {
  log_info "Proot kuruluyor..."

  mkdir -p "$PROOT_DIR"

  local arch proot_url
  arch=$(detect_arch)
  proot_url="https://github.com/proot-me/proot/releases/download/v5.4.0/proot-v5.4.0-${arch}-static"

  local proot_bin="${PROOT_DIR}/proot"

  if [ -f "$proot_bin" ]; then
    log_warn "Proot zaten mevcut: $proot_bin"
  else
    log_info "Proot indiriliyor: $proot_url"
    curl -sL "$proot_url" -o "$proot_bin"
    chmod +x "$proot_bin"
    log_success "Proot indirildi: $proot_bin"
  fi
}

# ---------------------------------------------------------------------------
# Adım 2: Debian rootfs
# ---------------------------------------------------------------------------
setup_rootfs() {
  if [ -d "$ROOTFS_DIR" ] && [ -f "$ROOTFS_DIR/usr/bin/node" ]; then
    log_warn "Rootfs zaten mevcut ve Node.js kurulu: $ROOTFS_DIR"
    return 0
  fi

  log_info "Debian rootfs oluşturuluyor..."

  local arch
  arch=$(detect_arch)
  local deb_arch
  case "$arch" in
    aarch64)  deb_arch="arm64" ;;
    arm)      deb_arch="armhf" ;;
    x86_64)   deb_arch="amd64" ;;
    i686)     deb_arch="i386" ;;
  esac

  # debootstrap ile rootfs oluştur (sudo gerekli)
  if command -v debootstrap >/dev/null 2>&1; then
    log_info "debootstrap ile Debian bookworm kuruluyor..."
    sudo debootstrap --arch="$deb_arch" --variant=minbase \
      --include=busybox,util-linux,procps \
      bookworm "$ROOTFS_DIR" https://deb.debian.org/debian/
  else
    log_warn "debootstrap bulunamadı"
    log_info "debootstrap kurulmaya çalışılıyor..."

    # Debian tabanlı sistemlerde debootstrap'u kur
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update -qq
      sudo apt-get install -y -qq debootstrap
      sudo debootstrap --arch="$deb_arch" --variant=minbase \
        --include=busybox,util-linux,procps \
        bookworm "$ROOTFS_DIR" https://deb.debian.org/debian/
    else
      log_error "debootstrap kurulamadı. Manuel kurulum gerekli."
      log_info "Alternatif: https://github.com/nicknisi/dotfiles/raw/main/debian-rootfs.tar.gz"
      log_info "İndirip ${ROOTFS_DIR}/ dizinine çıkarın."
      exit 1
    fi
  fi

  # Gerekli dizinleri oluştur
  mkdir -p "$ROOTFS_DIR"/{dev,proc,sys,tmp,root/bridge}
  chmod 1777 "$ROOTFS_DIR/tmp"

  log_success "Rootfs hazır: $ROOTFS_DIR"
}

# ---------------------------------------------------------------------------
# Adım 3: Node.js ve git kur
# ---------------------------------------------------------------------------
install_packages() {
  log_info "Proot ortamında Node.js ve git kuruluyor..."

  local proot_bin="${PROOT_DIR}/proot"
  local bash_bin="/bin/bash"
  [ ! -f "$ROOTFS_DIR/bin/bash" ] && bash_bin="/bin/sh"

  $proot_bin -0 -r "$ROOTFS_DIR" \
    -b /dev \
    -b /proc \
    -b /sys \
    -w /root \
    $bash_bin -c '
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -qq curl git ca-certificates gnupg 2>/dev/null

      # Node.js 22.x kur
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y -qq nodejs 2>/dev/null

      # Versiyonları kontrol et
      echo "--- Kurulum Sonuçları ---"
      node --version
      npm --version
      git --version
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
    $proot_bin -0 -r "$ROOTFS_DIR" \
      -b /dev \
      -b /proc \
      -w /root/bridge \
      /usr/bin/npm install --production
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
