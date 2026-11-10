import { platformRequest } from './client';
export const askAI = (messages: Array<{ role: string; content: string }>, operationId: string) => platformRequest<{ content: string }>('/api/capabilities/ai/chat', { method: 'POST', body: JSON.stringify({ messages, operation_id: operationId }) });
