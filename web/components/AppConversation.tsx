'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiError,type components } from '@intellideploy/api-client';
import { api } from '../lib/api';
import { streamJob } from '../lib/events';
import DeliveryCard from './DeliveryCard';
import InstanceControls from './InstanceControls';
import PublicationSettings from './PublicationSettings';

const phases:Record<string,string>={clarifying:'正在理解需求',retrieving:'正在准备应用',implementing:'正在实现应用',building:'正在准备应用',validating:'正在验证功能',deploying:'正在发布应用',verifying_live:'正在验证使用入口',completed:'应用已交付'};
export default function AppConversation({appId}:{appId:string}){
  const router=useRouter();const [app,setApp]=useState<components['schemas']['AppDetail']|null>(null);const [content,setContent]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const messageKey=useRef<string|null>(null);
  const load=useCallback(async()=>{try{setApp(await api.getApp(appId));}catch(exc){if(exc instanceof ApiError&&exc.status===401)router.push('/login?next='+encodeURIComponent('/apps/'+appId));else setError(exc instanceof Error?exc.message:'无法读取应用');}},[appId,router]);
  useEffect(()=>{setContent(localStorage.getItem('intellideploy:message:'+appId)??'');void load();},[appId,load]);
  const job=app?.active_job??app?.latest_job;
  useEffect(()=>{if(!job||!['QUEUED','RUNNING'].includes(job.status))return;const close=streamJob(job.id,job.event_cursor,()=>{void load();});const timer=setInterval(()=>{void load();},5000);return()=>{close();clearInterval(timer);};},[job?.id,job?.status,load]);
  async function send(event:React.FormEvent){
    event.preventDefault();if(busy||!content.trim())return;setBusy(true);setError('');messageKey.current??=sessionStorage.getItem('intellideploy:message-key:'+appId)??crypto.randomUUID();sessionStorage.setItem('intellideploy:message-key:'+appId,messageKey.current);
    try{await api.sendMessage(appId,content,messageKey.current);setContent('');messageKey.current=null;localStorage.removeItem('intellideploy:message:'+appId);sessionStorage.removeItem('intellideploy:message-key:'+appId);await load();}
    catch(exc){if(exc instanceof ApiError&&exc.status===401)router.push('/login?next='+encodeURIComponent('/apps/'+appId));else setError(exc instanceof Error?exc.message:'请求失败，请稍后重试');if(exc instanceof ApiError&&exc.status===409)await load();}
    finally{setBusy(false);}
  }
  async function action(kind:'resume'|'cancel'){if(!job||busy)return;setBusy(true);try{if(kind==='resume')await api.resumeJob(job.id,crypto.randomUUID());else await api.cancelJob(job.id,crypto.randomUUID());await load();}catch(exc){setError(exc instanceof Error?exc.message:'操作失败');}finally{setBusy(false);}}
  if(!app)return <p role={error?'alert':undefined}>{error||'正在读取应用…'}</p>;
  const running=app.active_job&&['QUEUED','RUNNING'].includes(app.active_job.status);
  return <><h1>{app.name}</h1>{job&&<section aria-live="polite"><p>{job.status==='FAILED'?'本次调整未完成':job.status==='PAUSED_QUOTA'?'额度不足，任务已暂停':job.status==='WAITING_USER'?'需要你补充一点信息':job.status==='CANCELLED'?'任务已取消':job.status==='SUCCEEDED'?'应用已交付':phases[job.phase]??'正在处理需求'}</p>{job.question&&<p>{job.question}</p>}{job.error&&<p className="error">{job.error.message}</p>}<p className="muted">本次已使用 {job.usage_units} 额度</p>{job.status==='PAUSED_QUOTA'&&<><Link href={'/billing?return='+encodeURIComponent('/apps/'+appId)}>补充额度</Link><button disabled={busy} onClick={()=>action('resume')}>恢复任务</button></>}{running&&<button className="secondary" disabled={busy} onClick={()=>action('cancel')}>取消任务</button>}</section>}<DeliveryCard app={app}/><InstanceControls app={app} reload={load}/><PublicationSettings app={app} reload={load}/><section><h2>需求与调整</h2>{app.conversation.map(m=><div className="message" key={m.id}><span className="muted">{m.role==='user'?'你':'应用助手'}</span><p>{m.content}</p></div>)}{app.publication&&<p className="muted">此次调整通过后将同步更新社区中的应用。</p>}<form onSubmit={send}><label htmlFor="message">继续对话<textarea id="message" disabled={busy} value={content} onChange={e=>{setContent(e.target.value);messageKey.current=null;sessionStorage.removeItem('intellideploy:message-key:'+appId);localStorage.setItem('intellideploy:message:'+appId,e.target.value);}} required maxLength={20000}/></label>{running&&<p className="muted">正在处理上一项需求，可以先保存你的想法，完成后再发送。</p>}{error&&<p role="alert" className="error">{error}</p>}<button disabled={busy||Boolean(running)}>发送</button></form></section></>;
}
