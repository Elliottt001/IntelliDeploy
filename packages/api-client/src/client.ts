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
    getDiagnostics: (jobId: string, signal?: AbortSignal) => request<Schema['EvaluationRecord']>(`/api/jobs/${id(jobId)}/diagnostics`, 'GET', undefined, undefined, signal),
    listEvaluationTargets: () => request<Schema['EvaluationTarget'][]>('/api/evaluation/targets'),
    resumeJob: (jobId: string, operationId: string, budgetUnits?: number) => request<Schema['JobRef']>(`/api/jobs/${id(jobId)}/resume`, 'POST', { budget_units: budgetUnits }, operationId),
    cancelJob: (jobId: string, operationId: string) => request<Schema['JobRef']>(`/api/jobs/${id(jobId)}/cancel`, 'POST', undefined, operationId),
    listPublications: (cursor?: string) => request<Schema['PublicationPage']>('/api/community/apps'+(cursor?`?cursor=${id(cursor)}`:'')),
    getPublication: (publicationId: string) => request<Schema['PublicationResponse']>(`/api/publications/${id(publicationId)}`),
    publish: (appId: string, settings: Schema['PublishRequest']) => request<Schema['PublicationResponse']>(`/api/apps/${id(appId)}/publish`,'POST',settings),
    unpublish: (publicationId: string) => request<{ok:boolean}>(`/api/publications/${id(publicationId)}`,'DELETE'),
    createCopy: (publicationId: string, budgetUnits: number|undefined, operationId: string) => request<Schema['CreateAppResponse']>(`/api/publications/${id(publicationId)}/copies`,'POST',{budget_units:budgetUnits},operationId),
    listFavorites: (cursor?: string) => request<Schema['PublicationPage']>('/api/library/favorites'+(cursor?`?cursor=${id(cursor)}`:'')),
    listRecentApps: (cursor?: string) => request<Schema['PublicationPage']>('/api/library/recent'+(cursor?`?cursor=${id(cursor)}`:'')),
    setFavorite: (publicationId: string, enabled: boolean) => request<{ok:boolean}>(`/api/library/favorites/${id(publicationId)}`,enabled?'PUT':'DELETE'),
    recordUse: (publicationId: string) => request<Schema['PublicationResponse']>(`/api/publications/${id(publicationId)}/use`,'POST'),
    getInstance: (instanceId: string, signal?:AbortSignal) => request<Schema['InstanceSnapshot']>(`/api/instances/${id(instanceId)}`,'GET',undefined,undefined,signal),
    startInstance: (instanceId: string, operationId: string) => request<Schema['InstanceOperationResponse']>(`/api/instances/${id(instanceId)}/start`,'POST',undefined,operationId),
    stopInstance: (instanceId: string, operationId: string) => request<Schema['InstanceOperationResponse']>(`/api/instances/${id(instanceId)}/stop`,'POST',undefined,operationId),
    deleteInstance: (instanceId: string, deleteData: boolean, operationId: string) => request<Schema['InstanceOperationResponse']>(`/api/instances/${id(instanceId)}`,'DELETE',{confirmation:'DELETE',delete_data:deleteData},operationId),
    getInstanceOperation: (operationId: string, signal?:AbortSignal) => request<Schema['InstanceOperationResponse']>(`/api/instance-operations/${id(operationId)}`,'GET',undefined,undefined,signal),
    issueLoginCode: (instanceId: string, callback: string) => request<Schema['LoginCodeResponse']>(`/api/instances/${id(instanceId)}/login-code`,'POST',{callback}),
    getArtifactUrl: (appId: string, versionId: string) => base + artifact(appId, versionId),
    downloadArtifact: async (appId: string, versionId: string) => (await response(artifact(appId, versionId))).blob(),
    getPolicy: () => request<Schema['QuotaPolicy']>('/api/quota/policy'),
    getBalance: () => request<Schema['QuotaBalance']>('/api/quota/balance'),
    listUsage: (cursor?: string) => request<Schema['QuotaUsagePage']>('/api/quota/usage' + (cursor ? `?cursor=${id(cursor)}` : '')),
    listSkus: () => request<Schema['QuotaSku'][]>('/api/quota/skus'),
    listPublicSkus: () => request<Schema['QuotaSku'][]>('/api/catalog/skus'),
    getSubscription: () => request<Schema['SubscriptionInfo'] | null>('/api/quota/subscription'),
    createOrder: (skuId: string, provider: Schema['CreateOrderRequest']['provider'], operationId: string) => request<Schema['PaymentOrderInfo']>('/api/quota/orders', 'POST', { sku_id: skuId, provider }, operationId),
    getOrder: (orderId: string, signal?: AbortSignal) => request<Schema['PaymentOrderInfo']>(`/api/quota/orders/${id(orderId)}`, 'GET', undefined, undefined, signal),
    listOrders: () => request<Schema['PaymentOrderInfo'][]>('/api/quota/orders'),
    request,
  };
}
