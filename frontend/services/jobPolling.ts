import { ApiError, type components } from '@intellideploy/api-client';

type Snapshot = components['schemas']['JobSnapshot'];
type PollingOptions<T> = {
  readJob: (jobId: string, signal?: AbortSignal) => Promise<T>;
  appState: { currentState: string | null; addEventListener(event: 'change', listener: (state: string) => void): { remove(): void } };
  onError?: (error: unknown) => void;
  onUnauthorized?: () => void;
};

export function shouldPoll(status: string, appState: string | null): boolean {
  return appState === 'active' && ['QUEUED', 'RUNNING'].includes(status);
}

export function subscribeJob<T extends {status:string}=Snapshot>(jobId: string, onSnapshot: (snapshot: T, signal: AbortSignal) => void | Promise<void>, options: PollingOptions<T>) {
  let state = options.appState.currentState;
  let status = 'QUEUED';
  let stopped = false;
  let inFlight = false;
  let refreshPending = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
    listener.remove();
  };
  async function read() {
    if (stopped || state !== 'active') return;
    if (inFlight) { refreshPending = true; return; }
    clearTimeout(timer);
    inFlight = true;
    const request = new AbortController();
    controller = request;
    try {
      const value = await options.readJob(jobId, request.signal);
      if (stopped || request.signal.aborted) return;
      status = value.status;
      await onSnapshot(value, request.signal);
      failures = 0;
    } catch (error) {
      if (stopped || request.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) {
        stop();
        options.onUnauthorized?.();
        return;
      }
      failures++;
      options.onError?.(error);
    } finally {
      inFlight = false;
      controller = undefined;
      if (!stopped && state === 'active') {
        if (refreshPending) { refreshPending = false; void read(); }
        else if (shouldPoll(status, state) || failures > 0) timer = setTimeout(read, Math.min(3000 * 2 ** failures, 30000));
      }
    }
  }
  const listener = options.appState.addEventListener('change', next => {
    state = next;
    clearTimeout(timer);
    if (next === 'active') void read();
    else controller?.abort();
  });
  void read();
  return stop;
}
