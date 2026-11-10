import { expect,test } from '@playwright/test';
const time='2026-11-10T00:00:00Z';
const publication={id:'public',app_id:'example',instance_id:'i1',version_id:'v1',name:'社区笔记',summary:'保存笔记',features:['记录历史'],creator:'作者',preview_url:null,url:'https://fixture-app.example',available:true,payer_policy:'SPONSOR',sponsor_period:'DAY',sponsor_limit_units:10000,copy_url:'/api/publications/public/copies',updated_at:time};

test('anonymous community shows an unavailable instance without a broken entry',async({page})=>{
  await page.route('**/api/community/apps',r=>r.fulfill({json:{items:[{...publication,available:false,url:null}],next_cursor:null}}));
  await page.goto('/community');
  await expect(page.getByText('社区笔记')).toBeVisible();
  await expect(page.getByText('暂不可用')).toBeVisible();
  await expect(page.getByRole('link',{name:'直接使用'})).toHaveCount(0);
});

test('copy retry after refresh keeps its request key and opens the new app',async({page})=>{
  const keys:string[]=[];
  await page.route('**/api/publications/public',r=>r.fulfill({json:publication}));
  await page.route('**/api/apps/copy',r=>r.fulfill({json:{id:'copy',name:'我的副本',updated_at:time,requirement:{prompt:'笔记',acceptance:[]},conversation:[],instance_status:null,active_job:null,latest_job:null,delivery:null,candidate_version_id:null}}));
  await page.route('**/api/publications/public/copies',async r=>{keys.push(r.request().headers()['idempotency-key']); if(keys.length===1)await r.abort();else await r.fulfill({status:201,json:{app_id:'copy',job_id:'copy-job',status:'QUEUED'}});});
  await page.goto('/community/public');
  await page.getByRole('button',{name:'创建我的副本'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'创建我的副本'}).click();
  await expect(page).toHaveURL(/\/apps\/copy/);
  expect(keys.length).toBe(2);expect(keys[0]).toBe(keys[1]);
});

test('private entry exchanges one code and instance recovery waits for the operation result',async({page,context})=>{
  let running=false;let operations=0;
  const delivery={app_id:'example',instance_id:'i1',version_id:'v1',url:'https://fixture-app.example',summary:'私有记录',features:[],report_url:'/api/jobs/j/report',artifact_url:'/api/apps/example/versions/v1/artifact',published_at:time};
  await page.route('**/api/apps/example',r=>r.fulfill({json:{id:'example',name:'笔记',updated_at:time,instance_status:running?'RUNNING':'STOPPED',instance:{id:'i1',status:running?'RUNNING':'STOPPED',desired_state:'RUNNING',stop_reason:'USER',url:delivery.url,observed_at:time,active_operation_id:null},requirement:{prompt:'笔记',acceptance:[]},conversation:[],delivery,active_job:null,latest_job:null,candidate_version_id:null}}));
  await page.route('**/api/instances/i1/start',r=>r.fulfill({status:202,json:{id:'op',instance_id:'i1',kind:'START',status:'QUEUED',error:null,created_at:time,updated_at:time}}));
  await page.route('**/api/instance-operations/op',r=>{operations++;running=operations>=2;return r.fulfill({json:{id:'op',instance_id:'i1',kind:'START',status:running?'SUCCEEDED':'RUNNING',error:null,created_at:time,updated_at:time}});});
  await page.route('**/api/instances/i1/login-code',r=>r.fulfill({json:{code:'one-use-code',expires_in:60}}));
  await context.route('https://fixture-app.example/**',r=>r.fulfill({body:'opened'}));
  await page.goto('/apps/example');
  await page.getByRole('button',{name:'恢复运行'}).click();
  await expect(page.getByText('正在处理实例操作')).toBeVisible();
  await expect(page.getByRole('link',{name:'打开应用'})).toBeVisible();
  const popupPromise=page.waitForEvent('popup');
  await page.getByRole('link',{name:'打开应用'}).click();
  const popup=await popupPromise;
  await expect(popup).toHaveURL('https://fixture-app.example/api/platform/callback?code=one-use-code');
});
