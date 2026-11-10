import { beforeEach, expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({ data: new Map<string, string>(), nextId: 0 }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => state.data.get(key) ?? null,
  setItem: async (key: string, value: string) => { state.data.set(key, value); },
  removeItem: async (key: string) => { state.data.delete(key); },
} }));
vi.mock('expo-crypto', () => ({ randomUUID: () => `operation-${++state.nextId}` }));
beforeEach(() => { state.data.clear(); state.nextId = 0; vi.resetModules(); });

test('an uncertain request keeps the same content and idempotency key across restarts', async () => {
  let storage = await import('../services/workspaceStorage');
  const saved = await storage.saveDraft('user:1:create', '记录梦境');
  vi.resetModules();
  storage = await import('../services/workspaceStorage');
  expect(await storage.readDraft('user:1:create')).toEqual({ content: '记录梦境', operationId: 'operation-1' });
  expect(await storage.saveDraft('user:1:create', '记录梦境')).toEqual(saved);
});

test('editing a draft gets a new key and completion of an older request cannot erase it', async () => {
  const storage = await import('../services/workspaceStorage');
  const old = await storage.saveDraft('user:1:app', '记录');
  const current = await storage.saveDraft('user:1:app', '记录并分析');
  await storage.clearDraft('user:1:app', old.operationId);
  expect(await storage.readDraft('user:1:app')).toEqual(current);
  await storage.clearDraft('user:1:app', current.operationId);
  expect(await storage.readDraft('user:1:app')).toBeNull();
});

test('concurrent edits are persisted in order and different users keep separate drafts', async () => {
  const storage = await import('../services/workspaceStorage');
  await Promise.all([storage.saveDraft('user:1:create', '旧内容'), storage.saveDraft('user:1:create', '新内容'), storage.saveDraft('user:2:create', '另一账号')]);
  expect((await storage.readDraft('user:1:create'))?.content).toBe('新内容');
  expect((await storage.readDraft('user:2:create'))?.content).toBe('另一账号');
});
