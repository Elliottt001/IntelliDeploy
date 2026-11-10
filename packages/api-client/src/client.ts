import type { components } from './generated.js';

export type ClientOptions = {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) {
    super(message);
  }
}

type Schema = components['schemas'];

export function createApiClient(options: ClientOptions) {
  const base = options.baseUrl.replace(/\/$/, '');
  const transport = options.fetchImpl ?? fetch;
  async function response(path: string, method = 'GET', body?: unknown, operationId?: string, signal?: AbortSignal): Promise<Response> {
    const headers = new Headers();
    const token = await options.getToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (operationId) headers.set('Idempotency-Key', operationId);
    const result = await transport(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin', signal });
    if (!result.ok) {
      const error = await result.json().catch(() => null);
      throw new ApiError(result.status, error?.error?.code ?? 'REQUEST_FAILED', error?.error?.message ?? '请求失败', error?.error?.retryable ?? false);
    }
    return result;
  }
  async function request<T>(path: string, method = 'GET', body?: unknown, operationId?: string, signal?: AbortSignal): Promise<T> {
    return (await response(path, method, body, operationId, signal)).json();
  }
  const id = encodeURIComponent;
  const artifact = (appId: string, versionId: string) => `/api/apps/${id(appId)}/versions/${id(versionId)}/artifact`;
  return {
    createApp: (prompt: string, budgetUnits: number | undefined, operationId: string, evaluationTargetId?: string) => request<Schema['CreateAppResponse']>('/api/apps', 'POST', { prompt, budget_units: budgetUnits, evaluation_target_id: evaluationTargetId }, operationId),
    sendMessage: (appId: string, content: string, operationId: string, budgetUnits?: number) => request<Schema['JobRef']>(`/api/apps/${id(appId)}/messages`, 'POST', { content, budget_units: budgetUnits }, operationId),
    getApp: (appId: string, signal?: AbortSignal) => request<Schema['AppDetail']>(`/api/apps/${id(appId)}`, 'GET', undefined, undefined, signal),
    listMyApps: (cursor?: string) => request<Schema['AppPage']>('/api/apps' + (cursor ? `?cursor=${id(cursor)}` : '')),
    getJob: (jobId: string, signal?: AbortSignal) => request<Schema['JobSnapshot']>(`/api/jobs/${id(jobId)}`, 'GET', undefined, undefined, signal),
    getReport: (jobId: string) => request<Schema['JobReport']>(`/api/jobs/${id(jobId)}/report`),
    resumeJob: (jobId: string, operationId: string, budgetUnits?: number) => request<Schema['JobRef']>(`/api/jobs/${id(jobId)}/resume`, 'POST', { budget_units: budgetUnits }, operationId),
    cancelJob: (jobId: string, operationId: string) => request<Schema['JobRef']>(`/api/jobs/${id(jobId)}/cancel`, 'POST', undefined, operationId),
    getArtifactUrl: (appId: string, versionId: string) => base + artifact(appId, versionId),
    downloadArtifact: async (appId: string, versionId: string) => (await response(artifact(appId, versionId))).blob(),
    getPolicy: () => request<Schema['QuotaPolicy']>('/api/quota/policy'),
    getBalance: () => request<Schema['QuotaBalance']>('/api/quota/balance'),
    listUsage: (cursor?: string) => request<Schema['QuotaUsagePage']>('/api/quota/usage' + (cursor ? `?cursor=${id(cursor)}` : '')),
    listSkus: () => request<Schema['QuotaSku'][]>('/api/quota/skus'),
    getSubscription: () => request<Schema['SubscriptionInfo'] | null>('/api/quota/subscription'),
    request,
  };
}
