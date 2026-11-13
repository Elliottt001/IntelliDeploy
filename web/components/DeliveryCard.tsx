'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ApiError,type components} from '@intellideploy/api-client';
import {api} from '../lib/api';
type Detail=components['schemas']['AppDetail'];
export default function DeliveryCard({app}:{app:Detail}){
  const[error,setError]=useState('');const router=useRouter();
  const result=app.delivery;
  if(!result)return null;
  async function open(event:React.MouseEvent<HTMLAnchorElement>){if(!result||result.kind==='EXTERNAL_LINK')return;event.preventDefault();const child=window.open('about:blank','_blank');if(child)child.opener=null;try{const callback=new URL('/api/platform/callback',result.url).href;const {code}=await api.issueLoginCode(result.instance_id,callback);const target=new URL(callback);target.searchParams.set('code',code);if(child)child.location.href=target.href;else window.location.assign(target.href);}catch(exc){child?.close();if(exc instanceof ApiError&&exc.status===401)router.push('/login?next='+encodeURIComponent('/apps/'+app.id));else setError(exc instanceof Error?exc.message:'暂时无法打开应用');}}
  const reportJob=result.report_url.match(/^\/api\/jobs\/([^/]+)\/report$/)?.[1];
  if(result.kind==='EXTERNAL_LINK')return <section><h2>第三方官方服务</h2><p>{result.summary}</p><ul>{result.features.map(feature=><li key={feature}>{feature}</li>)}</ul>{result.differences?.map(difference=><p key={difference}>{difference}</p>)}<div className="actions"><a className="primary" href={result.url} target="_blank" rel="noreferrer">打开官方服务</a><a href={result.repo_url} target="_blank" rel="noreferrer">查看来源仓库</a>{reportJob&&<a href={'/apps/'+app.id+'/report?job='+encodeURIComponent(reportJob)}>查看验证报告</a>}</div></section>;
  return <section><h2>你的应用</h2><p>{result.summary}</p><ul>{result.features.map(feature=><li key={feature}>{feature}</li>)}</ul>{result.differences?.map(difference=><p key={difference}>{difference}</p>)}{app.instance_status==='STOPPED'&&<p>应用已停止，数据仍保留。恢复运行后可以继续使用。</p>}{app.instance_status==='FAILED'&&<p>当前实例暂不可用，历史交付记录仍保留。</p>}<div className="actions">{app.instance_status==='RUNNING'&&<a className="primary" href={result.url} onClick={open} target="_blank" rel="noreferrer">打开应用</a>}<a href={result.artifact_url}>下载源码</a>{reportJob&&<a href={'/apps/'+app.id+'/report?job='+encodeURIComponent(reportJob)}>查看验证报告</a>}</div>{error&&<p role="alert" className="error">{error}</p>}</section>;
}
