/**
 * Called once on app launch (before navigation renders).
 * Reads persisted user from AsyncStorage and hydrates the Redux store.
 * This replaces the web's synchronous localStorage read in the slice initialState.
 */

import { store } from './store';
import { hydrateUser } from './slices/userSlice';
import { getUser } from '@/utils/storage';

export async function hydrateStore(): Promise<void> {
  const user = await getUser();
  store.dispatch(hydrateUser(user));
}
