import type { components } from '@intellideploy/api-client';
type Detail=components['schemas']['AppDetail'];
export default function DeliveryCard({app}:{app:Detail}){
  const result=app.delivery;
  if(!result)return null;
  const reportJob=result.report_url.match(/^\/api\/jobs\/([^/]+)\/report$/)?.[1];
  return <section><h2>你的应用</h2><p>{result.summary}</p><ul>{result.features.map(feature=><li key={feature}>{feature}</li>)}</ul>{app.instance_status==='STOPPED'&&<p>应用已停止，数据仍保留。恢复运行后可以继续使用。</p>}{app.instance_status==='FAILED'&&<p>当前实例暂不可用，历史交付记录仍保留。</p>}<div className="actions">{app.instance_status==='RUNNING'&&<a className="primary" href={result.url} target="_blank" rel="noreferrer">打开应用</a>}<a href={result.artifact_url}>下载源码</a>{reportJob&&<a href={'/apps/'+app.id+'/report?job='+encodeURIComponent(reportJob)}>查看验证报告</a>}</div></section>;
}
