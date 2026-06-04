/**
 * Central axios instance + all API endpoint helpers.
 * Mirrors every endpoint used across the web app exactly.
 * Base URL: https://dosta.cloud
 */

import axios from 'axios';
import Constants from 'expo-constants';
import { getAuthToken } from '@/utils/storage';

// Hardcoded fallback guarantees connectivity even if Constants.expoConfig is undefined
export const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  (Constants.manifest as any)?.extra?.apiUrl ||
  'https://dosta.cloud';

// Shared axios instance
export const api = axios.create({ baseURL: BASE_URL });

// Attach auth token to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export const loginWithEmail = (email: string, password: string) =>
  api.post('/api/login/', { email, password });

export const loginWithGoogle = (payload: { access_token?: string; id_token?: string }) =>
  api.post('/api/google/', payload);

export const sendOtp = (phoneNumber: string) =>
  api.post('/api/send-otp/', { phoneNumber });

export const getProfile = () => api.get('/api/profile/');

export const updateProfile = (data: any) => api.put('/api/profile/', data);

// Permanent account deletion — required by Apple App Store guideline 5.1.1(v).
// `password` is only required for users with a local password (not Google OAuth).
export const deleteAccount = (payload: { confirmation: string; password?: string }) =>
  api.post('/api/delete-account/', payload);

// ─────────────────────────────────────────────
// VENDING — MENU
// ─────────────────────────────────────────────

export const getMenuByDay = (day: string) =>
  api.get(`/api/vending/menu/${day}`);

export const getWeeklyPlan = () =>
  api.get('/api/vending/menu/plan/WEEKLY/');

export const getOrderNowMenu = () =>
  api.get('/api/vending/menu/ORDER_NOW/');

// ─────────────────────────────────────────────
// VENDING — CART
// ─────────────────────────────────────────────

export const getCart = () => api.get('/api/vending/cart/');

export const postCart = (payload: {
  location_id: number;
  plan_type: string;
  plan_subtype: string;
  items: any[];
  clear_all?: boolean;
  delivery_address?: string;
  customer_phone?: string;
  city?: string;
  delivery_charge?: string;
}) => api.post('/api/vending/cart/', payload);

export const clearCartApi = () =>
  api.post('/api/vending/cart/', { clear_all: true });

// ─────────────────────────────────────────────
// VENDING — LOCATIONS
// ─────────────────────────────────────────────

export const getVendingLocations = () =>
  fetch(`${BASE_URL}/api/vending/locations`).then((r) => r.json());

// ─────────────────────────────────────────────
// VENDING — MACHINE (EXTERNAL)
// ─────────────────────────────────────────────

export const getMachineGoods = (machineUuid: string) =>
  fetch(
    `${BASE_URL}/api/vending/external/machine-goods/?machineUuid=${machineUuid}`,
  ).then((r) => r.json());

export const updateCommodity = (payload: {
  list: any[];
  machineUuid: number;
}) => api.put('/api/vending/external/update-commodity/', payload);

export const requestPickupCode = (payload: {
  goodsList: any[];
  goodsNumber: number;
  machineUuid: string;
  orderNo: string;
  orderTime: string;
  timeOut: number;
  lock: number;
}) =>
  fetch(`${BASE_URL}/api/vending/external/production-pick/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json());

// ─────────────────────────────────────────────
// VENDING — PAYMENT & ORDERS
// ─────────────────────────────────────────────

export const initiatePayment = (payload: {
  location_id?: number;
  delivery_address?: string;
  customer_phone?: string;
  city?: string;
  delivery_charge?: string;
}) => api.post('/api/vending/payment/initiate/', payload);

export const verifyPaymentCallback = (params: {
  order_id?: string;
  cart_id?: string;
}) => {
  const id = params.order_id
    ? `order_id=${params.order_id}`
    : `order_id=CART-${params.cart_id}`;
  return api.get(`/api/vending/payment/callback/?${id}`);
};

export const confirmOrder = (payload: any) =>
  api.post('/api/vending/order/confirm/', payload);

export const getOrders = () => api.get('/api/vending/orders/');

export const retryFulfillment = (orderId: number) =>
  api.post(`/api/vending/order/${orderId}/retry-fulfillment/`, {});

export const updatePickupCode = (orderId: number, pickupCode: string) =>
  api.post('/api/vending/order/update-pickup-code/', {
    order_id: orderId,
    pickup_code: pickupCode,
  });

// ─────────────────────────────────────────────
// CATERING
// ─────────────────────────────────────────────

export const createCateringOrder = (payload: any) =>
  fetch(`${BASE_URL}/api/catering/orders/create/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Token attached by caller if needed — or extend interceptor
    },
    body: JSON.stringify(payload),
  }).then((r) => r.json());

export const initiateCateringPayment = (payload: any) =>
  api.post('/api/catering/payment/initiate/', payload);

// ─────────────────────────────────────────────
// CHATBOT
// ─────────────────────────────────────────────

export const sendChatMessage = async (message: string): Promise<string> => {
  const response = await fetch(`${BASE_URL}/api/chatbot/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to get response from AI');
  }
  const data = await response.json();
  return data.reply;
};
