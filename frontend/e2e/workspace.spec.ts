import { expect, test } from '@playwright/test';
import type { components } from '@intellideploy/api-client';

const timestamp = '2026-11-10T00:00:00Z';
function detail(status: components['schemas']['JobStatus'] = 'WAITING_USER'): components['schemas']['AppDetail'] {
  const job: components['schemas']['JobSnapshot'] = { id: 'job', app_id: 'app', status, kind: 'ADJUST', phase: 'clarifying', usage_units: 10, event_cursor: 0, question: status === 'WAITING_USER' ? '记录是否公开？' : null, result: null, error: status === 'FAILED' ? { code: 'CHECK_FAILED', message: '本次调整未完成', retryable: false } : null, created_at: timestamp, updated_at: timestamp };
  return { id: 'app', name: '梦境记录', updated_at: timestamp, active_job_id: ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(status) ? null : 'job', instance_status: 'RUNNING', requirement: { prompt: '梦境记录', acceptance: [], revision: 1, facts: [], source_message_ids: [] }, conversation: [{ id: 'm1', sequence: 1, role: 'user', content: '记录并分析梦境', created_at: timestamp }], active_job: ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(status) ? null : job, latest_job: job, candidate_version_id: 'candidate', delivery: { kind: 'HOSTED_INSTANCE', app_id: 'app', version_id: 'old', instance_id: 'instance', url: 'https://fixture-app.example', summary: '原有梦境记录', features: ['保存记录'], report_url: '/api/jobs/old-job/report', artifact_url: '/api/apps/app/versions/old/artifact', published_at: timestamp } };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 1, username: 'owner', email: 'owner@test' } }));
  await page.route('**/api/quota/**', route => route.fulfill({ json: { available_units: 900, reserved_units: 100, default_budget_units: 100, hard_cap_units: 1000, price_version: 'fixture', failed_usage_rule: '失败按实际用量结算', items: [] } }));
});

test('a failed candidate preserves the old delivery and the persisted conversation after reload', async ({ page }) => {
  const app = detail('FAILED');
  await page.route('**/api/apps/app', route => route.fulfill({ json: app }));
  await page.route('**/api/jobs/job', route => route.fulfill({ json: app.latest_job }));
  await page.goto('/app-detail/app');
  await page.getByTestId('chatbot-settings').click(); await page.getByTestId('conversation-toggle').click();
  await expect(page.getByText('记录并分析梦境', { exact: true })).toBeVisible();
  await expect(page.getByText('本次调整未完成', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('open-app')).toBeVisible();
  await page.reload();
  await expect(page.getByText('原有梦境记录', { exact: true })).toBeVisible();
});

test('a draft and its request key survive a failed send and reload on the same app', async ({ page }) => {
  const app = detail();
  const keys: string[] = [];
  await page.route('**/api/apps/app', route => route.fulfill({ json: app }));
  await page.route('**/api/jobs/job', route => route.fulfill({ json: app.latest_job }));
  await page.route('**/api/apps/app/messages', async route => {
    keys.push(route.request().headers()['idempotency-key']);
    expect(route.request().postDataJSON()).toEqual({ content: '保持私有' });
    if (keys.length === 1) await route.abort();
    else await route.fulfill({ status: 202, json: { app_id: 'app', job_id: 'job', status: 'QUEUED' } });
  });
  await page.goto('/app-detail/app');
  await expect(page.getByText('记录是否公开？')).toBeVisible();
  await page.getByTestId('message-input').fill('保持私有');
  await page.getByTestId('send-message').click();
  await expect(page.getByTestId('workspace-error')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('message-input')).toHaveValue('保持私有');
  await page.getByTestId('send-message').click();
  await expect(page.getByTestId('message-input')).toHaveValue('');
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
});

test('create uses the persistent API and keeps the same app after leaving the screen', async ({ page }) => {
  const app = { ...detail('QUEUED'), delivery: null, instance_status: null };
  let creates = 0;
  await page.route('**/api/apps', async route => {
    if (route.request().method() === 'POST') {
      creates++;
      expect(route.request().postDataJSON()).toEqual({ prompt: '记录并分析梦境' });
      expect(route.request().headers()['idempotency-key']).toBeTruthy();
      await route.fulfill({ status: 201, json: { app_id: 'app', job_id: 'job', status: 'QUEUED' } });
    } else await route.fulfill({ json: { items: [{ id: 'app', name: '梦境记录', updated_at: timestamp, active_job_id: 'job', instance_status: null }], next_cursor: null } });
  });
  await page.route('**/api/apps/app', route => route.fulfill({ json: app }));
  await page.route('**/api/jobs/job', route => route.fulfill({ json: app.latest_job }));
  await page.goto('/chatbot');
  await page.getByTestId('create-prompt').fill('记录并分析梦境');
  await page.getByTestId('create-app').click();
  await expect(page).toHaveURL(/\/app-detail\/app/);
  await expect(page.getByTestId('open-app')).toHaveCount(0);
  await page.goto('/app-gallery');
  await page.getByTestId('product-folder-created').click();
  await page.getByTestId('products-actions-open').click(); await page.getByRole('button',{name:'查看应用列表',exact:true}).click();
  await page.getByText('梦境记录', { exact: true }).click();
  await expect(page).toHaveURL(/\/app-detail\/app/);
  expect(creates).toBe(1);
});

test('expired login returns to the same app after logging in again', async ({ page }) => {
  const app = detail('FAILED');
  let expired = true;
  await page.route('**/api/apps/app', route => expired ? route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: '请先登录', retryable: false } } }) : route.fulfill({ json: app }));
  await page.route('**/api/jobs/job', route => route.fulfill({ json: app.latest_job }));
  await page.route('**/auth/login', async route => { expired = false; await route.fulfill({ json: { access_token: 'new-token', token_type: 'bearer' } }); });
  await page.goto('/app-detail/app');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByTestId('login-account').fill('owner');
  await page.getByTestId('login-password').fill('password');
  await page.getByTestId('login-privacy').click();
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/app-detail\/app/);
  await expect(page.getByText('原有梦境记录', { exact: true })).toBeVisible();
});

test('expired private-app login code returns to login with the same app path', async ({ page }) => {
  const app = detail('FAILED');
  await page.route('**/api/apps/app', route => route.fulfill({ json: app }));
  await page.route('**/api/jobs/job', route => route.fulfill({ json: app.latest_job }));
  await page.route('**/api/instances/instance/login-code', route => route.fulfill({
    status: 401,
    json: { error: { code: 'UNAUTHORIZED', message: '请先登录', retryable: false } },
  }));

  await page.goto('/app-detail/app');
  await page.getByTestId('open-app').click();

  await expect(page).toHaveURL(/\/login\?next=%2Fapp-detail%2Fapp/);
});

test('leaving during a send does not leave the restored conversation permanently busy', async ({ page }) => {
  const app = detail();
  let finish!: () => void;
  await page.route('**/api/apps/app', route => route.fulfill({ json: app }));
  await page.route('**/api/jobs/job', route => route.fulfill({ json: app.latest_job }));
  await page.route('**/api/apps', route => route.fulfill({ json: { items: [{ id: 'app', name: '梦境记录', updated_at: timestamp, active_job_id: 'job', instance_status: null }], next_cursor: null } }));
  await page.route('**/api/apps/app/messages', async route => {
    await new Promise<void>(resolve => { finish = resolve; });
    await route.fulfill({ status: 202, json: { app_id: 'app', job_id: 'job', status: 'QUEUED' } });
  });
  await page.goto('/app-detail/app');
  await page.getByTestId('message-input').fill('保持私有');
  await page.getByTestId('send-message').click();
  await expect(page.getByTestId('send-message')).toBeDisabled();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await page.getByTestId('chatbot-settings').click();
  await page.getByRole('button', { name: '我的应用', exact: true }).click();
  await expect(page).toHaveURL(/\/app-gallery$/);
  finish();
  await page.goBack();
  await page.getByTestId('message-input').fill('增加编辑功能');
  await expect(page.getByTestId('send-message')).toBeEnabled();
});


test('an unknown running phase stays neutral and cannot be mistaken for success', async ({ page }) => {
  const app = detail('RUNNING');
  app.active_job!.phase = 'future_phase';
  app.latest_job!.phase = 'future_phase';
  await page.route('**/api/apps/app', route => route.fulfill({ json: app }));
  await page.route('**/api/jobs/job', route => route.fulfill({ json: app.latest_job }));
  await page.goto('/app-detail/app');
  await expect(page.getByTestId('job-status')).toHaveText('正在处理需求');
  await expect(page.getByText(/%/)).toHaveCount(0);
  await expect(page.getByTestId('open-app')).toBeVisible();
  await expect(page.getByTestId('mibo-stage')).toBeVisible();
  await page.getByTestId('chatbot-settings').click(); await page.getByRole('button', { name: '查看任务阶段', exact: true }).click();
  const stages = page.locator('[data-testid^="job-progress-"]');
  await expect(stages).toHaveCount(8);
  const colors = await stages.evaluateAll(elements => elements.map(element => getComputedStyle(element.lastElementChild!).color));
  expect(colors).toEqual(Array(8).fill('rgb(127, 128, 161)'));
});

test('a message conflict reads the current app once without resending or losing its draft', async ({ page }) => {
  let app = detail();
  let sends = 0;
  await page.route('**/api/apps/app', route => route.fulfill({ json: app }));
  await page.route('**/api/jobs/job', route => route.fulfill({ json: app.latest_job }));
  await page.route('**/api/apps/app/messages', async route => {
    sends++;
    app = detail('RUNNING');
    await route.fulfill({ status: 409, json: { error: { code: 'CONFLICT', message: '已有需求正在处理', retryable: false } } });
  });
  await page.goto('/app-detail/app');
  await page.getByTestId('message-input').fill('保持私有');
  await page.getByTestId('send-message').click();
  await page.getByTestId('chatbot-settings').click();await page.getByTestId('delivery-management-toggle').click();await expect(page.getByTestId('cancel-job')).toBeVisible();
  await expect(page.getByTestId('message-input')).toHaveValue('保持私有');
  await expect(page.getByTestId('send-message')).toBeDisabled();
  expect(sends).toBe(1);
});
