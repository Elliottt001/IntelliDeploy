import { type components } from '@intellideploy/api-client';
export type AppSummary = components['schemas']['AppSummary'];
export type PublicationSummary = components['schemas']['PublicationPage']['items'][number];
export type LibraryKind = 'favorites' | 'recent';
export const parseLibraryKind = (raw: unknown): LibraryKind => raw === 'favorites' || raw === 'recent' ? raw : 'recent';
export const partitionApps = (items: AppSummary[]) => ({
  created: items.filter(item => !item.source_version_id),
  copies: items.filter(item => Boolean(item.source_version_id)),
});
export function getAppStatusLabel(app: AppSummary) {
  if (app.active_job_id) return '正在处理需求';
  if (app.instance_status === 'RUNNING') return '应用正在运行';
  if (app.instance_status === 'STOPPED') return '应用已停止，数据仍保留';
  if (app.instance_status === 'FAILED') return '应用暂不可用';
  return '查看状态与结果';
}
