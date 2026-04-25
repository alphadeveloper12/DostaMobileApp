/**
 * Identical logic to web menuSlice.ts.
 * import.meta.env replaced by Constants.expoConfig.extra.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import Constants from 'expo-constants';
import { getAuthToken } from '@/utils/storage';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) || (Constants.manifest as any)?.extra?.apiUrl || 'https://dosta.cloud';

export const fetchMenuByDay: any = createAsyncThunk(
  'menu/fetchMenuByDay',
  async (day: string, { rejectWithValue }) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${BASE_URL}/api/vending/menu/${day}`, {
        method: 'GET',
        headers: authToken ? { Authorization: `Token ${authToken}` } : {},
      });

      if (!response.ok) {
        const errorText = await response.text();
        return rejectWithValue(errorText || 'Failed to fetch menu');
      }

      const data = await response.json();
      const allItems = data?.menus?.flatMap((menu: any) => menu.items) ?? [];
      return allItems;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

const menuSlice = createSlice({
  name: 'menu',
  initialState: {
    foodData: [] as any[],
    isLoading: false,
    error: null as string | null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMenuByDay.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMenuByDay.fulfilled, (state, action) => {
        state.isLoading = false;
        state.foodData = action.payload;
      })
      .addCase(fetchMenuByDay.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || 'Failed to fetch menu';
      });
  },
});

export default menuSlice.reducer;
