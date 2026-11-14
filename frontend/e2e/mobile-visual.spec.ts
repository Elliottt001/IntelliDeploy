import { mkdir, readFile } from 'node:fs/promises';
import { assertVisualApproval, imageHash } from '../scripts/mobile-visual-contract.cjs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type {components} from '@intellideploy/api-client';
import {visualJobStates,makeVisualApp,visualRankingPublications,visualProductApps,visualStorePublications,visualCommunityPublications,visualPrompt} from './mobileVisualFixtures';
async function fixtures(page: Page, authenticated = true, family: 'store'|'community'|'ranking'='community') {
  if (authenticated) await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
  await page.route('**/auth/me', r => r.fulfill({ json: { id: 1, username: 'Oasis', email: 'fixture@test.example' } }));
  await page.route('**/api/community/apps**', r=>r.fulfill({json:{items:family==='ranking'?visualRankingPublications:family==='store'?visualStorePublications:visualCommunityPublications,next_cursor:null}}));
  await page.route('**/api/instances/fixture-instance/login-code',r=>r.fulfill({json:{code:'local-fixture-code',expires_in:60} satisfies components['schemas']['LoginCodeResponse']}));
  await page.route('**/api/library/**', r => r.fulfill({ json: { items: [], next_cursor: null } }));
  await page.route('**/api/apps', r => r.fulfill({ json: { items: visualProductApps, next_cursor: null } }));
  await page.route('**/api/quota/**', r => r.fulfill({ json: { available_units: 900, reserved_units: 100, default_budget_units: 100, hard_cap_units: 1000, price_version: 'fixture', failed_usage_rule: '失败按实际用量结算', items: [] } }));
}
async function capture(page: Page, family: string, number: number, info: TestInfo) {
  const name = `${family}-page-${String(number).padStart(2, '0')}.png`;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; }))); });
  await mkdir('artifacts/figma/mobile/actual', { recursive: true });
  await page.screenshot({ path: `artifacts/figma/mobile/actual/${name}`, animations: 'disabled', fullPage: false });
  const actual=await readFile(`artifacts/figma/mobile/actual/${name}`);await mkdir('artifacts/figma/mobile/provenance',{recursive:true});await import('node:fs/promises').then(fs=>fs.writeFile(`artifacts/figma/mobile/provenance/${name}.json`,JSON.stringify({actual:name,reference:`page-${String(number).padStart(2,'0')}.png`,actualSha256:imageHash(actual),capturedAt:new Date().toISOString(),route:new URL(page.url()).pathname,viewport:page.viewportSize(),reproduceCommand:'npm --workspace frontend run test:visual:mobile',sourceMode:'schema-valid local API fixtures; missing store preview may show explicitly labelled STATIC_DESIGN_ILLUSTRATION'},null,2)));
  if(info.config.updateSnapshots!=='none') {
    const report=JSON.parse(await readFile('artifacts/figma/mobile/visual-report.json','utf8'));
    assertVisualApproval(report);
    for(const row of report.formal){
      expect(imageHash(await readFile(`artifacts/figma/mobile/actual/${row.actual}`))).toBe(row.actualSha256);
      expect(imageHash(await readFile(`artifacts/figma/mobile/reference/${row.reference}`))).toBe(row.referenceSha256);
    }
  }
  await expect(page).toHaveScreenshot(name, { animations: 'disabled', fullPage: false });
}
test.describe('@visual formal mobile states', () => {
  test.use({ viewport: { width: 375, height: 812 }, colorScheme: 'light', contextOptions: {reducedMotion: 'reduce'} });
  test('login page-01', async ({ page }, info) => { await fixtures(page, false); await page.goto('/login'); await expect(page.getByTestId('login-account')).toBeVisible(); await capture(page, 'login', 1, info); });
  for (const number of [2,29,30,31,32,33,34,35]) test(`home page-${number}`, async ({ page }, info) => {
    await fixtures(page); await page.goto('/'); await expect(page.getByTestId('home-mibo-open')).toBeVisible();
    const key = ({32:'store',33:'products',34:'community',35:'profile'} as Record<number,string>)[number];
    if(number===29){await page.getByTestId('home-inspiration-refresh').click();await expect(page.getByTestId('home-suggestions')).toHaveAttribute('id','188:16981');}
    if(number===30){const box=await page.getByTestId('home-mibo-avatar').boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await expect(page.getByTestId('home-avatar-pressed')).toBeVisible();}
    if(number===31) {await page.getByTestId('home-inspiration-refresh').click();await page.getByTestId('home-inspiration-refresh').click();await expect(page.getByTestId('home-suggestions')).toHaveAttribute('id','270:26318');}
    if (key) await page.getByTestId(`home-card-${key}`).click();
    try {await capture(page, 'home', number, info);}finally{if(number===30)await page.mouse.up();}
  });
  for (const number of [3,40]) test(`store page-${number}`, async ({ page }, info) => { await fixtures(page, false, number===3?'store':'ranking'); await page.goto(number===3?'/store':'/store/ranking'); await expect(page.getByText('笔记工具').first()).toBeVisible(); await capture(page,'store',number,info); });
  test('chatbot page-47', async ({page},info)=>{await fixtures(page);await page.goto('/chatbot');await page.getByTestId('create-prompt').fill(visualPrompt);await page.getByTestId('create-prompt').blur();await capture(page,'chatbot',47,info);});
  test('chatbot page-46', async ({ page }, info) => { await fixtures(page); await page.goto('/chatbot'); await expect(page.getByTestId('create-prompt')).toBeVisible(); await capture(page,'chatbot',46,info); });
  for (const [number,status,phase] of visualJobStates) test(`chatbot page-${number}`,async({page},info)=>{
    await fixtures(page);
    const app:components['schemas']['AppDetail']=makeVisualApp(number,status,phase),job=app.latest_job!;
    await page.route('**/api/apps/app', r=>r.fulfill({json:app})); await page.route('**/api/jobs/job',r=>r.fulfill({json:job}));
    await page.goto('/app-detail/app'); await expect(page.getByTestId('job-status')).toBeVisible();await page.getByTestId('message-input').fill(visualPrompt);await page.getByTestId('message-input').blur(); if(status==='SUCCEEDED'){await expect(page.getByTestId('open-app')).toBeVisible();for(const url of [app.delivery!.url,app.delivery!.report_url,(app.delivery && 'artifact_url' in app.delivery ? app.delivery.artifact_url : '')])expect((await page.request.get(url)).status()).toBe(200);await page.getByTestId('open-app').click();await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:9199\/api\/platform\/callback\?code=local-fixture-code$/);await expect(page.getByRole('heading',{name:'笔记工具'})).toBeVisible();await page.goBack();await expect(page.getByTestId('job-status')).toHaveText('应用已交付');await page.getByTestId('message-input').fill(visualPrompt);await page.getByTestId('message-input').blur();} await capture(page,'chatbot',number,info);
  });
  for (const number of [56,57]) test(`products page-${number}`, async({page},info)=>{await fixtures(page);await page.goto('/app-gallery');await expect(page.getByTestId('product-folder-created')).toBeVisible();if(number===57)await page.getByTestId('product-folder-created').click();await capture(page,'products',number,info);});
  for (const number of [59,60]) test(`community page-${number}`,async({page},info)=>{
    await fixtures(page,false);await page.goto('/community');const rail=page.getByTestId('community-source-rail');await expect(rail).toBeVisible();
    if(number===60){await rail.hover();await page.mouse.wheel(94,0);await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');}
    await capture(page,'community',number,info);
  });
});
