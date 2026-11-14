import type {components} from '@intellideploy/api-client';

type Schema = components['schemas'];
export const visualStamp = '2026-11-10T00:00:00Z';
export const visualPrompt = '创建一个可以保存和查看笔记的应用';
export const visualProductApps: Schema['AppSummary'][] = ['笔记工具', '待办清单', '日程助手', '资料归档', '费用记录'].map((name, index) => ({
 id: `product-${index + 1}`, name, updated_at: visualStamp, active_job_id: null, instance_status: null, source_version_id: null,
}));
export const visualJobStates = [
 [48, 'QUEUED', 'clarifying'], [49, 'RUNNING', 'clarifying'], [50, 'RUNNING', 'retrieving'],
 [51, 'RUNNING', 'implementing'], [52, 'RUNNING', 'building'], [53, 'RUNNING', 'validating'],
 [54, 'RUNNING', 'deploying'], [55, 'RUNNING', 'building'], [58, 'SUCCEEDED', 'verifying_live'],
] as const satisfies readonly (readonly [number, Schema['JobStatus'], string])[];

export const visualPublication = (id: string): Schema['PublicationResponse'] => ({
 id, app_id: `app-${id}`, instance_id: `instance-${id}`, version_id: 'fixture-v1',
 name: '笔记工具', summary: '保存和查看笔记', features: ['保存笔记', '查看笔记'], creator: '示例开发者',
 preview_url: null, url: null, available: true, payer_policy: 'VISITOR', sponsor_period: 'DAY',
 sponsor_limit_units: 10, copy_url: `/api/publications/${id}/copies`, updated_at: visualStamp,
});
// Public API test scenarios: locally served preview, absent preview, and failed preview.
export const visualStorePublications: Schema['PublicationResponse'][] = [
 {...visualPublication('notes'), preview_url: 'http://127.0.0.1:9199/fixture/notes-preview.svg'},
 {...visualPublication('checklist'), name: '待办清单', summary: '记录和完成待办事项', features: ['管理待办'], available: false},
 {...visualPublication('archive'), name: '资料归档', summary: '', features: [], preview_url: 'http://127.0.0.1:9199/fixture/missing-preview.png'},
];
export const visualCommunityPublications: Schema['PublicationResponse'][] = [
 {...visualPublication('one'), available: false},
 {...visualPublication('two'), name: '待办清单', summary: '记录和完成待办事项', features: ['管理待办'], available: false},
 {...visualPublication('three'), name: '日程助手', summary: '整理个人日程', features: ['查看日程'], available: false},
 {...visualPublication('featured'), name: '资料归档', summary: '保存和查找资料', features: ['保存资料', '查找资料']},
];
// No popularity metrics are invented: the screen orders these by updated_at.
export const visualRankingPublications: Schema['PublicationResponse'][] = visualStorePublications.map((publication, index) => ({
 ...publication, id: `ranking-${index + 1}`, copy_url: `/api/publications/ranking-${index + 1}/copies`,
 updated_at: new Date(Date.parse(visualStamp) - index * 86400000).toISOString(),
}));

// Hand-authored conversation mocks exercise actual public text fields. No design text extraction,
// dependency/version claims, synthetic list protocol, or status-to-message runtime generation.
const conversationReplies: Record<number, string> = {
 49: '已收到笔记应用的需求。',
 50: '笔记需要支持保存和查看。\n示例数据保存在本地浏览器中。',
 51: '准备笔记输入和查看界面。\n本地夹具不会调用生成服务。',
 52: '本地测试会话：\n应用用于保存和查看笔记。\n交付地址将在任务完成后提供。',
 53: '本地测试会话：\n请检查笔记的保存和查看流程。\n外部验收未运行。',
 54: '本地测试会话：\n使用回环地址打开示例应用。\n没有生产环境发布。',
 55: '本地测试会话：\n笔记输入框用于记录内容。\n保存按钮写入浏览器存储。\n再次打开可查看已保存笔记。\n任务仍在进行中。',
 58: '本地夹具已交付。\n打开应用可以保存和查看笔记。\n交付报告和制品使用回环地址。\n没有执行真实生成或生产发布。\n外部验收未运行。',
};
export function makeVisualApp(number: number, status: Schema['JobStatus'], phase: string): Schema['AppDetail'] {
 const delivery: Schema['DeliveryResult'] | null = status === 'SUCCEEDED' ? {
  kind: 'HOSTED_INSTANCE',
  app_id: 'app', version_id: 'fixture-v1', instance_id: 'fixture-instance', url: 'http://127.0.0.1:9199/fixture/app',
  summary: '本地夹具：保存和查看笔记', features: ['保存笔记', '查看笔记'],
  report_url: 'http://127.0.0.1:9199/fixture/report', artifact_url: 'http://127.0.0.1:9199/fixture/artifact', published_at: visualStamp,
 } : null;
 const job: Schema['JobSnapshot'] = {
  id: 'job', app_id: 'app', kind: 'GENERATE', status, phase, usage_units: 10, event_cursor: 0,
  question: null, result: delivery, error: null, created_at: visualStamp, updated_at: visualStamp,
 };
 const active = status === 'SUCCEEDED' ? null : job;
 const reply = conversationReplies[number];
 return {
  id: 'app', name: '笔记工具', updated_at: visualStamp, active_job_id: active?.id ?? null, active_job: active,
  latest_job: job, instance_status: delivery ? 'RUNNING' : null, candidate_version_id: null,
  requirement: {prompt: visualPrompt, acceptance: [], revision: 1, facts: [], source_message_ids: []},
  conversation: [
   {id: 'message', sequence: 1, role: 'user', content: visualPrompt, created_at: visualStamp},
   ...(reply ? [{id: 'assistant', sequence: 2, role: 'assistant' as const, content: reply, created_at: visualStamp}] : []),
  ], delivery,
 };
}
