import { expect, test } from '@playwright/test';

test('billing buys the server SKU and verifies a pending return before showing paid', async ({ page }) => {
  let paid = false;
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, username: 'fixture-owner' } }));
  await page.route('**/api/quota/policy', route => route.fulfill({ json: { failed_usage_rule: '已发生用量计费' } }));
  await page.route('**/api/quota/balance', route => route.fulfill({ json: { available_units: paid ? 6000 : 1000, reserved_units: 0 } }));
  await page.route('**/api/quota/usage', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/quota/subscription', route => route.fulfill({ json: null }));
  await page.route('**/api/quota/skus', route => route.fulfill({ json: [{ id: 'pack', name: '基础额度包', provider: 'wechat', currency: 'CNY', amount_minor: 990, units: 5000, period: null }] }));
  const order = () => ({ order_id: 'fixture-order', name: '基础额度包', status: paid ? 'PAID' : 'CREATED', provider: 'wechat', currency: 'CNY', amount_minor: 990, units: 5000, period: null,
    checkout_kind: 'QR', payment_url: 'weixin://wxpay/test', checkout_url: 'https://platform.test/billing/orders/fixture-order', expires_at: '2099-11-12T00:00:00Z' });
  await page.route('**/api/quota/orders', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    expect(route.request().postDataJSON()).toEqual({ sku_id: 'pack', provider: 'wechat' });
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    await route.fulfill({ status: 201, json: order() });
  });
  await page.route('**/api/quota/orders/fixture-order', route => route.fulfill({ json: order() }));
  await page.goto('/billing');
  await page.getByRole('button', { name: '购买基础额度包' }).click();
  await expect(page).toHaveURL(/\/billing\/orders\/fixture-order(?:\?|$)/);
  await expect(page.getByText('等待支付到账', { exact: true })).toBeVisible();
  await expect(page.getByText('请使用另一台设备扫码', { exact: false })).toBeVisible();
  await expect(page.getByRole('img', { name: '支付二维码' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('支付已到账', { exact: true })).toHaveCount(0);
  paid = true;
  await page.getByRole('button', { name: '刷新支付状态' }).click();
  await expect(page.getByText('支付已到账', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回额度与用量' }).click();
  await expect(page.getByText('可用额度：6000', { exact: true })).toBeVisible();
});
