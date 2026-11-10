'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ApiError,type components} from '@intellideploy/api-client';
import {api} from '../lib/api';
type Public=components['schemas']['PublicationResponse'];
type Page=components['schemas']['PublicationPage'];

export function PublicationActions({publication}:{publication:Public}){
  const router=useRouter();const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[favorite,setFavorite]=useState(false);
  function failure(exc:unknown){if(exc instanceof ApiError&&exc.status===401)router.push('/login?next='+encodeURIComponent('/community/'+publication.id));else setError(exc instanceof Error?exc.message:'操作失败');}
  async function copy(){if(busy)return;setBusy(true);setError('');const storage='intellideploy:copy:'+publication.id;const key=sessionStorage.getItem(storage)??crypto.randomUUID();sessionStorage.setItem(storage,key);
    try{const result=await api.createCopy(publication.id,undefined,key);sessionStorage.removeItem(storage);router.push('/apps/'+result.app_id);}catch(exc){failure(exc);}finally{setBusy(false);}}
  async function open(event:React.MouseEvent<HTMLAnchorElement>){event.preventDefault();if(!publication.url)return;
    const child=window.open('about:blank','_blank');if(child)child.opener=null;
    try{let url=publication.url;
      try{
        const callback=new URL('/api/platform/callback',url).href;
        const {code}=await api.issueLoginCode(publication.instance_id,callback);
        const target=new URL(callback);target.searchParams.set('code',code);url=target.href;
      }catch(exc){if(!(exc instanceof ApiError&&exc.status===401&&publication.payer_policy==='SPONSOR'))throw exc;}
      try{await api.recordUse(publication.id);}catch(exc){if(!(exc instanceof ApiError&&exc.status===401))throw exc;}
      if(child)child.location.href=url;else window.location.assign(url);
    }catch(exc){child?.close();failure(exc);}}
  async function save(){try{await api.setFavorite(publication.id,!favorite);setFavorite(!favorite);}catch(exc){failure(exc);}}
  useEffect(()=>{let active=true;api.listFavorites().then(p=>{if(active)setFavorite(p.items.some(item=>item.id===publication.id));}).catch(()=>{});return()=>{active=false;};},[publication.id]);
  return <><p className="muted">{publication.payer_policy==='SPONSOR'?`发布者承担调用用量，${publication.sponsor_period==='DAY'?'每日':'每月'}上限 ${publication.sponsor_limit_units} 额度。`:'使用个人额度，使用前登录。'}副本使用独立数据和额度，不复制作者的私有记录。</p><div className="actions">{publication.available&&publication.url?<a className="primary" href={publication.url} onClick={open} target="_blank" rel="noreferrer">直接使用</a>:<p>暂不可用</p>}<button disabled={busy} onClick={()=>void copy()}>创建我的副本</button><button className="secondary" onClick={()=>void save()}>{favorite?'取消收藏':'收藏应用'}</button></div>{error&&<p role="alert" className="error">{error}</p>}</>;
}

export function CommunityList({initial=null,library}:{initial?:Page|null,library?:'favorites'|'recent'}){
  const[data,setData]=useState(initial);const[error,setError]=useState('');const router=useRouter();
  const read=library==='favorites'?api.listFavorites:library==='recent'?api.listRecentApps:api.listPublications;
  useEffect(()=>{let active=true;read().then(value=>{if(active)setData(value);}).catch(exc=>{if(!active)return;if(exc instanceof ApiError&&exc.status===401)router.push('/login?next=/apps');else setError(exc.message);});return()=>{active=false;};},[read,router]);
  async function more(){try{const next=await read(data?.next_cursor??undefined);setData({...next,items:[...(data?.items??[]),...next.items]});}catch(exc){setError(exc instanceof Error?exc.message:'读取失败');}}
  return <>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>正在读取应用…</p>}{data?.items.length===0&&<p>暂时没有应用。</p>}{data?.items.map(p=><section key={p.id}><h2><Link href={'/community/'+p.id}>{p.name}</Link></h2><p>{p.summary}</p><p className="muted">{p.creator} · {p.available?'正在运行':'暂不可用'}</p><Link href={'/community/'+p.id}>查看应用</Link></section>)}{data?.next_cursor&&<button onClick={()=>void more()}>加载更多</button>}</>;
}

export function CommunityDetail({id,initial=null}:{id:string,initial?:Public|null}){
  const[p,setP]=useState(initial);const[error,setError]=useState('');
  useEffect(()=>{let active=true;api.getPublication(id).then(value=>{if(active)setP(value);}).catch(exc=>{if(active){setP(null);setError(exc.message);}});return()=>{active=false;};},[id]);
  if(!p)return <p role={error?'alert':undefined}>{error||'正在读取应用…'}</p>;
  return <><h1>{p.name}</h1><section><p>{p.summary}</p><p className="muted">由 {p.creator} 发布</p><ul>{p.features.map(f=><li key={f}>{f}</li>)}</ul><PublicationActions publication={p}/></section></>;
}
