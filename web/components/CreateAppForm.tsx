'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@intellideploy/api-client';
import { api } from '@/lib/api';

export default function CreateAppForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rule, setRule] = useState('');

  useEffect(() => {
    setPrompt(localStorage.getItem('intellideploy:draft') ?? '');
    api.getPolicy().then((policy) => setRule(policy.failed_usage_rule)).catch(() => {});
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError('');
    localStorage.setItem('intellideploy:draft', prompt);
    const key = sessionStorage.getItem('intellideploy:create-key') ?? crypto.randomUUID();
    sessionStorage.setItem('intellideploy:create-key', key);
    try {
      const result = await api.createApp(prompt, undefined, key);
      localStorage.removeItem('intellideploy:draft');
      sessionStorage.removeItem('intellideploy:create-key');
      router.push(`/apps/${result.app_id}`);
    } catch (exc) {
      if (exc instanceof ApiError && exc.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/create')}`);
      } else {
        setError(exc instanceof Error ? exc.message : '网络连接失败，请稍后重试');
      }
    } finally {
      setBusy(false);
    }
  }

  return <>
    <h1>把你的想法变成应用</h1>
    <p>说说你想解决什么问题。我们会准备应用、验证功能，并在完成后提供使用入口。</p>
    <section>
      <form onSubmit={create}>
        <label htmlFor="prompt">你想做什么应用？
          <textarea id="prompt" disabled={busy} value={prompt} onChange={(event) => {
            setPrompt(event.target.value);
            localStorage.setItem('intellideploy:draft', event.target.value);
            sessionStorage.removeItem('intellideploy:create-key');
          }} placeholder="例如：记录我的梦境，用 AI 分析，并保存历史" required maxLength={20000} />
        </label>
        {rule ? <p className="muted">{rule}</p> : <p className="muted">登录后查看账户额度与用量规则，再开始创建。</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <button disabled={busy}>{busy ? '正在提交' : '开始创建'}</button>
      </form>
    </section>
  </>;
}
