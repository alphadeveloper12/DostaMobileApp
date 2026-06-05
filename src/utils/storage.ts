/**
 * Unified storage utility that mirrors the web app's
 * localStorage / sessionStorage API surface.
 *
 * Tokens are stored in SecureStore (encrypted).
 * All other data (user, cart, etc.) goes to AsyncStorage.
 *
 * All methods are async — callers must await them.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Keys that live in SecureStore (sensitive)
const SECURE_KEYS = new Set(['authToken']);

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (SECURE_KEYS.has(key)) {
        // Prefer SecureStore, but fall back to AsyncStorage. On some
        // devices/builds SecureStore can throw or return null even after a
        // successful write (keystore quirks, value-size limits, missing native
        // module). Without this fallback getAuthToken() returns null after a
        // valid login, which bounces logged-in users back to SignIn.
        try {
          const secure = await SecureStore.getItemAsync(key);
          if (secure != null) return secure;
        } catch {
          // fall through to AsyncStorage
        }
        return await AsyncStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (SECURE_KEYS.has(key)) {
      // Best-effort secure write; mirror to AsyncStorage so the value is always
      // retrievable even if SecureStore silently fails. Mirrors the web's
      // posture (it keeps the auth token in localStorage).
      let secureOk = false;
      try {
        await SecureStore.setItemAsync(key, value);
        secureOk = true;
      } catch {
        secureOk = false;
      }
      try {
        if (!secureOk) await AsyncStorage.setItem(key, value);
      } catch {
        // silent
      }
      return;
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // silent
    }
  },

  async removeItem(key: string): Promise<void> {
    if (SECURE_KEYS.has(key)) {
      // Clear from both stores so logout fully tears down the session.
      try { await SecureStore.deleteItemAsync(key); } catch { /* silent */ }
      try { await AsyncStorage.removeItem(key); } catch { /* silent */ }
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // silent
    }
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJSON(key: string, value: unknown): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  },
};

// Convenience helpers matching the web app's exact key names
export const getAuthToken = () => storage.getItem('authToken');
export const setAuthToken = (token: string) => storage.setItem('authToken', token);
export const removeAuthToken = () => storage.removeItem('authToken');

export const getUser = () => storage.getJSON<any>('user');
export const setUser = (user: any) => storage.setJSON('user', user);
export const removeUser = () => storage.removeItem('user');

export const getGuestCart = () => storage.getJSON<any>('guestCart');
export const setGuestCart = (cart: any) => storage.setJSON('guestCart', cart);
export const removeGuestCart = () => storage.removeItem('guestCart');

export const getSelectedLocation = () => storage.getJSON<any>('selectedLocation');
export const setSelectedLocation = (loc: any) => storage.setJSON('selectedLocation', loc);

export const getOrderData = () => storage.getJSON<any>('orderData');
export const setOrderData = (data: any) => storage.setJSON('orderData', data);

export const getSweetsDeliveryInfo = () => storage.getJSON<any>('sweetsDeliveryInfo');
export const setSweetsDeliveryInfo = (info: any) => storage.setJSON('sweetsDeliveryInfo', info);

export const getPendingCateringOrder = () => storage.getJSON<any>('pendingCateringOrder');
export const setPendingCateringOrder = (order: any) => storage.setJSON('pendingCateringOrder', order);
export const removePendingCateringOrder = () => storage.removeItem('pendingCateringOrder');

// Beit Nahla — mirrors web's dedicated localStorage keys. The vending backend
// has no FK for BEIT_NAHLA boxes, so we keep the selected boxes client-side
// and the cart merges them in on load (same approach as the web app).
export const getBeitNahlaCart = () => storage.getJSON<any>('beitNahlaCart');
export const setBeitNahlaCart = (cart: any) => storage.setJSON('beitNahlaCart', cart);
export const removeBeitNahlaCart = () => storage.removeItem('beitNahlaCart');

export const getBeitNahlaDeliveryInfo = () => storage.getJSON<any>('beitNahlaDeliveryInfo');
export const setBeitNahlaDeliveryInfo = (info: any) => storage.setJSON('beitNahlaDeliveryInfo', info);
export const removeBeitNahlaDeliveryInfo = () => storage.removeItem('beitNahlaDeliveryInfo');

export const getMachineGoodsCache = (serialNumber: string) =>
  storage.getJSON<any>(`machine_goods_${serialNumber}`);
export const setMachineGoodsCache = (serialNumber: string, data: any) =>
  storage.setJSON(`machine_goods_${serialNumber}`, data);

export const getPickupCodes = (orderId: number) =>
  storage.getJSON<Record<string, string>>(`pickup_codes_${orderId}`);
export const setPickupCodes = (orderId: number, codes: Record<string, string>) =>
  storage.setJSON(`pickup_codes_${orderId}`, codes);
