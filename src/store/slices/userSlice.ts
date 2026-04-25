/**
 * Identical logic to web userSlice.ts.
 * localStorage/sessionStorage replaced by storage utility.
 * Initial state starts as null — hydrated asynchronously via
 * store/hydrateStore.ts on app launch.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { setUser as persistUser, removeUser, removeAuthToken } from '@/utils/storage';

interface UserState {
  user: any | null;
}

const initialState: UserState = {
  user: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<any>) => {
      state.user = action.payload;
      persistUser(action.payload);
    },
    clearUser: (state) => {
      state.user = null;
      removeUser();
      removeAuthToken();
    },
    hydrateUser: (state, action: PayloadAction<any | null>) => {
      state.user = action.payload;
    },
  },
});

export const { setUser, clearUser, hydrateUser } = userSlice.actions;
export default userSlice.reducer;
