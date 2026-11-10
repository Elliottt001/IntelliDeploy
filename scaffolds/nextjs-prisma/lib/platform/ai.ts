import { platformRequest } from './client';
export const askAI = (messages: Array<{ role: string; content: string }>, operationId: string, userIdentity?:string, model=process.env.PLATFORM_MODEL??'deepseek-flash') => platformRequest<{ content: string }>('/api/capabilities/chat', { method: 'POST', body: JSON.stringify({ messages, model, operation_id: operationId }) },userIdentity);
