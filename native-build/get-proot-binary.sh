#!/bin/bash
set -e

# VibeShell proot Binary Getter
# Termux packages repo'sundan proot + bağımlılıklarını indirir
#
# Gerekli dosyalar:
#   bin/proot              - proot binary (dynamic linked)
#   libexec/loader         - proot loader (static, 64-bit)
#   libexec/loader32       - proot loader (static, 32-bit)
#   lib/libtalloc.so.2     - talloc shared library
#   lib/libandroid-shmem.so - shared memory library
#
# Runtime: LD_LIBRARY_PATH=<bundle>/lib proot ...

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/output"

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Termux packages repo URL
TERMUX_REPO="https://packages.termux.dev/apt/termux-main"

# Mimari mapping
get_arch_info() {
    local arch=$1
    case $arch in
        arm64-v8a)
            echo "aarch64"
            ;;
        armeabi-v7a)
            echo "arm"
            ;;
        x86_64)
            echo "x86_64"
            ;;
        x86)
            echo "i686"
            ;;
        *)
            log_error "Desteklenmeyen mimari: $arch"
            return 1
            ;;
    esac
}

# Package versions (Termux stable)
PROOT_VERSION="5.1.107.82"
TALLOC_VERSION="2.4.3"
SHMEM_VERSION="0.7"

# Bir .deb paketini indir ve çıkar
download_and_extract_deb() {
    local pkg_name=$1
    local pkg_version=$2
    local arch=$3
    local dest_dir=$4

    local pkg_file="${pkg_name}_${pkg_version}_${arch}.deb"
    local url="${TERMUX_REPO}/pool/main/"
    local tmp_dir

    # URL'yi oluştur (paket adına göre path)
    case $pkg_name in
        proot)
            url="${url}p/proot/${pkg_file}"
            ;;
        libtalloc)
            url="${url}libt/libtalloc/${pkg_file}"
            ;;
        libandroid-shmem)
            url="${url}liba/libandroid-shmem/${pkg_file}"
            ;;
        *)
            log_error "Bilinmeyen paket: $pkg_name"
            return 1
            ;;
    esac

    tmp_dir=$(mktemp -d)
    trap "rm -rf $tmp_dir" RETURN

    log_info "İndiriliyor: $pkg_file"
    if ! curl -fsSL "$url" -o "${tmp_dir}/${pkg_file}"; then
        log_error "İndirme başarısız: $url"
        return 1
    fi

    # Deb'i çıkar
    cd "$tmp_dir"
    ar x "${pkg_file}" 2>/dev/null
    tar xf data.tar.* 2>/dev/null

    # Dosyaları kopyala (sadece gerekli dosyalar)
    mkdir -p "$dest_dir"
    case $pkg_name in
        proot)
            # Sadece proot binary ve loader'ları al
            cp "./data/data/com.termux/files/usr/bin/proot" "$dest_dir/" 2>/dev/null || true
            cp "./data/data/com.termux/files/usr/libexec/proot/loader" "$dest_dir/" 2>/dev/null || true
            cp "./data/data/com.termux/files/usr/libexec/proot/loader32" "$dest_dir/" 2>/dev/null || true
            ;;
        libtalloc)
            # Sadece .so dosyalarını al
            find . -name "libtalloc.so*" -exec cp {} "$dest_dir/" \; 2>/dev/null || true
            ;;
        libandroid-shmem)
            # Sadece .so dosyasını al
            find . -name "libandroid-shmem.so*" -exec cp {} "$dest_dir/" \; 2>/dev/null || true
            ;;
    esac

    cd /
    return 0
}

# Ana indirme fonksiyonu
download_proot_bundle() {
    local arch=$1
    local proot_arch=$(get_arch_info "$arch") || return 1

    log_info "proot bundle indiriliyor: $arch ($proot_arch)"
    log_info "Termux packages repo: $TERMUX_REPO"

    mkdir -p "$OUTPUT_DIR"

    local bundle_dir="${OUTPUT_DIR}/proot-bundle-${arch}"
    mkdir -p "${bundle_dir}/bin" "${bundle_dir}/lib" "${bundle_dir}/libexec"

    # 1. proot binary + loader'lar
    download_and_extract_deb "proot" "$PROOT_VERSION" "$proot_arch" "${bundle_dir}/bin"
    if [ ! -f "${bundle_dir}/bin/proot" ]; then
        log_error "proot binary bulunamadı!"
        return 1
    fi
    chmod +x "${bundle_dir}/bin/proot"

    # Loader'ları bin'den libexec'e taşı
    if [ -f "${bundle_dir}/bin/loader" ]; then
        mv "${bundle_dir}/bin/loader" "${bundle_dir}/libexec/"
    fi
    if [ -f "${bundle_dir}/bin/loader32" ]; then
        mv "${bundle_dir}/bin/loader32" "${bundle_dir}/libexec/"
    fi

    # 2. libtalloc
    download_and_extract_deb "libtalloc" "$TALLOC_VERSION" "$proot_arch" "${bundle_dir}/lib"

    # 3. libandroid-shmem
    download_and_extract_deb "libandroid-shmem" "$SHMEM_VERSION" "$proot_arch" "${bundle_dir}/lib"

    # libtalloc symlink'ini oluştur
    cd "${bundle_dir}/lib"
    if [ -f "libtalloc.so.2.4.3" ]; then
        ln -sf libtalloc.so.2.4.3 libtalloc.so.2
    fi
    cd "$SCRIPT_DIR"

    # Sonuçları göster
    log_info ""
    log_info "========================================="
    log_info "TAMAMLANDI!"
    log_info "========================================="
    log_info "Bundle dizini: $bundle_dir"
    log_info ""
    log_info "Dosyalar:"
    find "$bundle_dir" -type f -o -type l | sort | while read f; do
        local size=$(du -h "$f" | cut -f1)
        log_info "  $(echo $f | sed "s|$bundle_dir/||") ($size)"
    done
    log_info ""
    log_info "Toplam boyut:"
    du -sh "$bundle_dir"
    log_info ""
    log_info "Kullanım:"
    log_info "  LD_LIBRARY_PATH=$bundle_dir/lib $bundle_dir/bin/proot --help"
}

# Alternatif: GitHub releases'ten indir (fallback)
download_from_github() {
    local arch=$1

    log_info "GitHub'dan proot binary indiriliyor: $arch"
    log_warn "GitHub release'lerinde binary bulunamadı, Termux packages kullanılıyor"
    download_proot_bundle "$arch"
}

# Kaynaktan derle (cross-compile gerektirir)
build_from_source() {
    log_info "proot kaynaktan derleniyor..."
    log_warn "Bu uzun sürebilir ve Android NDK gerektirir"

    log_error "Kaynak build henüz implement edilmedi"
    log_info "Önerilen: download metodunu kullan"
    log_info "Referans: https://github.com/termux/proot"
    log_info "NDK ile build: make PROOT_STATIC=1"
}

# Kullanım
usage() {
    echo "Kullanım: $0 [download|build] [arch]"
    echo ""
    echo "Metodlar:"
    echo "  download     Termux packages repo'sundan hazır bundle indir (önerilen)"
    echo "  build        Kaynaktan derle (NDK gerektirir)"
    echo ""
    echo "Mimariler:"
    echo "  arm64-v8a    ARM64 (çoğu modern Android)"
    echo "  armeabi-v7a  ARMv7 (eski cihazlar)"
    echo "  x86_64       x86 64-bit (emülatör)"
    echo "  x86          x86 32-bit (emülatör)"
    echo "  all          Tüm mimariler"
    echo ""
    echo "Örnekler:"
    echo "  $0 download arm64-v8a"
    echo "  $0 download all"
    exit 1
}

# Ana script
main() {
    if [ $# -lt 1 ]; then
        usage
    fi

    mkdir -p "$OUTPUT_DIR"

    local method=$1
    local arch=${2:-all}

    case $method in
        download)
            if [ "$arch" = "all" ]; then
                download_proot_bundle "arm64-v8a"
                download_proot_bundle "armeabi-v7a"
            else
                download_proot_bundle "$arch"
            fi
            ;;
        build)
            build_from_source
            ;;
        *)
            usage
            ;;
    esac
}

main "$@"
