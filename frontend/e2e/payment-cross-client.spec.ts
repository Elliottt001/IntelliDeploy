import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { resolveTestDatabaseUrl } from './testDatabase';

const databaseUrl = resolveTestDatabaseUrl();
const databaseName = new URL(databaseUrl).pathname.slice(1);

test('signed payment updates the same owned order and balance in Web and Expo, then resumes the paused job', async ({ browser, request }, testInfo) => {
  const apiUrl = 'http://127.0.0.1:9105';
  const username = 'payment-' + crypto.randomUUID();
  const password = 'test-only-payment-password';
  expect((await request.post(apiUrl + '/auth/register', { data: { username, password, email: username + '@test.example' } })).status()).toBe(201);
  const { access_token: token } = await (await request.post(apiUrl + '/auth/login', { data: { username, password } })).json();
  const headers = { Authorization: 'Bearer ' + token };
  execFileSync('../.venv/bin/python', ['-c', `
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.billing.models import ProductSku
engine=create_engine(os.environ['DATABASE_URL'])
with Session(engine) as db:
    if not db.get(ProductSku,'browser-payment-pack'):
        db.add(ProductSku(id='browser-payment-pack',name='跨端测试额度包',provider='alipay',currency='CNY',amount_minor=990,units=5000))
    db.commit()
`], { env: { ...process.env, DATABASE_URL: databaseUrl, PYTHONPATH: '../backend' } });
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
    await mobile.goto('http://127.0.0.1:8085/billing');
    await mobile.getByTestId('buy-browser-payment-pack').click();
    await expect(mobile.getByTestId('payment-state')).toHaveText('等待支付到账');
    const orders = await (await request.get(apiUrl + '/api/quota/orders', { headers })).json();
    const orderId = orders[0].order_id;
    await web.goto('http://127.0.0.1:3105/billing/orders/' + orderId);
    await expect(web.getByText('等待支付到账', { exact: true })).toBeVisible();
    const data: Record<string, string> = { app_id: 'browser-test-app', seller_id: 'browser-test-seller', out_trade_no: orderId,
      trade_no: 'browser-trade-' + orderId, total_amount: '9.90', trade_status: 'TRADE_SUCCESS', notify_id: 'browser-notice-' + orderId, sign_type: 'RSA2' };
    const canonical = Object.keys(data).sort().filter(key => key !== 'sign_type').map(key => key + '=' + data[key]).join('&');
    data.sign = createSign('RSA-SHA256').update(canonical).sign(readFileSync('../artifacts/payment-browser-fixture/private.pem'), 'base64');
    for (let index = 0; index < 2; index++) expect((await request.post(apiUrl + '/api/quota/payments/alipay/notify', { form: data })).status()).toBe(200);
    await mobile.getByTestId('refresh-payment').click();
    await expect(mobile.getByTestId('payment-state')).toHaveText('支付已到账');
    await expect(mobile.getByText('可用额度：6000', { exact: true })).toBeVisible();
    await web.getByRole('button', { name: '刷新支付状态' }).click();
    await expect(web.getByText('支付已到账', { exact: true })).toBeVisible();
    await web.goto('http://127.0.0.1:3105/billing');
    await expect(web.getByText('可用额度：6000', { exact: true })).toBeVisible();
    const created = await (await request.post(apiUrl + '/api/apps', { headers: { ...headers, 'Idempotency-Key': 'payment-job' }, data: { prompt: '跨端支付恢复测试', budget_units: 100 } })).json();
    execFileSync('../.venv/bin/python', ['-c', `
import os, sys
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.jobs.models import Job
engine=create_engine(os.environ['DATABASE_URL'])
with Session(engine) as db:
    job=db.get(Job,sys.argv[1]); job.status='PAUSED_QUOTA'; db.commit()
`, created.job_id], { env: { ...process.env, DATABASE_URL: databaseUrl, PYTHONPATH: '../backend' } });
    await mobile.goto('http://127.0.0.1:8085/app-detail/' + created.app_id);
    await mobile.getByTestId('resume-job').click();
    await expect.poll(async () => (await (await request.get(apiUrl + '/api/jobs/' + created.job_id, { headers })).json()).status).toBe('QUEUED');
    await testInfo.attach('payment-cross-client-evidence', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ source_mode: 'fixture', provider: 'substituted', database: databaseName, order_id: orderId, same_job_id: created.job_id, signed_notification: true, credits_granted: 5000, real_merchant: 'NOT_RUN' })) });
  } finally { await webContext.close(); await mobileContext.close(); }
});
