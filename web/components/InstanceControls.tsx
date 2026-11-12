'use client';
import {useEffect,useState} from 'react';
import {ApiError,type components} from '@intellideploy/api-client';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {api} from '../lib/api';

export default function InstanceControls({app,reload}:{app:components['schemas']['AppDetail'],reload:()=>Promise<void>}){
  const instance=app.instance;const router=useRouter();
  const[operation,setOperation]=useState(instance?.active_operation_id??null);const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[confirmation,setConfirmation]=useState('');const[deleteData,setDeleteData]=useState(false);
  useEffect(()=>{if(instance?.active_operation_id)setOperation(instance.active_operation_id);},[instance?.active_operation_id]);
  useEffect(()=>{if(!operation)return;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const result=await api.getInstanceOperation(operation!,controller.signal);if(controller.signal.aborted)return;
      if(result.status==='SUCCEEDED'||result.status==='FAILED'){setOperation(null);if(result.error)setError(result.error.message);await reload();return;}
    }catch(exc){if(controller.signal.aborted)return;setError(exc instanceof Error?exc.message:'状态暂时无法读取');}timer=setTimeout(()=>void poll(),1500);}
    void poll();return()=>{controller.abort();clearTimeout(timer);};},[operation,reload]);
  async function act(kind:'start'|'stop'|'delete'){if(!instance||busy||operation)return;setBusy(true);setError('');
    const storage=`intellideploy:instance:${instance.id}:${kind}:${kind==='delete'?deleteData:''}`;const key=sessionStorage.getItem(storage)??crypto.randomUUID();sessionStorage.setItem(storage,key);
    try{const result=kind==='start'?await api.startInstance(instance.id,key):kind==='stop'?await api.stopInstance(instance.id,key):await api.deleteInstance(instance.id,deleteData,key);sessionStorage.removeItem(storage);setOperation(result.id);setConfirmation('');}
    catch(exc){if(exc instanceof ApiError&&exc.status===401)router.push('/login?next='+encodeURIComponent('/apps/'+app.id));else setError(exc instanceof Error?exc.message:'操作失败');}finally{setBusy(false);}}
  if(!instance)return null;
  return <section><h2>运行管理</h2>{operation&&<p aria-live="polite">正在处理实例操作</p>}{instance.stop_reason==='QUOTA'&&<p>额度不足，补充额度后可以恢复运行。<Link href={'/billing?return='+encodeURIComponent('/apps/'+app.id)}>补充额度</Link></p>}<div className="actions">{instance.status==='STOPPED'||instance.status==='FAILED'?<button disabled={busy||!!operation||!!app.active_job} onClick={()=>void act('start')}>恢复运行</button>:instance.status==='RUNNING'?<button disabled={busy||!!operation||!!app.active_job} onClick={()=>void act('stop')}>停止运行</button>:null}</div>{instance.status!=='DELETED'&&<details><summary>删除实例</summary><p>运行实例和入口将删除。停止运行会保留数据；删除时可选择是否同时删除数据。</p><label>输入 DELETE 确认<input aria-label="输入 DELETE 确认" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><label><input type="checkbox" checked={deleteData} onChange={e=>setDeleteData(e.target.checked)}/>同时删除该实例的持久数据和文件</label><button disabled={confirmation!=='DELETE'||busy||!!operation||!!app.active_job} onClick={()=>void act('delete')}>确认删除实例</button></details>}{error&&<p role="alert" className="error">{error}</p>}</section>;
}
