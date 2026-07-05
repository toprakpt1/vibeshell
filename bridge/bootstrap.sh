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
# Adım 1: Proot binary'sini indir
# ---------------------------------------------------------------------------
install_proot() {
  log_info "Proot kuruluyor..."

  mkdir -p "$PROOT_DIR"

  local arch os proot_url
  arch=$(detect_arch)
  os=$(detect_os)

  # Proot release URL'i
  if [ "$os" = "linux" ]; then
    proot_url="https://github.com/proot-me/proot/releases/download/v5.4.0/proot-v5.4.0-${arch}-static"
  elif [ "$os" = "darwin" ]; then
    log_warn "macOS'ta proot-tester5 kullanılıyor (gerçek proot değil)"
    proot_url="https://github.com/proot-me/proot/releases/download/v5.4.0/proot-v5.4.0-${arch}-static"
  fi

  local proot_bin="${PROOT_DIR}/proot"

  if [ -f "$proot_bin" ]; then
    log_warn "Proot zaten mevcut: $proot_bin"
  else
    log_info "Proot indiriliyor: $proot_url"
    curl -sL "$proot_url" -o "$proot_bin"
    chmod +x "$proot_bin"
    log_success "Proot indirildi: $proot_bin"
  fi

  # test-static da indir (.linkLabel test için opsiyonel)
  local test_url="https://github.com/proot-me/proot/releases/download/v5.4.0/test-static-${arch}"
  local test_bin="${PROOT_DIR}/test-static"
  if [ ! -f "$test_bin" ]; then
    curl -sL "$test_url" -o "$test_bin" 2>/dev/null || true
    chmod +x "$test_bin" 2>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Adım 2: Debian minimal rootfs oluştur
# ---------------------------------------------------------------------------
setup_rootfs() {
  log_info "Debian rootfs oluşturuluyor..."

  if [ -d "$ROOTFS_DIR" ] && [ -f "$ROOTFS_DIR/usr/bin/bash" ]; then
    log_warn "Rootfs zaten mevcut: $ROOTFS_DIR"
    return 0
  fi

  local arch
  arch=$(detect_arch)

  # Debian mimari eşleme
  local deb_arch
  case "$arch" in
    aarch64)  deb_arch="arm64" ;;
    arm)      deb_arch="armhf" ;;
    x86_64)   deb_arch="amd64" ;;
    i686)     deb_arch="i386" ;;
  esac

  # debootstrap varsa kullan, yoksa hazır rootfs indir
  if command -v debootstrap >/dev/null 2>&1; then
    log_info "debootstrap ile rootfs oluşturuluyor (sudo gerekli)..."
    sudo debootstrap --arch="$deb_arch" --variant=minbase \
      --include=busybox,util-linux,procps \
      bookworm "$ROOTFS_DIR" https://deb.debian.org/debian/
  else
    log_info "debootstrap bulunamadı, hazır rootfs indiriliyor..."
    # Debian cloud image rootfs (minimal, ~50MB)
    local rootfs_url="https://github.com/nicknisi/dotfiles/raw/main/debian-rootfs.tar.gz"
    # Alternatif: proot Debian rootfs
    rootfs_url="https://github.com/nicknisi/dotfiles/raw/main/debian-rootfs.tar.gz"

    # tinyfs'den minimal Debian rootfs
    # notroot/tinyroot proje rootfs'leri
    rootfs_url="https://github.com/nicknisi/dotfiles/raw/main/debian-rootfs.tar.gz"

    # Basit approach: proot ile debootstrap
    log_warn "debootstrap yükleniyor..."
    local tmpdir
    tmpdir=$(mktemp -d)

    # proot ile minimal rootfs oluşturma
    if [ -f "${PROOT_DIR}/proot" ]; then
      log_info "Proot ile debian-bootstrap çalıştırılıyor..."

      # İlk olarak minimal filesystem oluştur
      mkdir -p "$ROOTFS_DIR"/{bin,dev,etc,home,lib,lib64,proc,root,sbin,sys,tmp,usr,var}
      mkdir -p "$ROOTFS_DIR"/usr/{bin,lib,local,sbin,share,var}
      mkdir -p "$ROOTFS_DIR"/var/lib
      mkdir -p "$ROOTFS_DIR"/etc/{apt,ssl,alternatives}

      # Debian rootfs'i tinyfs'den indir
      log_info "Debian bookworm rootfs indiriliyor..."
      local rootfs_archive="${tmpdir}/debian-rootfs.tar.gz"

      #tinyroot projesinden minimal rootfs
      curl -sL "https://github.com/nicknisi/dotfiles/raw/main/debian-rootfs.tar.gz" \
        -o "$rootfs_archive" 2>/dev/null || true

      if [ -f "$rootfs_archive" ] && [ -s "$rootfs_archive" ]; then
        log_info "Rootfs arşivi indirildi, çıkarılıyor..."
        tar -xzf "$rootfs_archive" -C "$ROOTFS_DIR" 2>/dev/null || true
      else
        log_warn "Hazır rootfs indirilemedi, manuel oluşturuluyor..."
        create_minimal_rootfs
      fi
    else
      create_minimal_rootfs
    fi

    rm -rf "$tmpdir"
  fi

  # gerekli dizinleri oluştur
  mkdir -p "$ROOTFS_DIR"/{dev,proc,sys,tmp,root/bridge}
  chmod 1777 "$ROOTFS_DIR/tmp"

  log_success "Rootfs hazır: $ROOTFS_DIR"
}

# Manuel minimal rootfs oluşturma (fallback)
create_minimal_rootfs() {
  log_info "Manuel minimal rootfs oluşturuluyor..."

  mkdir -p "$ROOTFS_DIR"/{bin,dev,etc,home,lib,lib64,proc,root,sbin,sys,tmp,usr,var}
  mkdir -p "$ROOTFS_DIR"/usr/{bin,lib,local,sbin,share,var}
  mkdir -p "$ROOTFS_DIR"/var/lib
  mkdir -p "$ROOTFS_DIR"/etc/{apt,ssl,alternatives,ld.so.conf.d}

  # Busybox veya static busybox indir
  local busybox_url="https://busybox.net/downloads/binaries/1.35.0-x86_64-linux-musl/busybox"
  local arch
  arch=$(detect_arch)
  case "$arch" in
    aarch64) busybox_url="https://busybox.net/downloads/binaries/1.35.0-aarch64-linux-musl/busybox" ;;
    arm)     busybox_url="https://busybox.net/downloads/binaries/1.35.0-armv6l-linux-musl/busybox" ;;
    x86_64)  busybox_url="https://busybox.net/downloads/binaries/1.35.0-x86_64-linux-musl/busybox" ;;
  esac

  curl -sL "$busybox_url" -o "$ROOTFS_DIR/bin/busybox" 2>/dev/null || true
  chmod +x "$ROOTFS_DIR/bin/busybox" 2>/dev/null || true

  # Busybox linkleri oluştur
  if [ -f "$ROOTFS_DIR/bin/busybox" ]; then
    cd "$ROOTFS_DIR/bin"
    for cmd in sh bash ls cat cp mv rm mkdir chmod chown mount umount ln grep sed awk \
               tar gzip wget curl apt dpkg apt-get; do
      ln -sf busybox "$cmd" 2>/dev/null || true
    done
    cd -
  fi

  # Basit /etc/passwd ve /etc/group
  echo "root:x:0:0:root:/root:/bin/sh" > "$ROOTFS_DIR/etc/passwd"
  echo "root:x:0:" > "$ROOTFS_DIR/etc/group"
  echo "vibeshell" > "$ROOTFS_DIR/etc/hostname"
  echo "nameserver 8.8.8.8" > "$ROOTFS_DIR/etc/resolv.conf"

  log_warn "Minimal rootfs oluşturuldu (sadece busybox)"
}

# ---------------------------------------------------------------------------
# Adım 3: Node.js ve git kur (proot içinde)
# ---------------------------------------------------------------------------
install_node_in_proot() {
  log_info "Proot ortamında Node.js kuruluyor..."

  local proot_bin="${PROOT_DIR}/proot"

  if [ ! -f "$proot_bin" ]; then
    log_error "Proot binary bulunamadı: $proot_bin"
    return 1
  fi

  # Node.js kurulumunu proot içinde çalıştır
  # Debian rootfs içinde bash varsa onu kullan
  local bash_bin="/bin/sh"
  if [ -f "$ROOTFS_DIR/bin/bash" ]; then
    bash_bin="/bin/bash"
  fi

  $proot_bin -0 -r "$ROOTFS_DIR" \
    -b /dev \
    -b /proc \
    -b /sys \
    -w /root \
    $bash_bin -c '
      # apt kaynaklarını güncelle (eğer apt varsa)
      if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq
        apt-get install -y -qq curl git ca-certificates 2>/dev/null || true

        # Node.js kur
        curl -fsSL https://deb.nodesource.com/setup_'"$NODE_VERSION"'.x | bash -
        apt-get install -y -qq nodejs 2>/dev/null || true
      elif command -v wget >/dev/null 2>&1; then
        # wget ile Node.js binary indir
        ARCH=$(uname -m)
        case "$ARCH" in
          aarch64) NODE_ARCH="arm64" ;;
          armv7*)  NODE_ARCH="armv7l" ;;
          x86_64)  NODE_ARCH="x64" ;;
        esac
        NODE_VER="22.16.0"
        wget -q "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-linux-${NODE_ARCH}.tar.xz" -O /tmp/node.tar.xz
        tar -xf /tmp/node.tar.xz -C /usr/local --strip-components=1
        rm -f /tmp/node.tar.xz
      fi

      # Versiyonları kontrol et
      echo "Node: $(node --version 2>/dev/null || echo "YOK")"
      echo "npm: $(npm --version 2>/dev/null || echo "YOK")"
      echo "git: $(git --version 2>/dev/null || echo "YOK")"
  ' || {
    log_warn "Proot içinde kurulum başarısız oldu, alternatif deneniyor..."
    # Alternatif: Node.js static binary olarak kur
    install_node_static
  }

  log_success "Node.js kurulumu tamamlandı."
}

# Node.js'i static binary olarak kur (fallback)
install_node_static() {
  log_info "Node.js static binary olarak kuruluyor..."

  local arch
  arch=$(detect_arch)
  local node_arch
  case "$arch" in
    aarch64) node_arch="linux-arm64" ;;
    arm)     node_arch="linux-armv7l" ;;
    x86_64)  node_arch="linux-x64" ;;
  esac

  local node_ver="22.16.0"
  local node_url="https://nodejs.org/dist/v${node_ver}/node-v${node_ver}-${node_arch}.tar.xz"
  local tmpdir
  tmpdir=$(mktemp -d)

  log_info "Node.js v${node_ver} indiriliyor..."
  curl -sL "$node_url" -o "${tmpdir}/node.tar.xz"

  # Rootfs'e çıkar
  mkdir -p "$ROOTFS_DIR/usr/local"
  tar -xJf "${tmpdir}/node.tar.xz" -C "$ROOTFS_DIR/usr/local" --strip-components=1

  # Symlink'ler oluştur
  mkdir -p "$ROOTFS_DIR/usr/bin"
  ln -sf /usr/local/bin/node "$ROOTFS_DIR/usr/bin/node" 2>/dev/null || true
  ln -sf /usr/local/bin/npm "$ROOTFS_DIR/usr/bin/npm" 2>/dev/null || true
  ln -sf /usr/local/bin/npx "$ROOTFS_DIR/usr/bin/npx" 2>/dev/null || true

  rm -rf "$tmpdir"

  log_success "Node.js static binary kuruldu."
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
    curl -sL "$REPO_RAW/server.js" -o "$bridge_dest/server.js"
    curl -sL "$REPO_RAW/package.json" -o "$bridge_dest/package.json"
  fi

  # npm bağımlılıklarını kur (rootfs içinde)
  local proot_bin="${PROOT_DIR}/proot"
  if [ -f "$proot_bin" ] && [ -f "$bridge_dest/package.json" ]; then
    $proot_bin -0 -r "$ROOTFS_DIR" \
      -b /dev \
      -b /proc \
      -w /root/bridge \
      /usr/local/bin/npm install --production 2>/dev/null || {
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
# VibeSHell Bridge — Start Script (Proot)
set -euo pipefail

VIBESHELL_DIR="${HOME}/.vibeshell"
PROOT_BIN="${VIBESHELL_DIR}/proot/proot"
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
  -0 \
  -r "$ROOTFS_DIR" \
  -b /dev \
  -b /proc \
  -b /sys \
  -w /root \
  /usr/local/bin/node /root/bridge/server.js \
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
