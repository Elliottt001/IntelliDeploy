import { expect, test } from '@playwright/test';

const timestamp = '2026-11-12T01:00:00Z';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, username: 'owner' } }));
  await page.route('**/api/quota/**', route => route.fulfill({
    json: { available_units: 1000, reserved_units: 0, default_budget_units: 100, hard_cap_units: 1000, price_version: 'fixture', failed_usage_rule: '按实际用量结算' },
  }));
});

test('missing deployment target keeps the draft and never shows a fake delivery', async ({ page }) => {
  await page.route('**/api/apps', route => route.fulfill({
    status: 503,
    json: { error: { code: 'TARGET_UNAVAILABLE', message: '没有已登记的可用部署目标', retryable: true } },
  }));
  await page.goto('/create');
  await page.getByLabel('你想做什么应用？').fill('保存私有笔记');
  await page.getByRole('button', { name: '开始创建' }).click();
  await expect(page.getByText('没有已登记的可用部署目标', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByLabel('你想做什么应用？')).toHaveValue('保存私有笔记');
  await expect(page.getByRole('link', { name: '打开应用' })).toHaveCount(0);
});

test('queued creation opens the persisted app without claiming delivery', async ({ page }) => {
  await page.route('**/api/apps', route => route.fulfill({
    status: 201,
    json: { app_id: 'phase1-app', job_id: 'phase1-job', status: 'QUEUED' },
  }));
  await page.route('**/api/apps/phase1-app', route => route.fulfill({
    json: {
      id: 'phase1-app', name: '私有笔记', updated_at: timestamp, active_job_id: 'phase1-job', instance_status: null,
      requirement: null, conversation: [{ id: 'm1', sequence: 1, role: 'user', content: '保存私有笔记', created_at: timestamp }],
      active_job: { id: 'phase1-job', app_id: 'phase1-app', kind: 'GENERATE', status: 'QUEUED', phase: 'queued', event_cursor: 0, question: null, usage_units: 0, result: null, error: null, created_at: timestamp, updated_at: timestamp },
      latest_job: null, delivery: null, candidate_version_id: null, instance: null,
    },
  }));
  await page.goto('/create');
  await page.getByLabel('你想做什么应用？').fill('保存私有笔记');
  await page.getByRole('button', { name: '开始创建' }).click();
  await expect(page).toHaveURL(/\/apps\/phase1-app$/);
  await expect(page.getByText('正在处理需求')).toBeVisible();
  await expect(page.getByRole('link', { name: '打开应用' })).toHaveCount(0);
});
