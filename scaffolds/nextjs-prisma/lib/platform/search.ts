import { platformRequest } from './client';
export const searchWeb = (query: string, operationId: string) => platformRequest<Array<{ title: string; url: string }>>('/api/capabilities/search', { method: 'POST', body: JSON.stringify({ query, operation_id: operationId }) });
