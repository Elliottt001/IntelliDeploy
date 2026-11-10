import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

type Draft = { content: string; operationId: string };
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation, operation);
  pending = result.catch(() => {});
  return result;
}
async function read(key: string): Promise<Draft | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value.content === 'string' && typeof value.operationId === 'string' ? value : null;
  } catch { return null; }
}
export const readDraft = (key: string) => serialize(() => read(key));
export const saveDraft = (key: string, content: string) => serialize(async () => {
  const previous = await read(key);
  if (previous?.content === content) return previous;
  const draft = { content, operationId: randomUUID() };
  await AsyncStorage.setItem(key, JSON.stringify(draft));
  return draft;
});
export const clearDraft = (key: string, operationId: string) => serialize(async () => {
  if ((await read(key))?.operationId === operationId) await AsyncStorage.removeItem(key);
});
