import './src/global.css';

// Side-effect import: monkey-patches RN's <Text> so every Text in the app
// reacts to language changes. MUST run before the first Text mounts.
import { installI18nTextPatch } from '@/utils/i18nText';
installI18nTextPatch();

import React, { useEffect, useState } from 'react';
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
  // Block the first render until the language preference + translation
  // cache have been hydrated from AsyncStorage. Without this, an Arabic
  // user briefly sees English on every cold start before strings flip.
  const [langReady, setLangReady] = useState(false);
  useEffect(() => { initLang().finally(() => setLangReady(true)); }, []);
  if (!langReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <AppInner />
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
