import { afterEach, expect, test, vi } from 'vitest';
import { ApiError, type components } from '@intellideploy/api-client';
import { shouldPoll, subscribeJob } from '../services/jobPolling';

type Snapshot = components['schemas']['JobSnapshot'];
const snapshot = (status: Snapshot['status']): Snapshot => ({ id: 'job', app_id: 'app', kind: 'GENERATE', status, phase: 'clarifying', event_cursor: 0, usage_units: 0, result: null, error: null, question: null, created_at: '2026-11-10T00:00:00Z', updated_at: '2026-11-10T00:00:00Z' });
function lifecycle() {
  let listener: (state: string) => void = () => {};
  const source = { currentState: 'active', addEventListener: (_event: string, fn: typeof listener) => { listener = fn; return { remove: () => { listener = () => {}; } }; } };
  return { source, change(state: string) { source.currentState = state; listener(state); } };
}
afterEach(() => vi.useRealTimers());

test('only queued and running jobs poll while the app is active', () => {
  expect(shouldPoll('QUEUED', 'active')).toBe(true);
  expect(shouldPoll('RUNNING', 'active')).toBe(true);
  for (const state of ['background', 'inactive']) expect(shouldPoll('RUNNING', state)).toBe(false);
  for (const status of ['WAITING_USER', 'PAUSED_QUOTA', 'FAILED', 'CANCELLED', 'SUCCEEDED']) expect(shouldPoll(status, 'active')).toBe(false);
});

test('background aborts a read, foreground immediately reloads the same job, unsubscribe stops updates', async () => {
  vi.useFakeTimers();
  const app = lifecycle();
  const seen: Snapshot[] = [];
  const readJob = vi.fn(async (_id: string, signal?: AbortSignal) => {
    if (readJob.mock.calls.length === 1) return new Promise<Snapshot>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    return snapshot('RUNNING');
  });
  const stop = subscribeJob('job', value => { seen.push(value); }, { readJob, appState: app.source });
  expect(readJob).toHaveBeenCalledTimes(1);
  app.change('background');
  await vi.advanceTimersByTimeAsync(10000);
  expect(seen).toHaveLength(0);
  app.change('active');
  await vi.advanceTimersByTimeAsync(0);
  expect(readJob).toHaveBeenLastCalledWith('job', expect.any(AbortSignal));
  expect(seen).toHaveLength(1);
  stop();
  await vi.advanceTimersByTimeAsync(10000);
  app.change('active');
  expect(readJob).toHaveBeenCalledTimes(2);
});

test('slow requests never overlap and a terminal snapshot ends polling', async () => {
  vi.useFakeTimers();
  let resolve!: (value: Snapshot) => void;
  const readJob = vi.fn(() => new Promise<Snapshot>(done => { resolve = done; }));
  const seen: Snapshot[] = [];
  const stop = subscribeJob('job', value => { seen.push(value); }, { readJob, appState: lifecycle().source });
  await vi.advanceTimersByTimeAsync(30000);
  expect(readJob).toHaveBeenCalledTimes(1);
  resolve(snapshot('FAILED'));
  await vi.advanceTimersByTimeAsync(30000);
  expect(seen[0].status).toBe('FAILED');
  expect(readJob).toHaveBeenCalledTimes(1);
  stop();
});

test('network failure backs off without inventing a failed job and recovers', async () => {
  vi.useFakeTimers();
  const onError = vi.fn();
  const seen: Snapshot[] = [];
  const readJob = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(snapshot('RUNNING'));
  const stop = subscribeJob('job', value => { seen.push(value); }, { readJob, appState: lifecycle().source, onError });
  await vi.advanceTimersByTimeAsync(3000);
  expect(readJob).toHaveBeenCalledTimes(1);
  expect(seen).toHaveLength(0);
  expect(onError).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3000);
  expect(seen[0].status).toBe('RUNNING');
  await vi.advanceTimersByTimeAsync(3000);
  expect(readJob).toHaveBeenCalledTimes(3);
  stop();
});

test('expired login stops polling and requests login without deleting the job', async () => {
  vi.useFakeTimers();
  const onUnauthorized = vi.fn();
  const onSnapshot = vi.fn();
  const readJob = vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', '请登录'));
  subscribeJob('job', onSnapshot, { readJob, appState: lifecycle().source, onUnauthorized });
  await vi.advanceTimersByTimeAsync(30000);
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
  expect(onSnapshot).not.toHaveBeenCalled();
  expect(readJob).toHaveBeenCalledTimes(1);
});

test('a network failure after an unknown running snapshot keeps that snapshot until a real terminal result', async () => {
  vi.useFakeTimers();
  const unknown = { ...snapshot('RUNNING'), phase: 'future_phase' };
  const seen: Snapshot[] = [];
  let reads = 0;
  const stop = subscribeJob('job', value => { seen.push(value); }, {
    appState: lifecycle().source,
    readJob: async () => {
      reads++;
      if (reads === 1) return unknown;
      if (reads === 2) throw new TypeError('offline');
      return snapshot('SUCCEEDED');
    },
  });
  await vi.advanceTimersByTimeAsync(3000);
  expect(seen).toEqual([unknown]);
  await vi.advanceTimersByTimeAsync(6000);
  expect(seen.map(value => value.status)).toEqual(['RUNNING', 'SUCCEEDED']);
  await vi.advanceTimersByTimeAsync(30000);
  expect(reads).toBe(3);
  stop();
});
