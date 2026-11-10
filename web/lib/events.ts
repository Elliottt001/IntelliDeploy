export function streamJob(jobId:string,cursor:number,onEvent:()=>void){
  const stream=new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events?after_id=${cursor}`);
  stream.addEventListener('job',onEvent);
  stream.onerror=()=>onEvent();
  return ()=>stream.close();
}
