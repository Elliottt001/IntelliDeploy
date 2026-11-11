import JobReportView from '@/components/JobReportView';
export default async function ReportPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{job?:string}>}){
  const {id}=await params;const {job}=await searchParams;
  return job?<JobReportView appId={id} jobId={job}/>:<p>请从应用交付记录打开验证报告。</p>;
}
