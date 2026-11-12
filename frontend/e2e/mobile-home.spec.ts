import { expect, test } from '@playwright/test';

test('home cards expand without changing their real destination', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
  await page.route('**/auth/me', (route) =>
    route.fulfill({ json: { id: 1, username: 'Oasis' } }),
  );

  await page.goto('/');
  await expect(page.getByText('Hi！Oasis')).toBeVisible();
  await page.getByTestId('home-card-products').click();
  await expect(page.getByTestId('home-card-products')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByTestId('home-card-products-open').click();
  await expect(page).toHaveURL(/\/app-gallery$/);
});

test('home layout keeps controls reachable at mobile widths', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
  await page.route('**/auth/me', (route) =>
    route.fulfill({ json: { id: 1, username: 'Oasis' } }),
  );

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    await expect(page.getByTestId('mobile-home')).toBeVisible();

    for (const target of [
      'home-settings',
      'home-mibo-open',
      'home-suggestion-notes',
      'home-card-store',
      'home-card-products',
      'home-card-community',
      'home-card-profile',
      'home-bottom-nav',
    ]) {
      const box = await page.getByTestId(target).boundingBox();
      expect(box, `${target} should have a layout box at ${width}px`).not.toBeNull();
      expect(box!.height, `${target} should be at least 44px tall at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${target} should be at least 44px wide at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box!.x, `${target} should not overflow left at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${target} should not overflow right at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});

test('each home card exposes an in-bounds 44px open action when expanded', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
  await page.route('**/auth/me', (route) =>
    route.fulfill({ json: { id: 1, username: 'Oasis' } }),
  );

  for (const width of [320, 375, 430]) {
    for (const card of ['store', 'products', 'community', 'profile']) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/');
      await page.getByTestId(`home-card-${card}`).click();
      await expect(page.getByTestId(`home-card-${card}`)).toHaveAttribute(
        'aria-expanded',
        'true',
      );

      const box = await page.getByTestId(`home-card-${card}-open`).boundingBox();
      expect(box, `${card} open action should have a layout box at ${width}px`).not.toBeNull();
      expect(box!.height, `${card} open action should be at least 44px tall at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${card} open action should be at least 44px wide at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box!.x, `${card} open action should not overflow left at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${card} open action should not overflow right at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});

test('visible source inspiration words are real curated prompt actions',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis',email:'owner@test'}}));
 await page.route('**/api/quota/**',r=>r.fulfill({json:{available_units:900,reserved_units:0,default_budget_units:100,hard_cap_units:1000,price_version:'fixture',failed_usage_rule:'失败按实际用量结算',items:[]}}));
 await page.goto('/');await page.getByRole('button',{name:'AI Copilot',exact:true}).click();
 await expect(page).toHaveURL(/\/chatbot\?prompt=/);
 await expect(page.getByTestId('create-prompt')).toHaveValue('创建一个用于记录、搜索和整理私人笔记的 AI Copilot');
});
