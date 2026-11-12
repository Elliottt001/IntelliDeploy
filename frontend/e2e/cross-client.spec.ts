import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

// Test-only fixture database; match the backend's DATABASE_URL when overridden.
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test';

test('Web and Expo share real PostgreSQL app, job and conversation IDs', async ({ browser, request }, testInfo) => {
  const apiUrl = 'http://127.0.0.1:9105';
  const username = `cross-${crypto.randomUUID()}`;
  const password = 'test-only-cross-client-password';
  const register = await request.post(`${apiUrl}/auth/register`, { data: { username, password, email: `${username}@test.example` } });
  expect(register.status()).toBe(201);
  const login = await request.post(`${apiUrl}/auth/login`, { data: { username, password } });
  const { access_token: token } = await login.json();
  const webContext = await browser.newContext();
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobileContext.addInitScript(value => localStorage.setItem('token', value), token);
  const web = await webContext.newPage();
  const mobile = await mobileContext.newPage();
  try {
    await web.goto('http://127.0.0.1:3105/login');
    await web.getByLabel('用户名').fill(username);
    await web.getByLabel('密码').fill(password);
    await web.getByRole('button', { name: '登录', exact: true }).click();
    await expect(web).toHaveURL(/\/apps$/);
    await web.goto('http://127.0.0.1:3105/');
    await web.getByLabel('你想做什么应用？').fill('记录梦境并保存历史');
    await web.getByRole('button', { name: '开始创建' }).click();
    await expect(web).toHaveURL(/\/apps\/[a-f0-9-]+$/);
    const appId = new URL(web.url()).pathname.split('/').pop()!;
    const headers = { Authorization: `Bearer ${token}` };
    const detail = await (await request.get(`${apiUrl}/api/apps/${appId}`, { headers })).json();
    const jobId = detail.active_job.id;
    await mobile.goto(`http://127.0.0.1:8085/app-detail/${appId}`);
    await expect(mobile.getByText('记录梦境并保存历史', { exact: true }).last()).toBeVisible();
    await expect(mobile.getByTestId('open-app')).toHaveCount(0);

    // Fixture state only: no model or generation execution is claimed here.
    execFileSync('../.venv/bin/python', ['-c', `
import os,sys
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.jobs.models import Job
engine = create_engine(os.environ['DATABASE_URL'])
with Session(engine) as session:
    job = session.get(Job, sys.argv[1])
    job.status = 'WAITING_USER'
    job.question = '记录是否公开？'
    session.commit()
`, jobId], { env: { ...process.env, DATABASE_URL: databaseUrl, PYTHONPATH: '../backend' } });
    await expect(mobile.getByText('记录是否公开？', { exact: true })).toBeVisible({ timeout: 15000 });
    await mobile.getByTestId('message-input').fill('保持私有');
    await mobile.getByTestId('send-message').click();
    await expect(mobile.getByTestId('message-input')).toHaveValue('');
    await expect(web.getByText('保持私有', { exact: true })).toBeVisible({ timeout: 15000 });
    const after = await (await request.get(`${apiUrl}/api/apps/${appId}`, { headers })).json();
    expect(after.active_job.id).toBe(jobId);
    expect(after.conversation.map((message: { content: string }) => message.content)).toEqual(['记录梦境并保存历史', '保持私有']);

    await mobile.goto('http://127.0.0.1:8085/chatbot');
    await mobile.getByTestId('create-prompt').fill('另一个私有笔记应用');
    await mobile.getByTestId('create-app').click();
    await expect(mobile).toHaveURL(/\/app-detail\/[a-f0-9-]+$/);
    const mobileAppId = new URL(mobile.url()).pathname.split('/').pop()!;
    await web.goto(`http://127.0.0.1:3105/apps/${mobileAppId}`);
    await expect(web.getByText('另一个私有笔记应用', { exact: true }).last()).toBeVisible();
    await mobile.reload();
    await expect(mobile.getByText('另一个私有笔记应用', { exact: true }).last()).toBeVisible();
    const report = await (await request.get(`${apiUrl}/api/jobs/${jobId}/report`, { headers })).json();
    expect(report.overall).toBe('NOT_RUN');
    await testInfo.attach('cross-client-state', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ source_mode: 'fixture', database: new URL(databaseUrl).pathname.slice(1), web_app_id: appId, shared_job_id: jobId, expo_app_id: mobileAppId, report: report.overall })) });
  } finally {
    await webContext.close();
    await mobileContext.close();
  }
});
