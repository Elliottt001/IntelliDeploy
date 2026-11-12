'use client';

import { useEffect, useState } from 'react';
import type { components } from '@intellideploy/api-client';
import { ApiError } from '@intellideploy/api-client';
import EvaluationResult from '@/components/EvaluationResult';
import PlatformHeader from '@/components/PlatformHeader';
import { api, type AlgorithmMode } from '@/lib/api';

type Target = components['schemas']['EvaluationTarget'];

export default function EvaluationPage() {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [prompt, setPrompt] = useState('');
  const [budget, setBudget] = useState('');
  const [targetId, setTargetId] = useState('');
  const [algorithmMode, setAlgorithmMode] = useState<AlgorithmMode>('baseline');
  const [run, setRun] = useState<{ appId: string; jobId: string } | null>(null);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listEvaluationTargets().then(setTargets).catch((exc: unknown) => {
      if (exc instanceof ApiError && exc.status === 404) setUnavailable(true);
      else setError(exc instanceof Error ? exc.message : '无法读取评测目标');
    });
  }, []);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError('');
    const operationId = crypto.randomUUID();
    try {
      const created = await api.createEvaluationRun(
        prompt,
        budget ? Number(budget) : undefined,
        targetId || undefined,
        algorithmMode,
        operationId,
      );
      setRun({ appId: created.app_id, jobId: created.job_id });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : '评测任务创建失败');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PlatformHeader />
    <main className="platform-shell evaluation-shell">
      {unavailable ? <section>
        <p className="eyebrow">Developer evaluation</p>
        <h1>评测入口不可用</h1>
        <p>该入口默认关闭，仅授权开发者可以访问。</p>
      </section> : <>
        <header className="evaluation-hero">
          <p className="eyebrow">Developer evaluation</p>
          <h1>用真实流水线衡量交付</h1>
          <p>这里不会启动第二套生成器。任务仍通过应用、Worker、业务验证与发布链路执行，夹具结果与真实证据分开显示。</p>
        </header>
        <section>
          <form onSubmit={start}>
            <label htmlFor="evaluation-prompt">评测需求
              <textarea id="evaluation-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={20000} required disabled={busy} placeholder="描述一个可验证的真实业务需求" />
            </label>
            <div className="evaluation-form-grid">
              <label htmlFor="evaluation-budget">预算额度（可选）
                <input id="evaluation-budget" type="number" min="1" value={budget} onChange={event => setBudget(event.target.value)} disabled={busy} />
              </label>
              <label htmlFor="evaluation-target">评测目标
                <select id="evaluation-target" value={targetId} onChange={event => setTargetId(event.target.value)} disabled={busy || targets === null}>
                  <option value="">自动选择</option>
                  {(targets ?? []).map(target => <option value={target.target_id} key={target.target_id}>{target.name} · {target.kind}</option>)}
                </select>
              </label>
              <label htmlFor="evaluation-algorithm-mode">算法模式
                <select id="evaluation-algorithm-mode" value={algorithmMode} onChange={event => setAlgorithmMode(event.target.value as AlgorithmMode)} disabled={busy}>
                  <option value="baseline">Baseline</option>
                  <option value="shadow">Shadow</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
            </div>
            <p className="muted">固定目标只覆盖部署资源选择，不会改变检索与自动选路。</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button disabled={busy || targets === null}>{busy ? '正在创建' : '启动评测'}</button>
          </form>
        </section>
        {run && <EvaluationResult appId={run.appId} jobId={run.jobId} />}
      </>}
    </main>
  </>;
}
