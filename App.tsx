import './src/global.css';

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useDispatch } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { store } from '@/store/store';
import { fetchCartData } from '@/store/slices/cartSlice';
import RootNavigator from '@/navigation/RootNavigator';

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
      <Toast />
    </>
  );
};

export default function App() {
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
