import { expect, test } from '@playwright/test';

test('Expo keeps the owned order after reload and verifies paid balance', async ({ page }) => {
  let paid = false;
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-payment-token'));
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 42, username: 'fixture-owner' } }));
  await page.route('**/api/quota/policy', route => route.fulfill({ json: { failed_usage_rule: '已发生用量计费' } }));
  await page.route('**/api/quota/balance', route => route.fulfill({ json: { available_units: paid ? 6000 : 1000, reserved_units: 0 } }));
  await page.route('**/api/quota/usage', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/quota/subscription', route => route.fulfill({ json: null }));
  await page.route('**/api/quota/skus', route => route.fulfill({ json: [{ id: 'pack', name: '基础额度包', provider: 'wechat', currency: 'CNY', amount_minor: 990, units: 5000, period: null }] }));
  const order = () => ({ order_id: 'fixture-mobile-order', name: '基础额度包', status: paid ? 'PAID' : 'CREATED', provider: 'wechat', currency: 'CNY', amount_minor: 990, units: 5000,
    checkout_url: 'https://platform.test/billing/orders/fixture-mobile-order', checkout_kind: 'QR', payment_url: 'weixin://wxpay/test', expires_at: '2099-11-12T00:00:00Z' });
  await page.route('**/api/quota/orders', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    expect(route.request().postDataJSON()).toEqual({ sku_id: 'pack', provider: 'wechat' });
    await route.fulfill({ status: 201, json: order() });
  });
  await page.route('**/api/quota/orders/fixture-mobile-order', route => route.fulfill({ json: order() }));
  await page.goto('/billing');
  await page.getByTestId('buy-pack').click();
  await expect(page.getByTestId('payment-state')).toHaveText('等待支付到账');
  await page.reload();
  await expect(page.getByTestId('payment-state')).toHaveText('等待支付到账');
  paid = true;
  await page.getByTestId('refresh-payment').click();
  await expect(page.getByTestId('payment-state')).toHaveText('支付已到账');
  await expect(page.getByText('可用额度：6000', { exact: true })).toBeVisible();
});
