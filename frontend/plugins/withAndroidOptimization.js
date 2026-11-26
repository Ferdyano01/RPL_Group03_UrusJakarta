const { AndroidConfig, withAndroidStyles, withGradleProperties } = require('expo/config-plugins');

const GRADLE_OVERRIDES = {
  // Build only physical Android phone ABIs (excludes x86/x86_64 emulator binaries)
  reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
  'android.enableBundleCompression': 'true',
  'expo.useLegacyPackaging': 'true',
  'expo.gif.enabled': 'false',
};

/**
 * Expo config plugin to optimize APK size and ensure dark 3-button Android navigation bar icons.
 */
module.exports = function withAndroidOptimization(config) {
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    for (const [key, value] of Object.entries(GRADLE_OVERRIDES)) {
      const existing = props.find((item) => item.type === 'property' && item.key === key);
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    }
    return cfg;
  });

  config = withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:windowLightNavigationBar',
      value: 'true',
    });
    return cfg;
  });

  return config;
};
