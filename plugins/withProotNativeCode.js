const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withProotNativeCode = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;

      const srcDir = path.join(projectRoot, 'native-build', 'android', 'bridge');
      const destDir = path.join(
        platformProjectRoot,
        'app', 'src', 'main', 'java', 'com', 'vibeshell', 'app', 'bridge'
      );

      if (!fs.existsSync(srcDir)) {
        console.warn(`[withProotNativeCode] Source directory not found: ${srcDir}`);
        return config;
      }

      fs.mkdirSync(destDir, { recursive: true });

      const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.kt'));
      files.forEach((file) => {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        fs.copyFileSync(src, dest);
        console.log(`[withProotNativeCode] Copied ${file}`);
      });

      return config;
    },
  ]);
};

module.exports = withProotNativeCode;
