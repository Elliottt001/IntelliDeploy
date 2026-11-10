import { beforeEach, expect, test, vi } from 'vitest';

const stores = vi.hoisted(() => ({ legacy: new Map<string, string>(), secure: new Map<string, string>(), platform: { OS: 'ios' }, failSecure: false }));
vi.mock('react-native', () => ({ Platform: stores.platform }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => stores.legacy.get(key) ?? null,
  setItem: async (key: string, value: string) => { stores.legacy.set(key, value); },
  removeItem: async (key: string) => { stores.legacy.delete(key); },
} }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => stores.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { if (stores.failSecure) throw new Error('unavailable'); stores.secure.set(key, value); },
  deleteItemAsync: async (key: string) => { stores.secure.delete(key); },
}));
beforeEach(() => { stores.legacy.clear(); stores.secure.clear(); stores.platform.OS = 'ios'; stores.failSecure = false; vi.resetModules(); });

test('native login migrates the old token only after storing it securely', async () => {
  stores.legacy.set('token', 'old-token');
  const { authStorage } = await import('../services/authStorage');
  expect(await authStorage.getToken()).toBe('old-token');
  expect(stores.secure.get('token')).toBe('old-token');
  expect(stores.legacy.has('token')).toBe(false);
});

test('a failed secure migration preserves the old token for a later retry', async () => {
  stores.legacy.set('token', 'old-token'); stores.failSecure = true;
  const { authStorage } = await import('../services/authStorage');
  await expect(authStorage.getToken()).rejects.toThrow('unavailable');
  expect(stores.legacy.get('token')).toBe('old-token');
  stores.failSecure = false;
  expect(await authStorage.getToken()).toBe('old-token');
});

test('logout racing migration leaves neither a secure nor a legacy token', async () => {
  stores.legacy.set('token', 'old-token');
  const { authStorage } = await import('../services/authStorage');
  await Promise.all([authStorage.getToken(), authStorage.clearToken()]);
  expect(await authStorage.getToken()).toBeNull();
  expect(stores.legacy.has('token')).toBe(false);
  expect(stores.secure.has('token')).toBe(false);
});

test('browser preview uses its own storage adapter and never invokes native secure storage', async () => {
  stores.platform.OS = 'web'; stores.failSecure = true;
  const { authStorage } = await import('../services/authStorage');
  await authStorage.setToken('preview-token');
  expect(await authStorage.getToken()).toBe('preview-token');
  expect(stores.secure.size).toBe(0);
  await authStorage.clearToken();
  expect(await authStorage.getToken()).toBeNull();
});
