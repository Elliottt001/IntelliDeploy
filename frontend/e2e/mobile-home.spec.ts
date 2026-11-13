import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  expectTouchTarget,
  installMobileSourceFixtures,
} from './sourceAssertions';

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

  for (const width of [320, 360, 375, 390, 430]) {
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

  for (const width of [320, 360, 375, 390, 430]) {
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

test('home card width follows screen space and expansion reaches its source state', async ({ page }) => {
  await installMobileSourceFixtures(page);
  const widths: number[] = [];

  for (const width of [375, 430]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    const shell = page.getByTestId('home-card-store-shell');
    widths.push((await shell.boundingBox())!.width);
    await page.getByTestId('home-card-store').click();
    await expect(page.getByTestId('home-card-store')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expectTouchTarget(page.getByTestId('home-card-store-open'));
    await expectNoHorizontalOverflow(page);
  }

  expect(widths[1]).toBeGreaterThan(widths[0]);
});

test('home expansion animates through source start middle and end without duplicate navigation', async ({
  page,
}) => {
  await installMobileSourceFixtures(page);
  await page.clock.install({ time: new Date('2026-11-13T00:00:00Z') });
  await page.goto('/');
  const card = page.getByTestId('home-card-store');
  const start = (await card.boundingBox())!;

  await card.click();
  const duringStart = (await card.boundingBox())!;
  expect(duringStart.y).toBeCloseTo(start.y, 1);

  await page.clock.runFor(320);
  const middle = (await card.boundingBox())!;
  expect(middle.y).toBeLessThan(start.y - 8);
  expect(middle.y).toBeLessThan(328);
  expect(middle.y).toBeGreaterThan(320);

  await page.clock.runFor(400);
  const end = (await card.boundingBox())!;
  expect(end.y).toBeCloseTo(328, 2);

  await page.getByTestId('home-card-store-open').click();
  await expect(page).toHaveURL(/\/store$/);
});

test('home hover follows the source card variant without navigating', async ({ page }) => {
  await installMobileSourceFixtures(page);
  await page.goto('/');
  await page.getByTestId('home-card-community').hover();
  await expect(page.getByTestId('home-card-community')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(page).toHaveURL(/\/$/);
});

test('home expansion honors reduced motion by reaching the source target directly', async ({
  page,
}) => {
  await installMobileSourceFixtures(page);
  await page.addInitScript(() => {
    window.matchMedia = (query: string) =>
      ({
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => false,
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      }) as MediaQueryList;
  });
  await page.goto('/');
  const card = page.getByTestId('home-card-store');
  await card.click();
  await expect(card).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await card.boundingBox())!.y).toBeCloseTo(328, 2);
});

test('home expansion can reverse rapidly without leaving a stale source animation', async ({
  page,
}) => {
  await installMobileSourceFixtures(page);
  await page.clock.install({ time: new Date('2026-11-13T00:01:00Z') });
  await page.goto('/');
  const card = page.getByTestId('home-card-store');
  const start = (await card.boundingBox())!;

  await card.click();
  await page.clock.runFor(120);
  const moving = (await card.boundingBox())!;
  expect(moving.y).toBeLessThan(start.y);

  await card.click();
  await page.clock.runFor(720);
  const end = (await card.boundingBox())!;
  expect(end.y).toBeCloseTo(start.y, 1);
  await expect(card).toHaveAttribute('aria-expanded', 'false');
});

test('home source controls stay in bounds on short and long mobile screens', async ({
  page,
}) => {
  await installMobileSourceFixtures(page);

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByTestId('mobile-home')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    for (const target of [
      'home-settings',
      'home-card-store',
      'home-card-products',
      'home-card-community',
      'home-card-profile',
      'home-bottom-nav',
    ]) {
      await expectTouchTarget(page.getByTestId(target));
    }
    await page.getByTestId('home-card-profile').click();
    await expectTouchTarget(page.getByTestId('home-card-profile-open'));
    await expectNoHorizontalOverflow(page);
  }
});
