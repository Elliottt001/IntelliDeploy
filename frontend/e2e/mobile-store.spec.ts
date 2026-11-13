import {createHash} from 'node:crypto';
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
test('API previews take priority while missing previews show a clearly separate static design illustration',async({page})=>{
 const url='http://127.0.0.1:9199/fixture/notes-preview.svg';
 await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:[publication('preview','实际 API 应用',stamp,url),publication('missing','没有预览的应用',stamp),publication('failed','加载失败的应用',stamp,'http://127.0.0.1:9199/fixture/missing-preview.png')],next_cursor:null}}));
 await page.goto('/store');
 const image=page.getByLabel('实际 API 应用预览',{exact:true});await expect(image).toBeVisible();
 expect((await image.boundingBox())!.width).toBe(214);expect((await image.boundingBox())!.height).toBe(184);
 expect(await image.locator('img').getAttribute('src')).toBe(url);
 await expect(page.getByTestId('store-static-design-illustration-preview')).toHaveCount(0);
 await page.getByTestId('store-carousel-card-missing').click();
 const missing=page.getByTestId('store-preview-placeholder-missing');await expect(missing).toBeVisible();
 await expect(missing).toContainText('示意图 · 暂无应用预览');
 const illustration=page.getByTestId('store-static-design-illustration-missing');await expect(illustration).toBeVisible();
 await expect(illustration).toHaveAttribute('aria-label','示意图，不代表当前应用预览');
 const restoredImage=await page.request.get((await illustration.locator('img').getAttribute('src'))!);expect(restoredImage.status()).toBe(200);
 expect(createHash('sha256').update(await restoredImage.body()).digest('hex')).toBe('d192dc7d4e2e0e05fe7b40c1e0827d79df52ab884909237a195e0d586b0e963a');
 await expect(page.getByLabel('没有预览的应用预览',{exact:true})).toHaveCount(0);
 await page.getByTestId('store-carousel-card-failed').click();
 const failed=page.getByTestId('store-preview-placeholder-failed');await expect(failed).toContainText('预览加载失败');
 await expect(page.getByTestId('store-static-design-illustration-failed')).toHaveCount(0);
});

test('empty public API results never insert static illustration cards or sample applications',async({page})=>{
 await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:[],next_cursor:null}}));
 await page.goto('/store');
 await expect(page.getByText('已加载的应用中没有匹配项',{exact:true})).toBeVisible();
 await expect(page.getByTestId(/^store-carousel-card-/)).toHaveCount(0);
 await expect(page.getByTestId(/^store-static-design-illustration-/)).toHaveCount(0);
});

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

async function authenticate(page: Page) {
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
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

test('optional token storage failure neither becomes unhandled nor blocks public browsing', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    let tokenReads = 0;
    Storage.prototype.getItem = function (key: string) {
      if (key === 'token' && ++tokenReads === 3) {
        throw new Error('fixture token storage failure');
      }
      return original.call(this, key);
    };
  });
  await mockPublications(page);

  await page.goto('/store');

  await expect(page.getByTestId('store-detail')).toContainText('首页应用');
  await expect.poll(() => pageErrors).toEqual([]);
});

test('authenticated store reads every favorite page before showing saved state', async ({ page }) => {
  await authenticate(page);
  await mockPublications(page);
  await page.route('**/api/library/favorites**', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    return route.fulfill({
      json: cursor
        ? { items: [first], next_cursor: null }
        : { items: [second], next_cursor: 'favorites-2' },
    });
  });

  await page.goto('/store');

  await expect(page.getByTestId('store-favorite-first')).toContainText('已收藏');
});

test('successful favorite add and remove update UI only after each response', async ({ page }) => {
  await authenticate(page);
  await mockPublications(page);
  await page.route('**/api/library/favorites**', (route) =>
    route.fulfill({ json: { items: [], next_cursor: null } }),
  );
  let releaseMutation = () => {};
  await page.route('**/api/library/favorites/first', async (route) => {
    await new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/store');
  const favorite = page.getByTestId('store-favorite-first');
  await expect(favorite).toContainText('收藏');

  await favorite.click();
  await expect(favorite).toBeDisabled();
  await expect(favorite).not.toContainText('已收藏');
  releaseMutation();
  await expect(favorite).toContainText('已收藏');

  releaseMutation = () => {};
  await favorite.click();
  await expect(favorite).toBeDisabled();
  await expect(favorite).toContainText('已收藏');
  releaseMutation();
  await expect(favorite).toContainText('收藏');
});

test('store surfaces preserve audited paints, hidden strokes, and separate back rotations', async ({ page }) => {
  await mockPublications(page);
  await page.goto('/store');

  const selected = page.getByTestId('store-carousel-card-first');
  await expect(selected).toHaveCSS('background-color', 'rgb(252, 252, 252)');
  await expect(selected).toHaveCSS('border-top-width', '0px');
  await expect(selected).toHaveCSS('box-shadow', /rgb\(137, 122, 185\)/);
  const searchSurface = page.getByTestId('store-search-surface');
  await expect(searchSurface).toHaveCSS(
    'background-color',
    'rgba(255, 255, 255, 0.2)',
  );
  await expect(searchSurface).toHaveCSS(
    'box-shadow',
    /rgba\(186, 186, 186, 0\.25\)/,
  );
  for (const [testId, degrees] of [
    ['store-carousel-back-5', 5],
    ['store-carousel-back-10', 10],
  ] as const) {
    const rotation = await page.getByTestId(testId).evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
    });
    expect(rotation).toBeCloseTo(degrees, 3);
  }
  const sourceLayerOffsets = await Promise.all(
    [
      ['store-carousel-back-10', 69.28564453125, 0],
      ['store-carousel-back-5', 50.487488746643066, 9.44775390625],
    ].map(async ([testId, left, top]) => {
      const actual = await page.getByTestId(String(testId)).evaluate((element) => {
        const style = getComputedStyle(element);
        return { left: Number.parseFloat(style.left), top: Number.parseFloat(style.top) };
      });
      return { actual, left: Number(left), top: Number(top) };
    }),
  );
  for (const { actual, left, top } of sourceLayerOffsets) {
    expect(actual.left).toBeCloseTo(left, 3);
    expect(actual.top).toBeCloseTo(top, 3);
  }

  await page.goto('/store/ranking');
  const rankingSurface = page.getByTestId('store-ranking-list-surface');
  await expect(rankingSurface).toHaveCSS('border-top-width', '0px');
  await expect(rankingSurface).toHaveCSS(
    'box-shadow',
    /rgb\(130, 118, 166\)/,
  );
});

test('store keeps the 295 by 36 source search surface separate from its 44pt input target', async ({ page }) => {
  await mockPublications(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/store');

  const surface = await page.getByTestId('store-search-surface').boundingBox();
  const target = await page.getByTestId('store-search').boundingBox();
  expect(surface).not.toBeNull();
  expect(target).not.toBeNull();
  expect(surface!.width).toBeCloseTo(295, 1);
  expect(surface!.height).toBeCloseTo(36, 1);
  expect(target!.height).toBeGreaterThanOrEqual(44);
});

test('carousel grows at all five widths and resize preserves the selected publication id', async ({ page }) => {
  await mockPublications(page);
  const viewportWidths: number[] = [];

  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 932 });
    await page.goto('/store');
    viewportWidths.push((await page.getByTestId('store-carousel').boundingBox())!.width);
  }
  expect(viewportWidths).toEqual([...viewportWidths].sort((left, right) => left - right));
  expect(new Set(viewportWidths.map(Math.round)).size).toBe(5);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/store');
  await page.getByTestId('store-carousel-card-second').click();
  await expect(page.getByTestId('store-carousel-card-second')).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.getByTestId('store-carousel-card-second')).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => Math.round((await page.getByTestId('store-carousel-card-second').boundingBox())!.x))
    .toBeGreaterThan(0);
});

test('four unavailable publications remain unavailable without a preview or success claim', async ({ page }) => {
  const unavailable = Array.from({ length: 4 }, (_, index) => ({
    ...publication(
      `unavailable-${index}`,
      index === 0 ? '这是一个很长但仍必须保留真实内容的不可用应用名称' : `不可用应用${index}`,
      stamp,
    ),
    available: false,
    preview_url: null,
    url: null,
  }));
  await page.route('**/api/community/apps**', (route) =>
    route.fulfill({ json: { items: unavailable, next_cursor: null } }),
  );
  await page.goto('/store');

  for (const item of unavailable) {
    const card = page.getByTestId(`store-carousel-card-${item.id}`);
    await expect(card).toContainText('暂不可用');
    await expect(card.getByLabel(`${item.name}预览`, { exact: true })).toHaveCount(0);
    await expect(card).not.toContainText(/获取成功|评分|热度|奖项/);
  }

  await page.goto('/store/ranking');
  await expect(page.getByTestId(/^store-ranking-row-/)).toHaveCount(4);
  await expect(page.getByTestId('store-ranking-row-unavailable-0')).toContainText(
    '这是一个很长但仍必须保留真实内容的不可用应用名称',
  );
  await expect(page.getByTestId('store-ranking-row-unavailable-0')).toContainText('暂不可用');
  await expect(page.getByTestId('store-carousel')).toHaveCount(0);
  await expect(page.getByTestId(/^store-carousel-back-/)).toHaveCount(0);
  await expect(page.getByTestId('mobile-store-ranking')).not.toContainText(/获取成功|评分|热度|奖项/);
  expect(
    await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    })),
  ).toEqual({ client: 375, scroll: 375 });
});

test('store initial errors retry against the existing publication endpoint', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/community/apps**', (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { error: { message: '暂不可用' } } })
      : route.fulfill({ json: { items: [first], next_cursor: null } });
  });
  await page.goto('/store');
  await expect(page.getByText('公开应用暂时无法加载')).toBeVisible();
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.getByTestId('store-carousel-card-first')).toBeVisible();
  expect(attempts).toBe(2);
});

test('horizontal carousel scrolling selects the snapped card', async ({ page }) => {
  await mockPublications(page);
  await page.goto('/store');

  await page.getByTestId('store-carousel').hover();
  await page.mouse.wheel(350, 0);

  await expect(page.getByTestId('store-carousel-card-second')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('store-detail')).toContainText('相邻应用');
});

test('ranking is public and explains its honest recent-update order', async ({ page }) => {
  await mockPublications(page);
  await page.goto('/store/ranking');

  await expect(page.getByRole('heading', { name: '应用商店' })).toBeVisible();
  await expect(page.getByText('热门榜单推荐',{exact:true})).toBeVisible();
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

  for (const width of [320, 360, 375, 390, 430]) {
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

test('ranking controls stay reachable and at least 44px at supported widths', async ({ page }) => {
  await mockPublications(page);

  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/store/ranking');
    for (const target of [
      page.getByRole('button', { name: '返回应用商店' }),
      page.getByRole('button', { name: '分享暂未开放' }),
      page.getByTestId('store-ranking-row-first'),
      page.getByTestId('store-ranking-bottom-nav'),
    ]) {
      const box = await target.boundingBox();
      expect(box, `ranking target should have a layout box at ${width}px`).not.toBeNull();
      expect(box!.height, `ranking target should be at least 44px tall at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box!.x, `ranking target should not overflow left at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `ranking target should not overflow right at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});
