import { expect, test } from '@playwright/test';

const fixtureUrl = 'http://127.0.0.1:9100';
test.afterEach(async ({ request }) => { await request.post(`${fixtureUrl}/__fixture__/reset`); });

test('theme persists and the mobile menu closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换为浅色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  await expect(page.getByRole('navigation', { name: '移动导航' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: '移动导航' })).toBeHidden();
});

test('mobile reflows long real-shaped content without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('main a[href="/create"]').first()).toHaveAttribute('href', '/create');
  expect(await page.locator('a').evaluateAll((links) => links.filter((link) => !link.getAttribute('href') || link.getAttribute('href') === '#').length)).toBe(0);
});

test('dynamic sections fail independently without hiding the homepage', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__fixture__/mode`, { data: { catalog: 'error' } }); await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('套餐信息暂时无法加载。')).toBeVisible();
  await expect(page.getByText('面向跨部门协作的公开笔记与知识整理应用')).toBeVisible();
});

test('community failure keeps real pricing visible', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__fixture__/mode`, { data: { community: 'error' } }); await page.goto('/');
  await expect(page.getByText('社区内容暂时无法加载。')).toBeVisible(); await expect(page.getByText('基础额度包')).toBeVisible();
});

test('dynamic sections render truthful empty states', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__fixture__/mode`, { data: { community: 'empty', catalog: 'empty' } }); await page.goto('/');
  await expect(page.getByText('社区暂时还没有公开应用。')).toBeVisible(); await expect(page.getByText('套餐暂未发布。')).toBeVisible();
});

test('reduced motion removes meaningful animation durations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  const maxDurationMs = await page.locator('body').evaluate((body) => {
    const milliseconds = (value: string) => value.split(',').map((part) => { const duration = part.trim(); return duration.endsWith('ms') ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000; });
    return Math.max(...[body, ...body.querySelectorAll('*')].flatMap((element) => { const style = getComputedStyle(element); return [...milliseconds(style.animationDuration), ...milliseconds(style.transitionDuration)]; }));
  });
  expect(maxDurationMs).toBeLessThanOrEqual(0.01);
});

test('marketing fonts do not preload on platform routes', async ({ page }) => {
  await page.goto('/create');
  const platformPreloads = await page.locator('link[rel="preload"][as="font"]').count();
  expect(platformPreloads).toBe(0);
  await page.goto('/');
  const homepagePreloads = await page.locator('link[rel="preload"][as="font"]').count();
  expect(homepagePreloads).toBeLessThanOrEqual(1);
});
