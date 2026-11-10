import { platformRequest } from './client';
export const exchangeIdentity = (code: string) => platformRequest<{ user_id: string }>('/api/capabilities/identity/exchange', { method: 'POST', body: JSON.stringify({ code }) });
