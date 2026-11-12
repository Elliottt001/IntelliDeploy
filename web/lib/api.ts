import { createApiClient } from '@intellideploy/api-client';

export type AlgorithmMode = 'baseline' | 'shadow' | 'hybrid';
export const api = createApiClient({ baseUrl: '' });
