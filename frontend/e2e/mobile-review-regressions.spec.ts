import {expect, test, type Page} from '@playwright/test';
import {makeVisualApp} from './mobileVisualFixtures';
async function authenticate(page: Page) {
 await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
 await page.route('**/auth/me', r => r.fulfill({json:{id:1,username:'owner',email:'fixture@test.example'}}));
}
test('all five home action targets expose names from the visible content', async ({page}) => {
 await authenticate(page);await page.goto('/');
 for (const [id, name] of [
  ['home-mibo-open', '与 Mibo AI 对话'],
  ['home-card-store', 'App Gallery，发现优秀应用，提升效率'],
  ['home-card-products', '我的产品，管理我的应用与工具'],
  ['home-card-community', '广场，探索分享，交流成长'],
  ['home-card-profile', '我的，查看收藏与最近使用'],
 ]) await expect.soft(page.getByTestId(id)).toHaveAccessibleName(name);
});
test('raw replies with leading, trailing and blank lines preserve bytes and finite visible layout', async ({page}) => {
 await authenticate(page);
 const app=makeVisualApp(55,'RUNNING','building');
 await page.route('**/api/apps/app', r=>r.fulfill({json:app}));
 await page.route('**/api/jobs/job', r=>r.fulfill({json:app.latest_job}));
 for (const content of ['first\r\nsecond\r\nthird\r\n\r\n','\r\nfirst\r\n','\n\n\n\n','first\n\nthird']) {
  app.conversation.at(-1)!.content=content;await page.goto('/app-detail/app');
  const reply=page.getByTestId('latest-assistant-reply');await expect(reply).toHaveAttribute('aria-label',content);
  expect(await reply.textContent()).toBe(content);
  const bounds=(await reply.boundingBox())!;expect(bounds.height).toBeGreaterThan(0);
  expect([bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)).toBe(true);
 }
});
test('recovery follow-up remains discoverable through the normal history menu after sending and reload', async ({page}) => {
 await authenticate(page);const app=makeVisualApp(49,'WAITING_USER','clarifying');app.latest_job!.question='还需要哪些功能？';
 await page.route('**/api/apps/app', r=>r.fulfill({json:app}));
 await page.route('**/api/jobs/job', r=>r.fulfill({json:app.latest_job}));
 await page.route('**/api/apps/app/messages', r=>{
  app.conversation.push({id:'follow-up',sequence:3,role:'user',content:'保留我的后续需求',created_at:'2026-11-12T00:00:00Z'});
  app.latest_job!.status='RUNNING';app.latest_job!.question=null;
  return r.fulfill({json:{app_id:'app',job_id:'job',status:'RUNNING'}});
 });
 await page.goto('/app-detail/app');await page.reload();await expect(page.getByTestId('job-status')).toBeVisible();
 await page.getByTestId('chatbot-settings').click();await page.getByTestId('delivery-management-toggle').click();
 await page.getByTestId('refresh-job').click();await page.getByTestId('message-input').fill('保留我的后续需求');
 await page.getByTestId('send-message').click();await expect(page.getByTestId('message-input')).toHaveValue('');
 await expect(page.getByText('保留我的后续需求',{exact:true})).toHaveCount(0);
 await page.getByTestId('chatbot-settings').click();await page.getByTestId('conversation-toggle').click();
 await expect(page.getByText('保留我的后续需求',{exact:true})).toBeVisible();
 await page.reload();await page.getByTestId('chatbot-settings').click();await page.getByTestId('conversation-toggle').click();
 await expect(page.getByText('保留我的后续需求',{exact:true})).toBeVisible();
});

test('compact three-row replies retain original LF and CRLF text and accessibility', async ({page}) => {
 await authenticate(page);const app=makeVisualApp(52,'RUNNING','building');
 await page.route('**/api/apps/app', r=>r.fulfill({json:app}));await page.route('**/api/jobs/job', r=>r.fulfill({json:app.latest_job}));
 for (const content of ['first\r\nsecond\r\nthird','first\nsecond\nthird']) {
  app.conversation.at(-1)!.content=content;await page.goto('/app-detail/app');
  const reply=page.getByTestId('latest-assistant-reply');await expect(reply).toHaveAttribute('aria-label',content);
  expect(await reply.textContent()).toBe(content);
  expect(await reply.innerText()).toBe(content.replace(/\r\n/g,'\n'));
  const rows=page.getByTestId(/^assistant-reply-line-/);await expect(rows).toHaveCount(3);
  for(const [index,y] of [451,486,522].entries())expect((await rows.nth(index).boundingBox())!.y).toBeCloseTo(y,2);
 }
});
