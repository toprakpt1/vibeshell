const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNativeAssets = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const assetsDir = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'assets'
      );

      fs.mkdirSync(path.join(assetsDir, 'proot-bundle'), { recursive: true });
      fs.mkdirSync(path.join(assetsDir, 'rootfs'), { recursive: true });

      // Copy entire proot bundle (bin, lib, libexec)
      const bundleDir = path.join(projectRoot, 'native-build', 'output', 'proot-bundle-arm64-v8a');
      if (fs.existsSync(bundleDir)) {
        const copyDir = (src, dest) => {
          fs.mkdirSync(dest, { recursive: true });
          for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              copyDir(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
              fs.chmodSync(destPath, 0o755);
            }
          }
        };
        copyDir(bundleDir, path.join(assetsDir, 'proot-bundle'));
        console.log('[withNativeAssets] Copied proot bundle');
      } else {
        console.warn('[withNativeAssets] proot bundle not found — run get-proot-binary.sh first');
      }

      // Copy rootfs tarball
      const rootfsSrc = path.join(projectRoot, 'native-build', 'output', 'rootfs.tar.gz');
      const rootfsDest = path.join(assetsDir, 'rootfs', 'rootfs.tar.gz');
      if (fs.existsSync(rootfsSrc)) {
        fs.copyFileSync(rootfsSrc, rootfsDest);
        const sizeMB = Math.round(fs.statSync(rootfsDest).size / 1024 / 1024);
        console.log(`[withNativeAssets] Copied rootfs tarball (${sizeMB}MB)`);
      } else {
        console.warn('[withNativeAssets] rootfs tarball not found — run build-rootfs.sh first');
      }

      // Copy rootfs checksum if exists
      const checksumSrc = path.join(projectRoot, 'native-build', 'output', 'rootfs.tar.gz.sha256');
      const checksumDest = path.join(assetsDir, 'rootfs', 'rootfs.tar.gz.sha256');
      if (fs.existsSync(checksumSrc)) {
        fs.copyFileSync(checksumSrc, checksumDest);
      }

      return config;
    },
  ]);
};

module.exports = withNativeAssets;
