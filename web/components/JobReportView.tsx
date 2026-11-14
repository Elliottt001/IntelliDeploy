'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import type { components } from '@intellideploy/api-client';
import { api } from '../lib/api';

export default function JobReportView({appId,jobId}:{appId:string;jobId:string}){
  const [report,setReport]=useState<components['schemas']['JobReport']|null>(null);const [error,setError]=useState('');
  useEffect(()=>{
    Promise.all([api.getJob(jobId),api.getReport(jobId)]).then(([job,data])=>{
      if(job.app_id!==appId)throw new Error('这份报告不属于当前应用');setReport(data);
    }).catch(exc=>setError(exc instanceof Error?exc.message:'暂时无法读取报告'));
  },[appId,jobId]);
  const labels={PASS:'通过',FAIL:'未通过',NOT_RUN:'尚未验证'};
  return <><h1>功能验证报告</h1><Link href={'/apps/'+appId}>返回应用</Link>{error&&<p role="alert" className="error">{error}</p>}{!report&&!error&&<p>正在读取验证结果…</p>}{report&&<><p>核心功能：{labels[report.overall]}</p>{(report.checks??[]).map(check=><section key={check.id}><h2>{check.action}</h2><p>{check.expected}</p><p>{check.importance==='PREFERENCE'?'偏好项，可有差异':labels[check.status]}</p><div className="actions">{(check.evidence_urls??[]).map((url,index)=><a key={url} href={url} target="_blank" rel="noreferrer">{index===0?'查看证据':`查看证据 ${index+1}`}</a>)}</div></section>)}</>}</>;
}
