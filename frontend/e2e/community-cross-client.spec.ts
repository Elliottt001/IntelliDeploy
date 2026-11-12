import {execFileSync} from 'node:child_process';
import {expect,test} from '@playwright/test';

import {resolveTestDatabaseUrl} from './testDatabase';

const databaseUrl = resolveTestDatabaseUrl();

test('Web and Expo share one publication, favorites and an independent queued copy',async({browser,request},testInfo)=>{
 const api='http://127.0.0.1:9105';const suffix=crypto.randomUUID();const password='test-only-community-password';
 async function account(name:string){const username=name+suffix;expect((await request.post(api+'/auth/register',{data:{username,password,email:username+'@test.example'}})).status()).toBe(201);const token=(await(await request.post(api+'/auth/login',{data:{username,password}})).json()).access_token;const user=await(await request.get(api+'/auth/me',{headers:{Authorization:'Bearer '+token}})).json();return{username,token,id:user.id};}
 const owner=await account('publisher-');const visitor=await account('visitor-');
 // Fixture release materials, real PostgreSQL/API/client transport. No model or cloud PASS is claimed.
 const seed=JSON.parse(execFileSync('../.venv/bin/python',['-c',`
import os,sys,json,zipfile,tempfile
from datetime import datetime,timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models.user import User
from app.apps.models import App,AppVersion,Instance,RequirementRecord
from app.core.types import AppManifest,ServiceSpec,Requirement,AcceptanceItem,ValidationReport,CheckResult
from app.runtime.manifest import manifest_hash
engine=create_engine(os.environ['DATABASE_URL'])
manifest=AppManifest(web_service='web',services=[ServiceSpec(name='web',port=3000,image='registry.test/fixture@sha256:'+'a'*64)])
req=Requirement(prompt='跨端社区笔记',acceptance=[AcceptanceItem(id='save',action='保存',expected='重读仍存在')])
report=ValidationReport(checks=[CheckResult(id='save',status='PASS',evidence='fixture-only')],required_ids=['save'],requirement_revision=1,attempt_id='fixture',manifest_hash=manifest_hash(manifest))
with tempfile.NamedTemporaryFile(suffix='.zip',delete=False) as f: path=f.name
with zipfile.ZipFile(path,'w') as z:z.writestr('source/app.py','print("fixture")')
with Session(engine) as s:
 a=App(owner_id=int(sys.argv[1]),name='跨端社区笔记-'+sys.argv[2],prompt=req.prompt);s.add(a);s.flush()
 v=AppVersion(app_id=a.id,requirement_revision=1,manifest=manifest.model_dump(mode='json'),validation=report.model_dump(mode='json'),artifact_path=path,delivery={'summary':'fixture 社区笔记','features':['保存笔记'],'browser_checks':[{'item_id':'save','actor':'owner','actions':[],'expected':'重读仍存在'}]});s.add(v);s.flush();a.active_version_id=v.id
 i=Instance(app_id=a.id,owner_id=a.owner_id,version_id=v.id,status='RUNNING',url='https://fixture-community.example');s.add(i);s.flush()
 v.delivery={**v.delivery,'app_id':a.id,'version_id':v.id,'instance_id':i.id,'url':i.url,'report_url':'/api/jobs/fixture/report','artifact_url':f'/api/apps/{a.id}/versions/{v.id}/artifact','published_at':datetime.now(timezone.utc).isoformat()}
 s.add(RequirementRecord(app_id=a.id,revision=1,requirement=req.model_dump(mode='json'),review={'source_mode':'fixture'}));s.commit()
 print(json.dumps({'app_id':a.id,'version_id':v.id,'instance_id':i.id,'artifact':path}))
`,String(owner.id),suffix],{env:{...process.env,DATABASE_URL:databaseUrl,PYTHONPATH:'../backend'}}).toString());
 const publisherContext=await browser.newContext();const publisher=await publisherContext.newPage();
 await publisher.goto('http://127.0.0.1:3105/login');await publisher.getByLabel('用户名').fill(owner.username);await publisher.getByLabel('密码').fill(password);await publisher.getByRole('button',{name:'登录',exact:true}).click();await expect(publisher).toHaveURL(/\/apps$/);
 await publisher.goto('http://127.0.0.1:3105/apps/'+seed.app_id);await publisher.getByRole('button',{name:'发布应用',exact:true}).click();await expect(publisher.getByRole('link',{name:'查看社区页面'})).toBeVisible();
 const publication=(await(await request.get(api+'/api/apps/'+seed.app_id,{headers:{Authorization:'Bearer '+owner.token}})).json()).publication;await publisherContext.close();const webContext=await browser.newContext();const mobileContext=await browser.newContext({viewport:{width:390,height:844}});await mobileContext.addInitScript(token=>localStorage.setItem('token',token),visitor.token);
 const web=await webContext.newPage();const mobile=await mobileContext.newPage();
 try{
  await web.goto('http://127.0.0.1:3105/community/'+publication.id);await expect(web.getByRole('heading',{name:publication.name})).toBeVisible();
  await mobile.goto('http://127.0.0.1:8085/community/'+publication.id);await expect(mobile.getByText(publication.name,{exact:true})).toBeVisible();
  await mobile.getByText('收藏应用',{exact:true}).click();await expect(mobile.getByText('取消收藏',{exact:true})).toBeVisible();
  await web.goto('http://127.0.0.1:3105/login');await web.getByLabel('用户名').fill(visitor.username);await web.getByLabel('密码').fill(password);await web.getByRole('button',{name:'登录',exact:true}).click();await expect(web).toHaveURL(/\/apps$/);
  await web.getByRole('button',{name:'我的收藏'}).click();await expect(web.getByRole('link',{name:publication.name})).toBeVisible();
  await mobile.getByTestId('copy-publication').click();await expect(mobile).toHaveURL(/\/app-detail\/[a-f0-9-]+/);const copyId=new URL(mobile.url()).pathname.split('/').pop()!;
  const copied=await(await request.get(api+'/api/apps/'+copyId,{headers:{Authorization:'Bearer '+visitor.token}})).json();expect(copied.source_version_id).toBe(seed.version_id);expect(copied.active_job.kind).toBe('COPY');expect(copied.active_job.status).toBe('QUEUED');expect(copied.delivery).toBeNull();expect(copied.instance.id).not.toBe(seed.instance_id);
  await web.goto('http://127.0.0.1:3105/apps/'+copyId);await expect(web.getByRole('heading',{name:publication.name+' · 我的副本'})).toBeVisible();
  await testInfo.attach('community-cross-client',{contentType:'application/json',body:Buffer.from(JSON.stringify({source_mode:'fixture',publication_id:publication.id,copy_app_id:copyId,job_id:copied.active_job.id,delivery:'NOT_RUN'}))});
 }finally{await webContext.close();await mobileContext.close();execFileSync('../.venv/bin/python',['-c','import pathlib,sys;pathlib.Path(sys.argv[1]).unlink(missing_ok=True)',seed.artifact]);}
});
