import { expect, test } from '@playwright/test';

const timestamp='2026-11-10T01:00:00Z';
function detail(status: string) {
  const delivery={app_id:'example',version_id:'v1',instance_id:'i1',url:'https://fixture-app.example',summary:'保存和读取私有笔记',features:['保存笔记'],report_url:'/api/jobs/job/report',artifact_url:'/api/apps/example/versions/v1/artifact',published_at:timestamp};
  const job={id:'job',app_id:'example',kind:'ADJUST',status,phase:'implementing',event_cursor:0,question:status==='WAITING_USER'?'记录是否公开？':null,usage_units:10,result:null,error:status==='FAILED'?{code:'CHECK_FAILED',message:'本次调整未完成',retryable:false}:null,created_at:timestamp,updated_at:timestamp};
  return {id:'example',name:'私有笔记',updated_at:timestamp,active_job_id:status==='FAILED'?null:'job',instance_status:'RUNNING',requirement:{prompt:'私有笔记',acceptance:[],revision:1,facts:[],source_message_ids:[]},conversation:[{id:'m1',sequence:1,role:'user',content:'私有笔记',created_at:timestamp}],active_job:status==='FAILED'?null:job,latest_job:job,delivery,candidate_version_id:null,instance:null};
}

test.beforeEach(async ({page}) => {
  await page.route('**/api/auth/me', route=>route.fulfill({json:{id:1,username:'owner'}}));
  await page.route('**/api/quota/**',route=>route.fulfill({json:{available_units:1000,reserved_units:0,default_budget_units:100,hard_cap_units:1000,price_version:'fixture',failed_usage_rule:'按实际用量结算'}}));
});

test('refresh preserves the current delivery while a failed adjustment is shown',async ({page}) => {
  await page.route('**/api/apps/example',route=>route.fulfill({json:detail('FAILED')}));
  await page.goto('/apps/example');
  await expect(page.getByText('本次调整未完成').first()).toBeVisible();
  await expect(page.getByRole('link',{name:'打开应用'})).toHaveAttribute('href','https://fixture-app.example');
  await page.reload();
  await expect(page.getByRole('link',{name:'打开应用'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('business answer resumes the existing app and sends one idempotent request',async ({page}) => {
  let calls=0;
  await page.route('**/api/apps/example',route=>route.fulfill({json:detail('WAITING_USER')}));
  await page.route('**/api/apps/example/messages',async route=>{
    calls++;
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    expect(route.request().postDataJSON()).toEqual({content:'保持私有'});
    await route.fulfill({status:202,json:{app_id:'example',job_id:'job',status:'QUEUED'}});
  });
  await page.goto('/apps/example');
  await expect(page.getByText('记录是否公开？')).toBeVisible();
  await page.getByLabel('继续对话').fill('保持私有');
  await page.getByRole('button',{name:'发送'}).click();
  await expect(page.getByLabel('继续对话')).toHaveValue('');
  expect(calls).toBe(1);
});

test('quota pause presents a resume action without showing a new delivery',async ({page}) => {
  const paused={...detail('PAUSED_QUOTA'),delivery:null,instance_status:null};
  await page.route('**/api/apps/example',route=>route.fulfill({json:paused}));
  await page.goto('/apps/example');
  await expect(page.getByText('额度不足，任务已暂停')).toBeVisible();
  await expect(page.getByRole('button',{name:'恢复任务'})).toBeVisible();
  await expect(page.getByRole('link',{name:'打开应用'})).toHaveCount(0);
});

test('a message retry after reload keeps its original request key',async ({page}) => {
  const keys:string[]=[];
  await page.route('**/api/apps/example',route=>route.fulfill({json:detail('FAILED')}));
  await page.route('**/api/apps/example/messages',async route=>{
    keys.push(route.request().headers()['idempotency-key']);
    if(keys.length===1)await route.abort('failed');
    else await route.fulfill({status:202,json:{app_id:'example',job_id:'job',status:'QUEUED'}});
  });
  await page.goto('/apps/example');
  await page.getByLabel('继续对话').fill('增加搜索');
  await page.getByRole('button',{name:'发送'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('继续对话')).toHaveValue('增加搜索');
  await page.getByRole('button',{name:'发送'}).click();
  await expect(page.getByLabel('继续对话')).toHaveValue('');
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test('verification report displays business checks and protected evidence links',async ({page}) => {
  await page.route('**/api/jobs/job',route=>route.fulfill({json:detail('FAILED').latest_job}));
  await page.route('**/api/jobs/job/report',route=>route.fulfill({json:{job_id:'job',overall:'PASS',checks:[{id:'save',action:'新增笔记后重新读取',expected:'原笔记仍在',status:'PASS',evidence_urls:['/api/jobs/job/report/evidence/e1']}]}}));
  await page.goto('/apps/example/report?job=job');
  await expect(page.getByText('新增笔记后重新读取')).toBeVisible();
  await expect(page.getByText('原笔记仍在')).toBeVisible();
  await expect(page.getByRole('link',{name:'查看证据'})).toHaveAttribute('href','/api/jobs/job/report/evidence/e1');
});

test('a creation draft is restored after refresh before submitting', async ({ page }) => {
  await page.goto('/create');
  await page.getByLabel('你想做什么应用？').fill('记录梦境并保存历史');
  await page.reload();
  await expect(page.getByLabel('你想做什么应用？')).toHaveValue('记录梦境并保存历史');
});

test('an anonymous creation returns through login without losing the draft', async ({ page }) => {
  await page.route('**/api/apps', route => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: '请先登录', retryable: false } } }));
  await page.goto('/create');
  await page.getByLabel('你想做什么应用？').fill('整理客户访谈并保留历史');
  await page.getByRole('button', { name: '开始创建' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fcreate$/);

  await page.route('**/api/auth/login', route => route.fulfill({ json: { ok: true } }));
  await page.getByLabel('用户名').fill('owner');
  await page.getByLabel('密码').fill('password-for-test');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByLabel('你想做什么应用？')).toHaveValue('整理客户访谈并保留历史');
});

test('login rejects an external next target', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ json: { ok: true } }));
  await page.goto('/login?next=%2F%2Fevil.test');
  await page.getByLabel('用户名').fill('owner');
  await page.getByLabel('密码').fill('password-for-test');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/apps$/);
});
