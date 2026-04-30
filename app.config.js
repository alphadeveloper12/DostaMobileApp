// app.config.js — replaces app.json, reads from .env via process.env
// EXPO_PUBLIC_* vars are automatically loaded by Expo CLI from .env
// EAS injects them via eas.json `env` section at build time

module.exports = {
  expo: {
    name: 'Dosta',
    slug: 'dosta-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './src/assets/icon.png',
    splash: {
      image: './src/assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#054A86',
    },
    scheme: 'dosta',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.dosta.mobile',
      buildNumber: '2',
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'We use your location to find the nearest vending machine.',
        NSLocationAlwaysUsageDescription:
          'We use your location to find the nearest vending machine.',
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              'com.googleusercontent.apps.760692328304-ono9clmtpclgluovk69kqmusjjojbu3f',
            ],
          },
        ],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './src/assets/icon.png',
        backgroundColor: '#054A86',
      },
      package: 'com.dosta.mobile',
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    },
    web: {},
    plugins: [
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      'expo-font',
      'expo-web-browser',
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://dosta.cloud',
      eas: {
        projectId: '72bca3af-2895-46f3-9316-0c4ee93d4071',
      },
    },
  },
};
