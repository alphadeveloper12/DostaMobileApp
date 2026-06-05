/**
 * Identical logic to web cartSlice.ts.
 * localStorage replaced by storage utility (AsyncStorage + SecureStore).
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import Constants from 'expo-constants';
import {
  getAuthToken,
  getGuestCart,
  removeGuestCart,
  getBeitNahlaCart,
  removeBeitNahlaCart,
} from '@/utils/storage';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) || (Constants.manifest as any)?.extra?.apiUrl || 'https://dosta.cloud';

// Beit Nahla items live entirely on the client: the vending CartItem model has
// no FK for BEIT_NAHLA boxes, so they can't be persisted server-side without a
// migration. We keep them in a separate key and merge them into the cart's
// items array on every load (identical to web cartSlice.ts).
const readBeitNahlaItems = async (): Promise<any[]> => {
  try {
    const parsed = await getBeitNahlaCart();
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
};

// Merge Beit Nahla items into a cart payload, deduped by plan_type + id.
const mergeBeitNahla = (base: any, beitNahlaItems: any[]) => {
  const result = base || { items: [], total_price: '0.00' };
  const seen = new Set(
    (result.items || []).map(
      (i: any) => `${i.plan_type || ''}:${i.menu_item?.id || i.id}`,
    ),
  );
  for (const bn of beitNahlaItems) {
    const k = `${bn.plan_type || 'BEIT_NAHLA'}:${bn.menu_item?.id || bn.id}`;
    if (!seen.has(k)) {
      result.items = [...(result.items || []), bn];
      seen.add(k);
    }
  }
  return result;
};

export const fetchCartData: any = createAsyncThunk(
  'cart/fetchCartData',
  async (_, { rejectWithValue }) => {
    try {
      const token = await getAuthToken();
      const beitNahlaItems = await readBeitNahlaItems();

      if (!token) {
        const localCart = await getGuestCart();
        const base = localCart || { items: [], total_price: '0.00' };
        return mergeBeitNahla(base, beitNahlaItems);
      }

      const res = await axios.get(`${BASE_URL}/api/vending/cart/`, {
        headers: { Authorization: `Token ${token}` },
      });
      return mergeBeitNahla(res.data || { items: [] }, beitNahlaItems);
    } catch (err: any) {
      console.error('Error fetching cart from API', err);
      return rejectWithValue(err.response?.data || 'Failed to fetch cart');
    }
  },
);

interface CartState {
  items: any[];
  totalQuantity: number;
  loading: boolean;
  error: string | null;
}

const initialState: CartState = {
  items: [],
  totalQuantity: 0,
  loading: false,
  error: null,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearCart: (state) => {
      state.items = [];
      state.totalQuantity = 0;
      state.error = null;
      removeGuestCart();
      removeBeitNahlaCart();
    },
    syncLocalCart: (state, action: PayloadAction<any[]>) => {
      // PURE Redux update only. AsyncStorage persistence is the caller's job
      // — having the reducer fire its own write created a race with explicit
      // `setGuestCart(payload)` calls (the empty-items write could land last
      // and silently wipe the cart). The Immer draft is also invalid by the
      // time the `.then()` callback fires, which made the side effect even
      // more fragile.
      state.items = action.payload;
      state.totalQuantity = action.payload.reduce(
        (acc: number, item: any) => acc + (item.quantity || 1),
        0,
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCartData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCartData.fulfilled, (state, action) => {
        state.loading = false;
        const apiCart = action.payload;
        state.items = apiCart?.items || [];
        state.totalQuantity =
          state.items.length > 0
            ? state.items.reduce(
                (acc: number, item: any) => acc + (item.quantity || 1),
                0,
              )
            : 0;
      })
      .addCase(fetchCartData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCart, syncLocalCart } = cartSlice.actions;

export const selectTotalCartItems = (state: any) => state.cart.totalQuantity;
export const selectCartLoading = (state: any) => state.cart.loading;

export default cartSlice.reducer;
