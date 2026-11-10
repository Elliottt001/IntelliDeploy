import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'token';
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation, operation);
  pending = result.catch(() => {});
  return result;
}

export const authStorage = {
  getToken: () => serialize(async () => {
    if (Platform.OS === 'web') return AsyncStorage.getItem(KEY);
    const current = await SecureStore.getItemAsync(KEY);
    if (current) { await AsyncStorage.removeItem(KEY); return current; }
    const legacy = await AsyncStorage.getItem(KEY);
    if (legacy) {
      await SecureStore.setItemAsync(KEY, legacy);
      await AsyncStorage.removeItem(KEY);
    }
    return legacy;
  }),
  setToken: (token: string) => serialize(async () => {
    if (Platform.OS === 'web') await AsyncStorage.setItem(KEY, token);
    else {
      await SecureStore.setItemAsync(KEY, token);
      await AsyncStorage.removeItem(KEY);
    }
  }),
  clearToken: () => serialize(async () => {
    const cleanup = [AsyncStorage.removeItem(KEY)];
    if (Platform.OS !== 'web') cleanup.push(SecureStore.deleteItemAsync(KEY));
    await Promise.all(cleanup);
  }),
};
