import './src/global.css';

// Side-effect import: monkey-patches RN's <Text> so every Text in the app
// reacts to language changes. MUST run before the first Text mounts.
import { installI18nTextPatch } from '@/utils/i18nText';
installI18nTextPatch();

import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useDispatch } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { store } from '@/store/store';
import { fetchCartData } from '@/store/slices/cartSlice';
import { initLang } from '@/utils/i18n';
import RootNavigator from '@/navigation/RootNavigator';
import { AppToastHost } from '@/components/common/AppToast';
import AppChatBot from '@/components/common/AppChatBot';

// ── Animated SVG path (react-native-svg + Animated API) ──────────────────────
const AnimatedPath = Animated.createAnimatedComponent(Path);

const DOSTA_PATH = 'M23.8235 11.8072C23.8235 5.29047 18.4901 0 11.9206 0H3.72628C1.67771 0 0 1.6467 0 3.69632V8.30358C0 10.3357 1.66005 11.9999 3.72628 11.9999H16.212C9.46582 11.9999 4.00885 17.3079 4.09715 23.9998H11.7087C18.4548 23.9998 23.9118 18.4991 23.8235 11.8072Z';

// Replicates the CSS sketch animation from animated-icon.svg:
//   0%→40%  stroke draws in (dashOffset 100→0)
//   40%→55% fill fades in
//   55%→85% hold
//   85%→100% screen fades out, then loops
const AppPreloader = ({ onDone }: { onDone: () => void }) => {
  const dashOffset  = useRef(new Animated.Value(100)).current;
  const fillOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    const runCycle = (isFirst: boolean) => {
      if (cancelled) return;
      dashOffset.setValue(100);
      fillOpacity.setValue(0);
      screenOpacity.setValue(1);

      Animated.sequence([
        // 0%→40% — stroke draws in (800 ms)
        Animated.timing(dashOffset, {
          toValue: 0, duration: 800,
          useNativeDriver: false,
        }),
        // 40%→55% — fill appears (300 ms)
        Animated.timing(fillOpacity, {
          toValue: 1, duration: 300,
          useNativeDriver: false,
        }),
        // 55%→85% — hold (600 ms)
        Animated.delay(600),
        // 85%→100% — fade out (300 ms)
        Animated.timing(screenOpacity, {
          toValue: 0, duration: 300,
          useNativeDriver: false,
        }),
        Animated.delay(100),
      ]).start(({ finished }) => {
        if (!cancelled && finished) {
          if (isFirst) onDone();   // signal App after first full cycle
          runCycle(false);
        }
      });
    };
    runCycle(true);
    return () => { cancelled = true; };
  }, []);

  return (
    <Animated.View style={[preloaderStyles.root, { opacity: screenOpacity }]}>
      <View style={preloaderStyles.iconWrap}>
        <Svg width={120} height={120} viewBox="0 0 34 34" fill="none">
          {/* Filled layer — fades in after stroke completes */}
          <AnimatedPath
            d={DOSTA_PATH}
            fill="#054A86"
            fillOpacity={fillOpacity}
          />
          {/* Stroke layer — draws in via dashOffset */}
          <AnimatedPath
            d={DOSTA_PATH}
            stroke="#054A86"
            strokeWidth={1.5}
            fill="none"
            strokeDasharray={100}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      </View>
    </Animated.View>
  );
};

const preloaderStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const queryClient = new QueryClient();

// Mirrors web GlobalCartSync — fetches cart from API on app mount
const GlobalCartSync = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    // @ts-ignore
    dispatch(fetchCartData());
  }, [dispatch]);
  return null;
};

const AppInner = () => {
  return (
    <>
      <GlobalCartSync />
      <RootNavigator />
      {/* Custom in-app toast — replaces react-native-toast-message whose
          auto-hide was broken on this RN/Expo version. The host owns its
          own state + setTimeout, so dismissal is fully under our control. */}
      <AppToastHost />
      {/* Sticky AI chat bot — mounted at root so the FAB is visible on every
          screen (mirrors web: ChatBot rendered once inside BrowserRouter). */}
      <AppChatBot />
    </>
  );
};

export default function App() {
  const [langReady, setLangReady]       = useState(false);
  const [preloaderDone, setPreloaderDone] = useState(false);

  useEffect(() => { initLang().finally(() => setLangReady(true)); }, []);

  // Show preloader until BOTH lang is ready AND one full animation cycle done
  const showPreloader = !langReady || !preloaderDone;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            {/* Render app beneath preloader so it's ready when preloader exits */}
            {langReady && <AppInner />}
            {showPreloader && (
              <AppPreloader onDone={() => setPreloaderDone(true)} />
            )}
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
