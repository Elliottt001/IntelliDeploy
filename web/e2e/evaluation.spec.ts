import { expect, test } from '@playwright/test';

const timestamp = '2026-11-11T01:00:00Z';

test('ordinary users cannot enter developer evaluation', async ({ page }) => {
  await page.route('**/api/evaluation/targets', route => route.fulfill({
    status: 404,
    json: { error: { code: 'NOT_FOUND', message: '接口不存在', retryable: false } },
  }));
  await page.goto('/dev/evaluation');
  await expect(page.getByText('评测入口不可用')).toBeVisible();
  await expect(page.getByLabel('评测需求')).toHaveCount(0);
});

test('developer creates and inspects an owned evaluation task without counting fixtures', async ({ page }) => {
  await page.route('**/api/evaluation/targets', route => route.fulfill({
    json: [{ target_id: 'linux-ready', name: 'Linux 验收节点', kind: 'LINUX' }],
  }));
  await page.route('**/api/apps', route => route.fulfill({
    status: 201,
    json: { app_id: 'app-1', job_id: 'job-1', status: 'QUEUED' },
  }));
  await page.route('**/api/jobs/job-1', route => route.fulfill({
    json: {
      id: 'job-1', app_id: 'app-1', kind: 'GENERATE', status: 'SUCCEEDED', phase: 'completed',
      event_cursor: 1, question: null, usage_units: 10,
      result: { app_id: 'app-1', version_id: 'v1', instance_id: 'i1', url: 'https://fixture.test', summary: 'fixture', features: [], report_url: '/api/jobs/job-1/report', artifact_url: '/api/apps/app-1/versions/v1/artifact', published_at: timestamp },
      error: null, created_at: timestamp, updated_at: timestamp,
    },
  }));
  await page.route('**/api/jobs/job-1/report', route => route.fulfill({
    json: { job_id: 'job-1', overall: 'PASS', checks: [{ id: 'save', action: '保存', expected: '可读取', status: 'PASS', evidence_urls: ['/api/jobs/job-1/report/evidence/e1'] }] },
  }));
  await page.route('**/api/jobs/job-1/diagnostics', route => route.fulfill({
    json: {
      job_id: 'job-1', app_id: 'app-1', version_id: 'v1', status: 'SUCCEEDED', route: 'DEPLOY_EXISTING',
      source_mode: 'fixture', routing_mode: 'automatic', target_id: 'linux-ready', target_override: true,
      model: 'deepseek-flash', price_version: 'dev-v1', usage_units: 10, cost_units: null, cost_status: 'unknown',
      evidence_gate: { status: 'NOT_RUN', reasons: ['REAL_RELEASE_EVIDENCE_MISSING', 'COST_UNKNOWN'] },
      duration_ms: 1000, phase_durations: [{ phase: 'completed', duration_ms: 1000 }],
      sources: [{ url: 'https://github.com/example/notes', commit: 'a'.repeat(40), role: '主体' }],
      retrieval: { queries: [], completed: true, index_version: null, candidates: [] },
      result: { url: 'https://fixture.test' }, report: { overall: 'PASS', checks: [] },
    },
  }));

  await page.goto('/dev/evaluation');
  await page.getByLabel('评测需求').fill('保存私有笔记');
  await page.getByLabel('评测目标').selectOption('linux-ready');
  await page.getByRole('button', { name: '启动评测' }).click();
  await expect(page.getByText('job-1')).toBeVisible();
  await expect(page.getByText('测试夹具，不计入真实交付指标')).toBeVisible();
  await expect(page.getByText('单次证据状态：NOT_RUN')).toBeVisible();
  await expect(page.getByText('REAL_RELEASE_EVIDENCE_MISSING')).toBeVisible();
  await expect(page.getByText('COST_UNKNOWN')).toBeVisible();
  await expect(page.getByRole('link', { name: '打开交付 URL' })).toHaveAttribute('href', 'https://fixture.test');
  await expect(page.getByRole('link', { name: '来源 1' })).toHaveAttribute('href', 'https://github.com/example/notes');
  await expect(page.getByRole('link', { name: 'save 证据 1' })).toHaveAttribute('href', '/api/jobs/job-1/report/evidence/e1');
  await expect(page.getByRole('link', { name: '查看应用任务' })).toHaveAttribute('href', '/apps/app-1');
});

test('leaving evaluation stops the active job poller', async ({ page }) => {
  let jobReads = 0;
  await page.route('**/api/evaluation/targets', route => route.fulfill({ json: [] }));
  await page.route('**/api/apps', route => route.fulfill({ status: 201, json: { app_id: 'app-2', job_id: 'job-2', status: 'QUEUED' } }));
  await page.route('**/api/jobs/job-2', route => {
    jobReads += 1;
    return route.fulfill({ json: { id: 'job-2', app_id: 'app-2', kind: 'GENERATE', status: 'RUNNING', phase: 'retrieving', event_cursor: 0, question: null, usage_units: 1, result: null, error: null, created_at: timestamp, updated_at: timestamp } });
  });
  await page.route('**/api/jobs/job-2/report', route => route.fulfill({ json: { job_id: 'job-2', overall: 'NOT_RUN', checks: [] } }));
  await page.route('**/api/jobs/job-2/diagnostics', route => route.fulfill({ json: { job_id: 'job-2', app_id: 'app-2', version_id: null, status: 'RUNNING', route: null, source_mode: 'fixture', routing_mode: 'automatic', target_id: null, target_override: false, model: 'deepseek-flash', price_version: 'dev-v1', usage_units: 1, cost_units: null, cost_status: 'unknown', evidence_gate: { status: 'NOT_RUN', reasons: ['JOB_NOT_TERMINAL'] }, duration_ms: 100, phase_durations: [], sources: [], retrieval: { queries: [], completed: false, index_version: null, candidates: [] }, result: null, report: { job_id: 'job-2', overall: 'NOT_RUN', checks: [] }, created_at: timestamp, updated_at: timestamp } }));

  await page.goto('/dev/evaluation');
  await page.getByLabel('评测需求').fill('持续运行的评测');
  await page.getByRole('button', { name: '启动评测' }).click();
  await expect.poll(() => jobReads).toBe(1);
  await page.getByRole('link', { name: '创建应用' }).click();
  await expect(page).toHaveURL(/\/create$/);
  await page.waitForTimeout(2300);
  expect(jobReads).toBe(1);
});
