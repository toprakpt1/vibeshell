const {
  withAndroidManifest,
  withMainApplication,
} = require('@expo/config-plugins');

/**
 * Expo Config Plugin for VibeShell Proot Module
 *
 * Bu plugin:
 * 1. AndroidManifest.xml'e foreground service permission'ları ekler
 * 2. BridgeForegroundService'i register eder
 * 3. Battery optimization exemption permission ekler
 * 4. ProotPackage'ı MainApplication'a kaydeder
 */

function withProotModule(config) {
  // Android Manifest modifikasyonları
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Permissions ekle
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.WAKE_LOCK',
      'android.permission.INTERNET',
      'android.permission.POST_NOTIFICATIONS',
    ];

    permissions.forEach((permission) => {
      const exists = androidManifest['uses-permission'].some(
        (item) => item.$['android:name'] === permission
      );
      if (!exists) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });

    // Application tag'ine service ekle
    const application = androidManifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    // BridgeForegroundService'i ekle
    const serviceExists = application.service.some(
      (service) =>
        service.$['android:name'] === '.bridge.BridgeForegroundService'
    );

    if (!serviceExists) {
      application.service.push({
        $: {
          'android:name': '.bridge.BridgeForegroundService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
        'property': [
          {
            $: {
              'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
              'android:value': 'Local development server for coding',
            },
          },
        ],
      });
    }

    return config;
  });

  // MainApplication'a ProotPackage'ı kaydet
  config = withMainApplication(config, (config) => {
    let mainApplication = config.modResults.contents;

    // ProotPackage import'u ekle (eğer yoksa)
    const importLine = 'import com.vibeshell.app.bridge.ProotPackage;';
    if (!mainApplication.includes(importLine)) {
      // İlk import'un sonrasına ekle
      mainApplication = mainApplication.replace(
        /(import [^\n]+\n)(?!.*import)/,
        `$1${importLine}\n`
      );
    }

    // ProotPackage'ı packages listesine ekle (eğer yoksa)
    const packageRegistration = 'add(ProotPackage())';
    if (!mainApplication.includes(packageRegistration)) {
      // Modern Expo: PackageList(this).packages.apply { ... }
      // Eski Expo: packages.addAll(getExpoPackages())
      if (mainApplication.includes('PackageList(this).packages.apply')) {
        mainApplication = mainApplication.replace(
          /PackageList\(this\)\.packages\.apply\s*\{/,
          `PackageList(this).packages.apply {\n        add(ProotPackage())`
        );
      } else if (mainApplication.includes('packages.addAll(getExpoPackages())')) {
        mainApplication = mainApplication.replace(
          /packages\.addAll\(getExpoPackages\(\)\)/,
          `packages.add(ProotPackage())\n      packages.addAll(getExpoPackages())`
        );
      }
    }

    config.modResults.contents = mainApplication;
    return config;
  });

  return config;
}

module.exports = withProotModule;
