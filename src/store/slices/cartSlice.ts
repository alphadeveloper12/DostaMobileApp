/**
 * Identical logic to web cartSlice.ts.
 * localStorage replaced by storage utility (AsyncStorage + SecureStore).
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import Constants from 'expo-constants';
import { getAuthToken, getGuestCart, setGuestCart, removeGuestCart } from '@/utils/storage';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) || (Constants.manifest as any)?.extra?.apiUrl || 'https://dosta.cloud';

export const fetchCartData: any = createAsyncThunk(
  'cart/fetchCartData',
  async (_, { rejectWithValue }) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        const localCart = await getGuestCart();
        if (localCart) return localCart;
        return { items: [], total_price: '0.00' };
      }

      const res = await axios.get(`${BASE_URL}/api/vending/cart/`, {
        headers: { Authorization: `Token ${token}` },
      });
      return res.data;
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
    },
    syncLocalCart: (state, action: PayloadAction<any[]>) => {
      state.items = action.payload;
      state.totalQuantity = action.payload.reduce(
        (acc: number, item: any) => acc + (item.quantity || 1),
        0,
      );
      // Persist guest cart to AsyncStorage (async, fire-and-forget)
      getAuthToken().then((token) => {
        if (!token) {
          getGuestCart().then((existing) => {
            const updated = { ...(existing || {}), items: state.items };
            setGuestCart(updated);
          });
        }
      });
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
