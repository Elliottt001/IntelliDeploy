import { platformRequest } from './client';
export const fileMetadata = (fileId: string) => platformRequest<{ id: string; name: string }>(`/api/capabilities/files/${encodeURIComponent(fileId)}`);
