/**
 * Identical logic to web vendingLocationsSlice.ts.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import Constants from 'expo-constants';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) || (Constants.manifest as any)?.extra?.apiUrl || 'https://dosta.cloud';

export const fetchLocations: any = createAsyncThunk(
  'vendingLocations/fetchLocations',
  async () => {
    const response = await fetch(`${BASE_URL}/api/vending/locations/`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  },
);

const vendingLocationsSlice = createSlice({
  name: 'vendingLocations',
  initialState: {
    locations: [] as any[],
    status: 'idle' as 'idle' | 'loading' | 'succeeded' | 'failed',
    error: null as string | null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLocations.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchLocations.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.locations = action.payload;
      })
      .addCase(fetchLocations.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? null;
      });
  },
});

export default vendingLocationsSlice.reducer;

export const selectAllLocations = (state: any) => state.vendingLocations.locations;
export const getLocationsStatus = (state: any) => state.vendingLocations.status;
export const getLocationsError = (state: any) => state.vendingLocations.error;
