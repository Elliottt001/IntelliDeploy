'use client';
import {useState} from 'react';
import Link from 'next/link';
import {type components} from '@intellideploy/api-client';
import {api} from '../lib/api';
export default function PublicationSettings({app,reload}:{app:components['schemas']['AppDetail'],reload:()=>Promise<void>}){
 const[policy,setPolicy]=useState<'SPONSOR'|'VISITOR'>(app.publication?.payer_policy??'VISITOR');const[limit,setLimit]=useState(app.publication?.sponsor_limit_units??10000);const[period,setPeriod]=useState<'DAY'|'MONTH'>(app.publication?.sponsor_period??'DAY');const[error,setError]=useState('');const[busy,setBusy]=useState(false);
 const delivery=app.delivery;
 if(!delivery||delivery.kind==='EXTERNAL_LINK')return null;
 async function save(){if(!delivery||delivery.kind==='EXTERNAL_LINK')return;setBusy(true);setError('');try{await api.publish(app.id,{version_id:delivery.version_id,payer_policy:policy,sponsor_period:period,sponsor_limit_units:limit});await reload();}catch(exc){setError(exc instanceof Error?exc.message:'发布失败');}finally{setBusy(false);}}
 async function remove(){setBusy(true);try{await api.unpublish(app.publication!.id);await reload();}catch(exc){setError(exc instanceof Error?exc.message:'取消公开失败');}finally{setBusy(false);}}
 return <section><h2>发布到社区</h2><p>公开应用的用途和使用入口。私有记录、文件和凭据不会公开；成功调整会更新此公开应用，已有独立副本保持原版。</p>{app.publication&&<p><Link href={'/community/'+app.publication.id}>查看社区页面</Link> <button className="secondary" disabled={busy} onClick={()=>void remove()}>取消公开</button></p>}<label>调用费用承担者<select value={policy} onChange={e=>setPolicy(e.target.value as 'SPONSOR'|'VISITOR')}><option value="VISITOR">访问者使用自己的额度</option><option value="SPONSOR">由我赞助有限体验</option></select></label>{policy==='SPONSOR'&&<><label>赞助周期<select value={period} onChange={e=>setPeriod(e.target.value as 'DAY'|'MONTH')}><option value="DAY">每日</option><option value="MONTH">每月</option></select></label><label>赞助额度上限<input type="number" min="1" value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label></>}<button disabled={busy||!!app.active_job||app.instance_status!=='RUNNING'||limit<=0} onClick={()=>void save()}>{app.publication?'更新公开设置':'发布应用'}</button>{error&&<p role="alert" className="error">{error}</p>}</section>;
}
