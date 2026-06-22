const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom Expo config plugin that:
 * 1. Adds <uses-feature android:required="false"> for camera features
 *    so the app isn't filtered out on devices without cameras
 * 2. Appends custom ProGuard rules for native modules that need keep rules
 */

function withCameraFeatureNotRequired(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults.manifest;

        // Ensure uses-feature array exists
        if (!manifest['uses-feature']) {
            manifest['uses-feature'] = [];
        }

        const features = manifest['uses-feature'];

        // Add camera as not required
        const cameraFeatures = [
            'android.hardware.camera',
            'android.hardware.camera.autofocus',
        ];

        for (const featureName of cameraFeatures) {
            // Remove any existing entry for this feature
            const existingIndex = features.findIndex(
                (f) => f.$?.['android:name'] === featureName
            );
            if (existingIndex !== -1) {
                features.splice(existingIndex, 1);
            }

            // Add with required="false"
            features.push({
                $: {
                    'android:name': featureName,
                    'android:required': 'false',
                },
            });
        }

        return config;
    });
}

function withCustomProguardRules(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const proguardPath = path.join(
                config.modRequest.platformProjectRoot,
                'app',
                'proguard-rules.pro'
            );

            let proguardContent = '';
            if (fs.existsSync(proguardPath)) {
                proguardContent = fs.readFileSync(proguardPath, 'utf-8');
            }

            const customRules = `
# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-worklets (required by reanimated 4.x)
-keep class com.swmansion.worklets.** { *; }

# RevenueCat
-keep class com.revenuecat.** { *; }

# Google Sign-In
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }

# Expo modules
-keep class expo.modules.** { *; }

# Hermes
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
`;

            // Check if our custom rules are already present
            if (!proguardContent.includes('-keep class com.swmansion.worklets.** { *; }')) {
                proguardContent += customRules;
                fs.writeFileSync(proguardPath, proguardContent, 'utf-8');
            }

            return config;
        },
    ]);
}

module.exports = function withCustomAndroidConfig(config) {
    config = withCameraFeatureNotRequired(config);
    config = withCustomProguardRules(config);
    return config;
};
