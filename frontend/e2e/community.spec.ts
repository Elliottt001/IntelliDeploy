import {expect,test} from '@playwright/test';
const stamp='2026-11-10T00:00:00Z';
const publication={id:'shared',app_id:'owner-app',instance_id:'shared-instance',version_id:'v1',name:'共享笔记',summary:'记录自己的笔记',features:['记录历史'],creator:'作者',preview_url:null,url:'https://fixture-app.example',available:true,payer_policy:'VISITOR',sponsor_period:'DAY',sponsor_limit_units:10000,copy_url:'/api/publications/shared/copies',updated_at:stamp};

test('Expo community copy survives login and navigates to its independent job',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'visitor'}}));
 await page.route('**/api/community/apps',r=>r.fulfill({json:{items:[publication],next_cursor:null}}));
 await page.route('**/api/publications/shared',r=>r.fulfill({json:publication}));
 await page.route('**/api/library/favorites',r=>r.fulfill({json:{items:[],next_cursor:null}}));
 await page.route('**/api/publications/shared/copies',r=>r.fulfill({status:201,json:{app_id:'copied',job_id:'copy-job',status:'QUEUED'}}));
 await page.route('**/api/apps/copied',r=>r.fulfill({json:{id:'copied',name:'我的副本',updated_at:stamp,instance_status:null,requirement:{prompt:'笔记',acceptance:[]},conversation:[],active_job:null,latest_job:null,delivery:null,candidate_version_id:null}}));
 await page.goto('/community');
 await page.getByText('共享笔记',{exact:true}).click();
 await expect(page.getByText('访问者使用自己的额度，使用前登录。')).toBeVisible();
 await page.getByTestId('copy-publication').click();
 await expect(page).toHaveURL(/\/app-detail\/copied/);
});

test('Expo stopped instance resumes through a persistent operation and requires delete confirmation',async({page})=>{
 let running=false;
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner'}}));
 await page.route('**/api/apps/app',r=>r.fulfill({json:{id:'app',name:'笔记',updated_at:stamp,instance_status:running?'RUNNING':'STOPPED',instance:{id:'instance',status:running?'RUNNING':'STOPPED',desired_state:'RUNNING',stop_reason:'USER',url:'https://fixture-app.example',observed_at:stamp,active_operation_id:null},requirement:{prompt:'笔记',acceptance:[]},conversation:[],active_job:null,latest_job:null,delivery:{app_id:'app',version_id:'v1',instance_id:'instance',url:'https://fixture-app.example',summary:'保存笔记',features:[],report_url:'/api/jobs/j/report',artifact_url:'/api/apps/app/versions/v1/artifact',published_at:stamp}}}));
 await page.route('**/api/instances/instance/start',r=>r.fulfill({status:202,json:{id:'op',instance_id:'instance',kind:'START',status:'QUEUED',created_at:stamp,updated_at:stamp,error:null}}));
 await page.route('**/api/instance-operations/op',r=>{running=true;return r.fulfill({json:{id:'op',instance_id:'instance',kind:'START',status:'SUCCEEDED',created_at:stamp,updated_at:stamp,error:null}});});
 await page.goto('/app-detail/app');
 await page.getByTestId('start-instance').click();
 await expect(page.getByTestId('open-app')).toBeVisible();
 await expect(page.getByTestId('delete-instance')).toBeDisabled();
 await page.getByTestId('delete-confirmation').fill('DELETE');
 await expect(page.getByTestId('delete-instance')).toBeEnabled();
});
