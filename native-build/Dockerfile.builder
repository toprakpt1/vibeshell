# VibeShell Native Builder
# Alpine rootfs + Node.js hazırlama container'ı

FROM alpine:3.19

# Build dependencies
RUN apk add --no-cache \
    bash \
    curl \
    tar \
    xz \
    git \
    nodejs \
    npm

# Work directory
WORKDIR /build

# Copy scripts
COPY build-rootfs.sh .
COPY get-proot-binary.sh .
COPY ../bridge ./bridge

# Build için output directory
RUN mkdir -p /output

# Default command: ARM64 için build
CMD ["bash", "-c", "./build-rootfs.sh arm64-v8a && cp -r output/* /output/"]
