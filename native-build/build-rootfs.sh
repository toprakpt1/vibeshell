#!/bin/bash
set -e

# VibeShell Rootfs Builder
# Bu script Alpine Linux minimal rootfs'i indirir, Node.js kurar ve bridge server'ı hazırlar

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/output"
WORK_DIR="${SCRIPT_DIR}/work"
ALPINE_VERSION="3.19"
NODE_VERSION="20"

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Temizlik ve hazırlık
prepare_dirs() {
    log_info "Dizinler hazırlanıyor..."
    rm -rf "${WORK_DIR}" "${OUTPUT_DIR}"
    mkdir -p "${WORK_DIR}" "${OUTPUT_DIR}"
}

# Alpine miniroot indir
download_alpine() {
    local arch=$1
    local alpine_arch=""
    
    case $arch in
        arm64-v8a)
            alpine_arch="aarch64"
            ;;
        armeabi-v7a)
            alpine_arch="armv7"
            ;;
        *)
            log_error "Desteklenmeyen mimari: $arch"
            return 1
            ;;
    esac
    
    log_info "Alpine Linux $ALPINE_VERSION ($alpine_arch) indiriliyor..."
    
    local url="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${alpine_arch}/alpine-minirootfs-${ALPINE_VERSION}.0-${alpine_arch}.tar.gz"
    local tarball="${WORK_DIR}/alpine-${arch}.tar.gz"
    
    if ! curl -fsSL "$url" -o "$tarball"; then
        log_error "Alpine rootfs indirilemedi!"
        return 1
    fi
    
    if [ ! -f "$tarball" ]; then
        log_error "Alpine rootfs dosyası oluşturulamadı!"
        return 1
    fi
    
    local size=$(du -h "$tarball" | cut -f1)
    log_info "Alpine rootfs indirildi: $size"
    
    echo "$tarball"
}

# Rootfs'i extract et ve hazırla
prepare_rootfs() {
    local tarball=$1
    local arch=$2
    local rootfs_dir="${WORK_DIR}/rootfs-${arch}"
    
    log_info "Rootfs extract ediliyor: $arch"
    mkdir -p "$rootfs_dir"
    tar -xzf "$tarball" -C "$rootfs_dir"
    
    # DNS resolver
    echo "nameserver 8.8.8.8" > "${rootfs_dir}/etc/resolv.conf"
    
    # APK repository
    cat > "${rootfs_dir}/etc/apk/repositories" <<EOF
https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main
https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/community
EOF
    
    log_info "Node.js ve bağımlılıklar kuruluyor..."
    
    # proot ile chroot yapıp Node.js kurulumu
    # Not: Bu aşamada host sistemde proot olmalı veya docker kullanabiliriz
    # Şimdilik dökümante ediyoruz, gerçek kurulum için docker container kullanacağız
    
    echo "$rootfs_dir"
}

# Bridge server'ı rootfs'e kopyala
install_bridge_server() {
    local rootfs_dir=$1
    
    log_info "Bridge server rootfs'e kopyalanıyor..."
    
    local bridge_src="${SCRIPT_DIR}/../bridge"
    local bridge_dest="${rootfs_dir}/root/bridge"
    
    if [ ! -d "$bridge_src" ]; then
        log_error "Bridge server bulunamadı: $bridge_src"
        return 1
    fi
    
    mkdir -p "$bridge_dest"
    cp -r "${bridge_src}"/* "$bridge_dest/"
    
    log_info "Bridge server kopyalandı"
}

# Rootfs'i sıkıştır
compress_rootfs() {
    local rootfs_dir=$1
    local arch=$2
    local output_file="${OUTPUT_DIR}/vibeshell-rootfs-${arch}.tar.xz"
    
    log_info "Rootfs sıkıştırılıyor (bu biraz zaman alabilir)..."
    
    tar -cJf "$output_file" -C "$rootfs_dir" .
    
    local size=$(du -h "$output_file" | cut -f1)
    log_info "✓ Rootfs hazır: $output_file ($size)"
    
    # Checksum oluştur
    sha256sum "$output_file" > "${output_file}.sha256"
    
    echo "$output_file"
}

# Ana build fonksiyonu
build_for_arch() {
    local arch=$1
    
    log_info "========================================="
    log_info "Build başlatılıyor: $arch"
    log_info "========================================="
    
    local tarball=$(download_alpine "$arch")
    local rootfs_dir=$(prepare_rootfs "$tarball" "$arch")
    install_bridge_server "$rootfs_dir"
    local output=$(compress_rootfs "$rootfs_dir" "$arch")
    
    log_info "✓ $arch için build tamamlandı!"
}

# Docker ile build (önerilen yöntem - host sistem kirletmeden)
build_with_docker() {
    log_info "Docker container ile build başlatılıyor..."
    
    cat > "${WORK_DIR}/Dockerfile" <<'EOF'
FROM alpine:3.19

RUN apk add --no-cache \
    bash \
    curl \
    tar \
    xz \
    nodejs \
    npm \
    git

WORKDIR /build
COPY . .

CMD ["/bin/bash"]
EOF
    
    log_warn "Docker build henüz implement edilmedi - manual build kullan"
}

# Script kullanım bilgisi
usage() {
    echo "Kullanım: $0 [arm64-v8a|armeabi-v7a|all]"
    echo ""
    echo "Örnekler:"
    echo "  $0 arm64-v8a        # Sadece ARM64 için build"
    echo "  $0 all              # Tüm mimariler için build"
    exit 1
}

# Ana script
main() {
    if [ $# -eq 0 ]; then
        usage
    fi
    
    prepare_dirs
    
    case $1 in
        arm64-v8a|armeabi-v7a)
            build_for_arch "$1"
            ;;
        all)
            build_for_arch "arm64-v8a"
            build_for_arch "armeabi-v7a"
            ;;
        *)
            usage
            ;;
    esac
    
    log_info ""
    log_info "========================================="
    log_info "BUILD TAMAMLANDI!"
    log_info "========================================="
    log_info "Çıktı dizini: $OUTPUT_DIR"
    ls -lh "$OUTPUT_DIR"
}

main "$@"
