#!/bin/bash
set -e

# VibeShell Rootfs Builder (v5 — ARM64, minimal, no Docker)
# Downloads Alpine ARM64 minirootfs + Node.js ARM64 static + opencode ARM64

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/output"
WORK_DIR="${SCRIPT_DIR}/work"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

ALPINE_VERSION="3.21"
NODE_VERSION="22.16.0"
OPENCODE_VERSION="1.17.13"

prepare_dirs() {
    log_info "Preparing directories..."
    local proot_backup=""
    if [ -d "${OUTPUT_DIR}/proot-bundle-arm64-v8a" ]; then
        proot_backup=$(mktemp -d)
        cp -r "${OUTPUT_DIR}/proot-bundle-arm64-v8a" "${proot_backup}/"
    fi
    rm -rf "${WORK_DIR}" "${OUTPUT_DIR}"
    mkdir -p "${WORK_DIR}" "${OUTPUT_DIR}"
    if [ -n "$proot_backup" ] && [ -d "${proot_backup}/proot-bundle-arm64-v8a" ]; then
        cp -r "${proot_backup}/proot-bundle-arm64-v8a" "${OUTPUT_DIR}/"
        rm -rf "$proot_backup"
    fi
}

download_alpine_minirootfs() {
    log_info "Downloading Alpine ARM64 minirootfs..."
    local url="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/aarch64/alpine-minirootfs-${ALPINE_VERSION}.0-aarch64.tar.gz"
    curl -fsSL -o "${WORK_DIR}/alpine.tar.gz" "$url"
    mkdir -p "${WORK_DIR}/rootfs"
    tar -xzf "${WORK_DIR}/alpine.tar.gz" -C "${WORK_DIR}/rootfs"
    rm "${WORK_DIR}/alpine.tar.gz"
    log_info "Alpine ARM64 minirootfs ready"
}

install_nodejs_arm64() {
    log_info "Installing Node.js ${NODE_VERSION} ARM64..."
    local url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz"
    curl -fsSL -o "${WORK_DIR}/node.tar.xz" "$url"
    tar -xJf "${WORK_DIR}/node.tar.xz" -C "${WORK_DIR}"

    local nd="${WORK_DIR}/node-v${NODE_VERSION}-linux-arm64"
    mkdir -p "${WORK_DIR}/rootfs/usr/local/bin"
    mkdir -p "${WORK_DIR}/rootfs/usr/local/lib/node_modules/npm"

    cp "${nd}/bin/node" "${WORK_DIR}/rootfs/usr/local/bin/"
    cp "${nd}/bin/npm" "${WORK_DIR}/rootfs/usr/local/bin/"
    cp "${nd}/bin/npx" "${WORK_DIR}/rootfs/usr/local/bin/"
    cp -r "${nd}/lib/node_modules/npm/"* "${WORK_DIR}/rootfs/usr/local/lib/node_modules/npm/"

    rm -rf "${nd}" "${WORK_DIR}/node.tar.xz"
    log_info "Node.js ARM64 ready"
}

install_opencode_arm64() {
    log_info "Installing opencode-ai ARM64..."

    local tmp="${WORK_DIR}/opencode-tmp"
    mkdir -p "$tmp"

    # Download opencode main package + ARM64 binary separately
    cd "$tmp"

    # 1. Install opencode-ai on HOST to get JS code (ignore platform binaries)
    npm init -y >/dev/null 2>&1
    npm install opencode-ai --ignore-scripts --no-optional >/dev/null 2>&1 || true

    # 2. Download ARM64 binary directly
    npm pack "opencode-linux-arm64@${OPENCODE_VERSION}" >/dev/null 2>&1
    mkdir -p arm64-extract
    tar -xzf "opencode-linux-arm64-${OPENCODE_VERSION}.tgz" -C arm64-extract
    chmod +x arm64-extract/package/bin/opencode

    # 3. Assemble: JS code + ARM64 binary
    local dest="${WORK_DIR}/rootfs/usr/local/lib/node_modules/opencode-ai"
    mkdir -p "$dest"

    # Copy JS code (no native binaries)
    cp -r node_modules/opencode-ai/* "$dest/" 2>/dev/null || true
    # Remove x64 binaries that npm pulled
    rm -rf "$dest/opencode-linux-x64" "$dest/opencode-linux-x64-baseline"
    rm -rf "$dest/node_modules"

    # Copy ARM64 binary
    mkdir -p "$dest/opencode-linux-arm64"
    cp arm64-extract/package/bin/opencode "$dest/opencode-linux-arm64/"
    chmod +x "$dest/opencode-linux-arm64/opencode"
    cp arm64-extract/package/package.json "$dest/opencode-linux-arm64/"

    # Create launcher
    mkdir -p "${WORK_DIR}/rootfs/usr/local/bin"
    cat > "${WORK_DIR}/rootfs/usr/local/bin/opencode" << 'EOF'
#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "${SCRIPT_DIR}/../lib/node_modules/opencode-ai/opencode-linux-arm64/opencode" "$@"
EOF
    chmod +x "${WORK_DIR}/rootfs/usr/local/bin/opencode"

    cd "$SCRIPT_DIR"
    rm -rf "$tmp"
    log_info "opencode ARM64 ready"
}

setup_rootfs() {
    log_info "Setting up rootfs..."

    mkdir -p "${WORK_DIR}/rootfs"/{dev,proc,sys,tmp,run,root/bridge}
    mkdir -p "${WORK_DIR}/rootfs/etc/apk"

    echo -e "nameserver 8.8.8.8\nnameserver 1.1.1.1" > "${WORK_DIR}/rootfs/etc/resolv.conf"
    cat > "${WORK_DIR}/rootfs/etc/apk/repositories" << EOF
https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main
https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/community
EOF
    echo -e 'export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nexport HOME=/root' > "${WORK_DIR}/rootfs/etc/profile"

    # Bridge server
    log_info "Copying bridge server..."
    cp -r "${SCRIPT_DIR}/../bridge/"* "${WORK_DIR}/rootfs/root/bridge/"
    cd "${WORK_DIR}/rootfs/root/bridge"
    npm install --omit=dev 2>/dev/null || true
    cd "$SCRIPT_DIR"

    # Clean up aggressively
    log_info "Cleaning up..."
    rm -rf "${WORK_DIR}/rootfs/root/.npm" "${WORK_DIR}/rootfs/var/cache/apk"/*
    rm -rf "${WORK_DIR}/rootfs/usr/share/man" "${WORK_DIR}/rootfs/usr/share/doc"
    rm -rf "${WORK_DIR}/rootfs/tmp"/*
    find "${WORK_DIR}/rootfs" -name "*.md" -delete 2>/dev/null || true
    find "${WORK_DIR}/rootfs" -name "LICENSE*" -delete 2>/dev/null || true
    find "${WORK_DIR}/rootfs" -name "CHANGELOG*" -delete 2>/dev/null || true
    find "${WORK_DIR}/rootfs" -name "*.map" -delete 2>/dev/null || true
}

compress_rootfs() {
    local output_file="${OUTPUT_DIR}/rootfs.tar.gz"
    log_info "Compressing rootfs..."
    tar -czf "$output_file" -C "${WORK_DIR}/rootfs" .
    local size=$(du -h "$output_file" | cut -f1)
    log_info "Rootfs: $output_file ($size)"
    sha256sum "$output_file" > "${output_file}.sha256"
}

main() {
    log_info "========================================="
    log_info "VibeShell Rootfs Builder (ARM64 v5)"
    log_info "========================================="
    prepare_dirs
    download_alpine_minirootfs
    install_nodejs_arm64
    install_opencode_arm64
    setup_rootfs
    compress_rootfs
    log_info ""
    log_info "BUILD COMPLETE!"
    ls -lh "$OUTPUT_DIR"
}

main "$@"
