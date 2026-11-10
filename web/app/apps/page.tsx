'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, type components } from '@intellideploy/api-client';
import { api } from '../../lib/api';

export default function Apps(){
  const router=useRouter();const [data,setData]=useState<components['schemas']['AppPage']|null>(null);const [error,setError]=useState('');
  useEffect(()=>{api.listMyApps().then(setData).catch(exc=>{if(exc instanceof ApiError&&exc.status===401)router.push('/login?next=/apps');else setError(exc.message??'无法加载应用');});},[router]);
  return <><h1>我的应用</h1><Link href="/" className="primary">创建应用</Link>{error&&<p role="alert" className="error">{error}</p>}{!data&&!error&&<p>正在读取应用…</p>}{data?.items.length===0&&<section><p>还没有应用。先描述一个想解决的问题。</p></section>}{data?.items.map(app=><section key={app.id}><h2><Link href={'/apps/'+app.id}>{app.name}</Link></h2><p className="muted">{app.active_job_id?'正在处理需求':app.instance_status==='RUNNING'?'应用正在运行':app.instance_status==='STOPPED'?'应用已停止':'查看状态与结果'}</p></section>)}{data?.next_cursor&&<button onClick={async()=>{const next=await api.listMyApps(data.next_cursor??undefined);setData({...next,items:[...data.items,...next.items]});}}>加载更多</button>}</>;
}
