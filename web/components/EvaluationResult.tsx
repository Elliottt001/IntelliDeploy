'use client';

import { useEffect, useState } from 'react';
import type { components } from '@intellideploy/api-client';
import { api } from '@/lib/api';

type Job = components['schemas']['JobSnapshot'];
type Diagnostics = components['schemas']['EvaluationRecord'];
type Report = components['schemas']['JobReport'];

export default function EvaluationResult({ appId, jobId }: { appId: string; jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const snapshot = await api.getJob(jobId, controller.signal);
        if (!active) return;
        setJob(snapshot);
        const [nextDiagnostics, nextReport] = await Promise.all([
          api.getDiagnostics(jobId, controller.signal),
          api.getReport(jobId),
        ]);
        if (!active) return;
        setDiagnostics(nextDiagnostics);
        setReport(nextReport);
        if (['QUEUED', 'RUNNING'].includes(snapshot.status)) {
          window.setTimeout(load, 2000);
        }
      } catch (exc) {
        if (!active || (exc instanceof DOMException && exc.name === 'AbortError')) return;
        setError(exc instanceof Error ? exc.message : '无法读取评测记录');
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [jobId]);

  return <section aria-live="polite">
    <div className="evaluation-heading">
      <div>
        <p className="eyebrow">评测任务</p>
        <h2><code>{jobId}</code></h2>
      </div>
      <a className="primary" href={`/apps/${appId}`}>查看应用任务</a>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {!job && !error && <p>正在读取任务状态…</p>}
    {job && <div className="evaluation-grid">
      <div className="metric"><span>状态</span><strong>{job.status}</strong></div>
      <div className="metric"><span>阶段</span><strong>{job.phase}</strong></div>
      <div className="metric"><span>用量</span><strong>{job.usage_units}</strong></div>
      <div className="metric"><span>验收</span><strong>{report?.overall ?? 'NOT_RUN'}</strong></div>
    </div>}
    {diagnostics && <>
      {diagnostics.source_mode === 'fixture'
        ? <p className="evaluation-warning">测试夹具，不计入真实交付指标</p>
        : <p className="evaluation-real">已绑定真实发布与业务验证证据</p>}
      <dl className="diagnostic-list">
        <div><dt>实际路线</dt><dd>{diagnostics.route ?? '尚未选路'}</dd></div>
        <div><dt>路由模式</dt><dd>{diagnostics.routing_mode}</dd></div>
        <div><dt>目标</dt><dd>{diagnostics.target_id ?? '自动选择'}</dd></div>
        <div><dt>模型</dt><dd>{diagnostics.model}</dd></div>
        <div><dt>价格版本</dt><dd>{diagnostics.price_version}</dd></div>
        <div><dt>费用</dt><dd>{diagnostics.cost_status === 'known' ? diagnostics.cost_units : '待核对'}</dd></div>
        <div><dt>总耗时</dt><dd>{Math.round(diagnostics.duration_ms / 1000)} 秒</dd></div>
      </dl>
      {diagnostics.result && <div className="evaluation-links">
        <a href={diagnostics.result.url} rel="noreferrer" target="_blank">打开交付 URL</a>
        <a href={diagnostics.result.report_url}>查看验证报告</a>
        <a href={diagnostics.result.artifact_url}>下载交付产物</a>
      </div>}
      {(diagnostics.phase_durations ?? []).length > 0 && <div>
        <h3>阶段耗时</h3>
        <ul className="evaluation-compact-list">
          {(diagnostics.phase_durations ?? []).map(item => <li key={item.phase}>{item.phase} · {Math.round(item.duration_ms / 1000)} 秒</li>)}
        </ul>
      </div>}
      {(diagnostics.sources ?? []).length > 0 && <div>
        <h3>实际来源</h3>
        <ul className="evaluation-compact-list">
          {(diagnostics.sources ?? []).map((source, index) => <li key={`${source.url}-${source.commit}-${source.role}`}>
            <a href={source.url} rel="noreferrer" target="_blank">来源 {index + 1}</a> · {source.role} · <code>{source.commit}</code>
          </li>)}
        </ul>
      </div>}
      {(diagnostics.retrieval.candidates ?? []).length > 0 && <div>
        <h3>检索候选</h3>
        <ol className="candidate-list">
          {(diagnostics.retrieval.candidates ?? []).map(candidate => <li key={`${candidate.rank}-${candidate.repo_url}`}>
            <a href={candidate.repo_url} rel="noreferrer" target="_blank">{candidate.repo_url}</a>
            <span>匹配 {candidate.match_score ?? '未知'} · 部署 {candidate.deploy_score ?? '未知'} · 质量 {candidate.quality_score ?? '未知'}</span>
          </li>)}
        </ol>
      </div>}
      {report && (report.checks ?? []).length > 0 && <div>
        <h3>业务证据</h3>
        {(report.checks ?? []).map(check => <div className="message" key={check.id}>
          <strong>{check.action}</strong>
          <p>{check.expected}</p>
          <span>{check.status}</span>
          {(check.evidence_urls ?? []).map((url, index) => <p key={url}>
            <a href={url} rel="noreferrer" target="_blank">{check.id} 证据 {index + 1}</a>
          </p>)}
        </div>)}
      </div>}
    </>}
  </section>;
}
