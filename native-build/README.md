# Native Build - Proot + Rootfs

Bu dizin VibeShell'in embedded Linux ortamını (proot + Alpine rootfs) hazırlar.

## Yapı

```
native-build/
├── build-rootfs.sh          # Alpine rootfs builder scripti
├── get-proot-binary.sh      # proot binary indirme/derleme scripti
├── Dockerfile.builder       # Docker ile temiz build ortamı
├── work/                    # Geçici build dosyaları (gitignore'da)
└── output/                  # Hazır rootfs + proot binary'leri
    ├── vibeshell-rootfs-arm64-v8a.tar.xz
    ├── vibeshell-rootfs-armeabi-v7a.tar.xz
    ├── proot-arm64-v8a
    └── proot-armeabi-v7a
```

## Kullanım

### 1. Rootfs Hazırlama

```bash
# ARM64 için
./build-rootfs.sh arm64-v8a

# Tüm mimariler için
./build-rootfs.sh all
```

### 2. Proot Binary Temin Etme

```bash
# Termux proot binary'lerini indir (hızlı, önerilen)
./get-proot-binary.sh download

# Veya kaynaktan derle (uzun sürer)
./get-proot-binary.sh build
```

### 3. Docker ile Build (Önerilen)

```bash
docker build -t vibeshell-builder -f Dockerfile.builder .
docker run --rm -v $(pwd)/output:/output vibeshell-builder
```

## Rootfs İçeriği

Alpine Linux minimal rootfs + aşağıdakiler önceden kurulu:

- Node.js 20.x
- npm
- git
- bash
- curl
- Bridge server (`/root/bridge/server.js`)

## Boyutlar

- Alpine miniroot: ~3MB (compressed)
- + Node.js: ~15MB
- + dependencies: ~5MB
- **Toplam: ~20-25MB (compressed)**
- Extracted: ~80-100MB

## Proot Binary

- Statically linked binary (bağımlılık yok)
- Mimari başına ~400KB
- Termux proot-distro reposundan alınıyor

## GitHub Release Workflow

`.github/workflows/build-native.yml` dosyası her release'de otomatik olarak:

1. Tüm mimariler için rootfs build eder
2. proot binary'lerini toplar
3. Release asset'leri olarak yükler

App ilk açılışta bu asset'leri GitHub'dan indirir.
