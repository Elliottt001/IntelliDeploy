import { expect, test, type Page } from '@playwright/test';

const stamp = '2026-11-10T00:00:00Z';
const publication = { id: 'pub', app_id: 'app', instance_id: 'instance', version_id: 'v', name: '公开应用', summary: '真实摘要', features: ['保存记录'], creator: '作者', preview_url: null, url: null, available: false, payer_policy: 'VISITOR', sponsor_period: 'DAY', sponsor_limit_units: 10, updated_at: stamp };
const app = { id: 'app', name: '我的应用', updated_at: stamp, active_job_id: null, active_job: null, latest_job: null, instance_status: 'RUNNING', candidate_version_id: null, conversation: [], requirement: { prompt: '保存记录', acceptance: [], revision: 1, facts: [], source_message_ids: [] }, delivery: { app_id: 'app', version_id: 'v', instance_id: 'instance', url: 'http://127.0.0.1:9199/app', summary: '已交付记录', features: ['保存记录'], report_url: '/report', artifact_url: '/artifact', published_at: stamp }, instance: { id: 'instance', app_id: 'app', status: 'RUNNING', active_operation_id: null }, publication: null };
async function owner(page: Page) {
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
  await page.route('**/auth/me', r => r.fulfill({ json: { id: 1, username: 'owner', email: 'owner@test' } }));
  await page.route('**/api/quota/balance', r => r.fulfill({ json: { available_units: 900, reserved_units: 100 } }));
  await page.route('**/api/quota/policy', r => r.fulfill({ json: { failed_usage_rule: '失败按实际用量结算' } }));
  await page.route('**/api/quota/usage', r => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/quota/subscription', r => r.fulfill({ json: null }));
  await page.route('**/api/quota/skus', r => r.fulfill({ json: [] }));
  await page.route('**/api/quota/orders', r => r.fulfill({ json: [] }));
  await page.route('**/api/apps/app', r => r.fulfill({ json: app }));
}
async function pending(page: Page, family: string) {
  await expect(page.getByTestId('visual-pending-section')).toBeAttached();
  await expect(page.getByTestId(`VISUAL_PENDING:${family === 'community' ? '/community/[id]' : family === 'app-detail:secondary' ? '/app-detail/[id]:secondary' : '/' + family}`)).toBeAttached();
  await expect(page.getByText('VISUAL_PENDING', { exact: true })).toHaveCount(0);
}
async function controls(page: Page, width: number) {
  for (const button of await page.locator('[role=button], [role=checkbox], [role=switch], input').all()) {
    if (!await button.isVisible()) continue;
    const box = (await button.boundingBox())!;
    expect(box.width, await button.getAttribute('aria-label') ?? await button.innerText()).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + .1);
  }
}
for (const family of ['register', 'billing', 'community', 'app-detail:secondary']) test(`${family} keeps pending metadata, shared shell and 44pt actions at native widths`, async ({ page }) => {
  if (family === 'billing' || family === 'app-detail:secondary') await owner(page);
  await page.route('**/api/publications/pub', r => r.fulfill({ json: publication }));
  await page.route('**/api/library/favorites**', r => r.fulfill({ json: { items: [] } }));
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(family === 'community' ? '/community/pub' : family === 'app-detail:secondary' ? '/app-detail/app' : `/${family}`);
    if(family === 'app-detail:secondary') {await page.getByTestId('chatbot-settings').click(); await page.getByTestId('delivery-management-toggle').click();}
    await pending(page, family);
    if (family === 'app-detail:secondary') {
      await expect(page.getByTestId('chatbot-page')).toBeVisible();
      await expect(page.getByTestId('secondary-brand-header')).toBeAttached();
      await expect(page.getByTestId('mibo-stage')).toBeVisible();
      await expect(page.getByTestId('visual-pending-section').getByTestId('mibo-stage')).toHaveCount(0);
      for (const id of ['open-app', 'stop-instance', 'delete-confirmation', 'delete-instance', 'publish-app']) await expect(page.getByTestId(id)).toBeAttached();
      await expect(page.getByTestId('delete-instance')).toBeDisabled();
    } else {
      await expect(page.getByTestId('workspace-background')).toBeVisible();
      await expect(page.getByTestId('workspace-brand-header')).toBeVisible();
    }
    await controls(page, width);
    await expect(page.getByTestId('visual-pending-section')).toHaveCSS('transform', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
test('registration preserves real fields after failure and sends register/login before the sanitized next path', async ({ page }) => {
  let attempts = 0;
  await page.route('**/auth/register', r => {
    expect(r.request().postDataJSON()).toEqual({ username: 'student', email: 'student@test', password: 'password123' });
    attempts++; return attempts === 1 ? r.fulfill({ status: 400, json: { detail: '用户名已存在' } }) : r.fulfill({ json: { id: 1 } });
  });
  await page.route('**/auth/login', r => r.fulfill({ json: { access_token: 'fixture-token' } }));
  await page.route('**/auth/me', r => r.fulfill({ json: { id: 1, username: 'student' } }));
  await page.goto('/register?next=%2Fcommunity');
  await page.getByLabel('用户名', { exact: true }).fill('student'); await page.getByLabel('邮箱', { exact: true }).fill('student@test');
  await page.getByLabel('密码', { exact: true }).fill('password123'); await page.getByLabel('确认密码', { exact: true }).fill('password123');
  await page.getByRole('checkbox', { name: '同意隐私协议' }).click();
  await page.getByRole('button', { name: '立即注册', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('用户名已存在');
  await expect(page.getByLabel('用户名', { exact: true })).toHaveValue('student'); await expect(page.getByLabel('密码', { exact: true })).toHaveValue('password123');
  await page.getByRole('button', { name: '立即注册', exact: true }).click(); await expect(page).toHaveURL(/\/community$/); expect(attempts).toBe(2);
});
test('anonymous publication detail retains copy/favorite login boundary', async ({ page }) => {
  await page.route('**/api/publications/pub', r => r.fulfill({ json: publication }));
  await page.route('**/auth/me', r => r.fulfill({ status: 401, json: { detail: '请登录' } }));
  await page.route('**/api/library/favorites**', r => r.fulfill({ status: 401, json: { error: { message: '请登录' } } }));
  for (const name of ['创建我的副本', '收藏应用']) {
    await page.goto('/community/pub'); await pending(page, 'community');
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    await page.getByRole('button', { name, exact: true }).click(); await expect(page).toHaveURL(/\/login\?next=%2Fcommunity%2Fpub$/);
  }
});
test('billing retries the same real reads and keeps last quota facts after a refresh error', async ({ page }) => {
  await owner(page); let reads = 0; let offline = true;
  await page.route('**/api/quota/balance', r => { reads++; return offline ? r.fulfill({ status: 503, json: { error: { message: '暂时无法读取额度' } } }) : r.fulfill({ json: { available_units: 37, reserved_units: 4 } }); });
  await page.goto('/billing'); await expect(page.getByRole('alert')).toContainText('暂时无法读取额度');
  offline = false; await page.getByRole('button', { name: '刷新额度', exact: true }).click();
  await expect(page.getByText('可用额度：37', { exact: true })).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0);
  offline = true; await page.getByRole('button', { name: '刷新额度', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('可用额度：37', { exact: true })).toBeVisible(); expect(reads).toBe(3);
});
test('pending shared brand SVG emits no React DOM accessibility warning', async ({ page }) => {
  const errors: string[] = []; page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/register'); await expect(page.getByTestId('workspace-brand-header')).toBeVisible();
  await expect(page.getByTestId('workspace-brand-header').locator('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(errors).toEqual([]);
});
test('secondary controls retain DELETE confirmation, persistence keys and publication readback', async ({ page }) => {
  await owner(page);
  let published = false; let appReads = 0; let deletes = 0; const keys: string[] = [];
  await page.route('**/api/apps/app', r => { appReads++; return r.fulfill({ json: { ...app, publication: published ? publication : null } }); });
  await page.route('**/api/apps/app/publish', r => {
    expect(r.request().postDataJSON()).toEqual({ version_id: 'v', payer_policy: 'SPONSOR', sponsor_period: 'MONTH', sponsor_limit_units: 23 });
    published = true; return r.fulfill({ json: publication });
  });
  await page.route('**/api/instances/instance', r => { deletes++; keys.push(r.request().headers()['idempotency-key']); expect(r.request().method()).toBe('DELETE'); expect(r.request().postDataJSON()).toEqual({ confirmation: 'DELETE', delete_data: true }); return r.fulfill({ status: 202, json: { id: 'op', status: 'QUEUED' } }); });
  await page.route('**/api/instance-operations/op', r => r.fulfill({ json: { id: 'op', status: 'RUNNING' } }));
  await page.goto('/app-detail/app'); await page.getByTestId('chatbot-settings').click(); await page.getByTestId('delivery-management-toggle').click(); await expect(page.getByTestId('publish-app')).toBeEnabled();
  await page.getByRole('button', { name: '由我赞助', exact: true }).click(); await page.getByRole('button', { name: '每月', exact: true }).click();
  await page.getByLabel('赞助额度上限').fill('0'); await expect(page.getByTestId('publish-app')).toBeDisabled();
  await page.getByLabel('赞助额度上限').fill('23'); await page.getByTestId('publish-app').click(); await expect(page.getByTestId('publish-app')).toHaveText('更新公开设置'); expect(appReads).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('delete-instance')).toBeDisabled(); await page.getByTestId('delete-confirmation').fill('delete'); await expect(page.getByTestId('delete-instance')).toBeDisabled();
  await page.getByTestId('delete-confirmation').fill('DELETE'); await page.getByRole('switch', { name: '同时删除持久数据' }).click(); await page.getByTestId('delete-instance').click();
  await expect(page.getByText('正在处理实例操作', { exact: true })).toBeVisible(); expect(deletes).toBe(1); expect(keys[0]).toBeTruthy(); await expect(page.getByTestId('delete-confirmation')).toHaveValue('');
});
