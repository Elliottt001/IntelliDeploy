import { expect, test, type Page } from '@playwright/test';

const stamp = '2026-11-10T00:00:00Z';
const publication = (id: string, name: string, updatedAt: string, previewUrl: string | null = null) => ({
  id,
  app_id: `app-${id}`,
  instance_id: `instance-${id}`,
  version_id: `version-${id}`,
  name,
  summary: `${name}的真实摘要`,
  features: [],
  creator: `${name}作者`,
  preview_url: previewUrl,
  url: null,
  available: id !== 'second',
  payer_policy: 'VISITOR',
  sponsor_period: 'DAY',
  sponsor_limit_units: 100,
  copy_url: `/api/publications/${id}/copies`,
  updated_at: updatedAt,
});

const first = publication('first', '首页应用', stamp, 'https://broken.invalid/preview.png');
const second = publication('second', '相邻应用', '2026-11-09T00:00:00Z');
const third = publication('third', '第二页应用', '2026-11-11T00:00:00Z');

async function mockPublications(page: Page) {
  await page.route('https://broken.invalid/**', (route) => route.abort());
  await page.route('**/api/community/apps**', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    return route.fulfill({
      json: cursor
        ? { items: [second, third], next_cursor: null }
        : { items: [first, second], next_cursor: 'page-2' },
    });
  });
}

test('anonymous store selects real cards, searches loaded pages, deduplicates paging, and opens detail', async ({ page }) => {
  await mockPublications(page);
  await page.goto('/store');

  await expect(page.getByTestId('mobile-store')).toBeVisible();
  await expect(page.getByRole('button', { name: '设置暂未开放' })).toBeDisabled();
  await expect(page.getByTestId('store-bottom-nav')).toBeVisible();
  await expect(
    page.getByTestId('store-bottom-nav').getByRole('tab', { name: '应用', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('store-detail')).toContainText('首页应用');
  await page.getByTestId('store-carousel-card-second').click();
  await expect(page.getByTestId('store-detail')).toContainText('相邻应用');
  await expect(page.getByTestId('store-carousel-card-second')).toHaveAttribute('aria-selected', 'true');

  await page.getByTestId('store-search').fill('第二页');
  await expect(page.getByText('已加载的应用中没有匹配项')).toBeVisible();
  await page.getByTestId('store-search').fill('');
  await expect(page.getByText('还有更多应用，可继续加载')).toBeVisible();
  await page.getByTestId('store-load-more').click();
  await expect(page.getByTestId('store-carousel-card-third')).toBeVisible();
  await expect(page.getByTestId('store-carousel-card-second')).toHaveCount(1);

  await page.getByTestId('store-search').fill('第二页');
  await expect(page.getByTestId('store-detail')).toContainText('第二页应用');
  await page.getByTestId('store-open-third').click();
  await expect(page).toHaveURL(/\/community\/third$/);
});

test('broken previews keep a stable neutral frame and a 401 favorite returns through login without false state', async ({ page }) => {
  await mockPublications(page);
  await page.route('**/auth/login', (route) =>
    route.fulfill({ json: { access_token: 'fixture-token' } }),
  );
  await page.route('**/api/library/favorites**', (route) =>
    route.fulfill({ json: { items: [], next_cursor: null } }),
  );
  await page.route('**/api/library/favorites/first', (route) =>
    route.fulfill({ status: 401, json: { error: { message: '请先登录' } } }),
  );

  await page.goto('/store');
  const previewBefore = await page.getByTestId('store-preview-frame-first').boundingBox();
  await expect(page.getByTestId('store-preview-placeholder-first')).toBeVisible();
  expect(await page.getByTestId('store-preview-frame-first').boundingBox()).toEqual(previewBefore);

  await page.getByTestId('store-favorite-first').click();
  await expect(page).toHaveURL(/\/login\?next=%2Fstore$/);
  await page.getByTestId('login-account').fill('visitor');
  await page.getByTestId('login-password').fill('password');
  await page.getByTestId('login-privacy').click();
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/store$/);
  await expect(page.getByTestId('store-favorite-first').last()).toContainText('收藏');
  await expect(page.getByTestId('store-favorite-first').last()).not.toContainText('已收藏');
});

test('ranking is public and explains its honest recent-update order', async ({ page }) => {
  await mockPublications(page);
  await page.goto('/store/ranking');

  await expect(page.getByRole('heading', { name: '热门榜单' })).toBeVisible();
  await expect(page.getByText('按最近更新时间排序')).toBeVisible();
  const rows = page.getByTestId(/^store-ranking-row-/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('首页应用');
  await expect(page.getByRole('button', { name: '分享暂未开放' })).toBeDisabled();
  await expect(page.getByTestId('store-ranking-bottom-nav')).toBeVisible();

  await page.getByRole('button', { name: '返回应用商店' }).click();
  await expect(page).toHaveURL(/\/store$/);
});

test('store controls stay reachable and at least 44px at supported widths', async ({ page }) => {
  await mockPublications(page);

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/store');
    for (const target of [
      'store-search',
      'store-ranking-open',
      'store-carousel-card-first',
      'store-favorite-first',
      'store-open-first',
      'store-load-more',
      'store-bottom-nav',
    ]) {
      const box = await page.getByTestId(target).boundingBox();
      expect(box, `${target} should have a layout box at ${width}px`).not.toBeNull();
      expect(box!.height, `${target} should be at least 44px tall at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box!.x, `${target} should not overflow left at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${target} should not overflow right at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});
