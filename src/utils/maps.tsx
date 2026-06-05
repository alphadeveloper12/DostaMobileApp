/**
 * Safe react-native-maps loader.
 *
 * react-native-maps is a native module that is NOT bundled in Expo Go — it
 * only exists in a development/production build (the app's `android/` project
 * compiles it in). Importing/mounting it inside Expo Go crashes the whole app
 * back to the Expo Go home screen.
 *
 * This module:
 *   1. Detects Expo Go via `Constants.executionEnvironment === 'storeClient'`.
 *   2. Requires react-native-maps inside a try/catch so a missing native part
 *      can never throw at import time.
 *   3. Exposes `MapsAvailable` so screens can render the real map in a dev
 *      build and a graceful placeholder in Expo Go.
 *
 * In a real dev/prod build everything below resolves to the actual library and
 * the maps work exactly as before.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { MapPin } from 'lucide-react-native';
import { Colors } from '@/utils/colors';

// 'storeClient' = Expo Go. Dev/prod builds report 'standalone' / 'bare'.
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

let RNMaps: any = null;
if (!isExpoGo) {
  try {
    // Only touch the native module outside Expo Go.
    RNMaps = require('react-native-maps');
  } catch {
    RNMaps = null;
  }
}

export const MapsAvailable: boolean = !!RNMaps?.default;

export const MapView: any = RNMaps?.default ?? null;
export const Marker: any = RNMaps?.Marker ?? null;
export const Callout: any = RNMaps?.Callout ?? null;
export const PROVIDER_GOOGLE: any = RNMaps?.PROVIDER_GOOGLE ?? undefined;

/**
 * Placeholder shown in Expo Go (or any environment without the native map).
 */
export const MapUnavailable: React.FC<{ height?: number; note?: string }> = ({
  height = 260,
  note,
}) => (
  <View style={[styles.wrap, { height }]}>
    <MapPin size={28} color={Colors.primary} />
    <Text style={styles.title}>Map needs a development build</Text>
    <Text style={styles.note}>
      {note ||
        'The interactive map isn’t available in Expo Go. Run a dev build (npx expo run:android) to use it.'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    paddingHorizontal: 24,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  note: {
    fontSize: 12,
    color: Colors.neutralGrayDark,
    textAlign: 'center',
    lineHeight: 17,
  },
});
