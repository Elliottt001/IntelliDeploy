import { expect, test, type Page } from '@playwright/test';

const app = (id: string, source: string | null = null, status: string | null = 'RUNNING') => ({ id, name: `真实应用-${id}`, updated_at: '', source_version_id: source, active_job_id: null, instance_status: status });
const publication = (id: string) => ({ id, app_id: `private-${id}`, instance_id: `instance-${id}`, version_id: `version-${id}`, name: `公开应用-${id}`, summary: `${id}摘要`, features: [], creator: '真实作者', preview_url: null, url: null, available: true, payer_policy: 'VISITOR', sponsor_period: 'DAY', sponsor_limit_units: 100, copy_url: `/api/publications/${id}/copies`, updated_at: '' });
async function auth(page: Page) { await page.addInitScript(() => localStorage.setItem('token', 'fixture-token')); }
async function apps(page: Page, empty = false) {
  await auth(page);
  await page.route('**/api/apps?**', route => route.fulfill({ json: { items: [app('later', 'v2', 'FAILED')], next_cursor: null } }));
  await page.route('**/api/apps', route => route.fulfill({ json: { items: empty ? [] : [app('created'), { ...app('copy', 'v1'), active_job_id: 'job' }], next_cursor: empty ? null : 'page-2' } }));
}
async function library(page: Page, kind: 'favorites' | 'recent', empty = false) {
  await auth(page);
  await page.route(`**/api/library/${kind}**`, route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('cursor') ? { items: [publication('last')], next_cursor: null } : { items: empty ? [] : [publication('z-first'), publication('a-second')], next_cursor: empty ? null : 'page-2' } }));
}

test('created/copy folders start closed, expand real rows, page and route with App IDs', async ({ page }) => {
  await apps(page); await page.goto('/app-gallery');
  await expect(page.getByTestId('mobile-products')).toBeVisible();
  await expect(page.getByTestId('product-folder-created')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('product-row-created')).toHaveCount(0);
  await expect(page.getByTestId('product-folder-created')).toContainText('已加载 1 个');
  await page.getByTestId('product-folder-created').click();
  await expect(page.getByTestId('product-folder-created')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('product-row-created')).toContainText('应用正在运行');
  await page.getByRole('button', { name: '我的副本', exact: true }).click();
  await page.getByTestId('product-folder-copies').click();
  await expect(page.getByTestId('product-row-copy')).toContainText('正在处理需求');
  await page.getByTestId('products-load-more').click();
  await expect(page.getByTestId('product-row-later')).toContainText('应用暂不可用');
  await expect(page.getByTestId('product-folder-copies')).toContainText('2 个');
  await page.getByTestId('product-row-copy').click();
  await expect(page).toHaveURL(/\/app-detail\/copy$/);
});

test('empty folders contain no example art or fake apps and retain creation action', async ({ page }) => {
  await apps(page, true); await page.goto('/app-gallery');
  await expect(page.getByTestId('product-folder-created')).toContainText('0 个');
  await page.getByTestId('product-folder-created').click();
  await expect(page.getByText('这个文件夹还没有应用')).toBeVisible();
  await expect(page.getByTestId(/^product-row-/)).toHaveCount(0);
  await expect(page.getByTestId(/^folder-item-/)).toHaveCount(0);
  await page.getByRole('button', { name: '我的副本', exact: true }).click();
  await page.getByTestId('product-folder-copies').click();
  await expect(page.getByText('这个文件夹还没有应用')).toBeVisible();
  await page.getByRole('button', { name: '新建应用', exact: true }).click();
  await expect(page).toHaveURL(/\/chatbot$/);
});

for (const kind of ['favorites', 'recent'] as const) {
  test(`${kind} keeps API order, paging and Publication IDs`, async ({ page }) => {
    await library(page, kind); await page.goto(`/library/${kind}`);
    await page.getByTestId(`product-folder-${kind}`).click();
    const rows = page.getByTestId(/^product-row-/);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('z-first');
    await expect(rows.nth(1)).toContainText('a-second');
    await page.getByTestId('library-load-more').click();
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('z-first');
    await page.getByTestId('product-row-a-second').click();
    await expect(page).toHaveURL(/\/community\/a-second$/);
  });
  test(`${kind} empty and paging errors preserve honest contents with retry`, async ({ page }) => {
    await library(page, kind, true); await page.goto(`/library/${kind}`);
    await page.getByTestId(`product-folder-${kind}`).click();
    await expect(page.getByText('这个文件夹还没有应用')).toBeVisible();
    await expect(page.getByTestId(/^product-row-/)).toHaveCount(0);
    await page.unroute(`**/api/library/${kind}**`);
    let failing = true;
    await page.route(`**/api/library/${kind}**`, route => {
      if (new URL(route.request().url()).searchParams.has('cursor') && failing) return route.fulfill({ status: 503, json: { error: { message: '稍后重试' } } });
      return route.fulfill({ json: { items: [publication('kept')], next_cursor: 'page-2' } });
    });
    await page.reload(); await page.getByTestId(`product-folder-${kind}`).click();
    await page.getByTestId('library-load-more').click();
    await expect(page.getByRole('alert')).toContainText('更多应用加载失败');
    await expect(page.getByTestId('product-row-kept')).toBeVisible();
    failing = false; await page.getByTestId('library-load-more').click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
  test(`${kind} 401 on initial read or paging clears token and preserves safe next`, async ({ page }) => {
    await library(page, kind); await page.goto(`/library/${kind}`);
    await page.route(`**/api/library/${kind}?**`, route => route.fulfill({ status: 401, json: { error: { message: '请登录' } } }));
    await page.getByTestId('library-load-more').click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Flibrary%2F${kind}$`));
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    await page.evaluate(() => localStorage.setItem('token', 'fixture-token'));
    await page.route(`**/api/library/${kind}**`, route => route.fulfill({ status: 401, json: { error: { message: '请登录' } } }));
    await page.goto(`/library/${kind}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Flibrary%2F${kind}$`));
  });
}

test('four destinations and 44pt controls fit 320/375/430 without root scaling', async ({ page }) => {
  await apps(page); await library(page, 'favorites'); await library(page, 'recent');
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 812 }); await page.goto('/app-gallery');
    for (const target of [page.getByTestId('product-folder-created'), page.getByTestId('products-load-more'), ...['我创建的', '我的副本', '我的收藏', '最近使用'].map(name => page.getByRole('button', { name, exact: true }))]) {
      const box = await target.boundingBox(); expect(box).not.toBeNull(); expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await expect(page.getByTestId('mobile-products')).toHaveCSS('transform', 'none');
    await page.getByRole('button', { name: '我的收藏', exact: true }).click(); await expect(page).toHaveURL(/\/library\/favorites$/);
    await page.getByRole('button', { name: '返回我的产品' }).click();
    await page.getByRole('button', { name: '最近使用', exact: true }).click(); await expect(page).toHaveURL(/\/library\/recent$/);
  }
});

test('app initial/paging errors and 401 retain retry and the protected destination', async ({ page }) => {
  await apps(page);
  await page.route('**/api/apps', route => route.fulfill({ status: 503, json: { error: { message: '暂不可用' } } }));
  await page.goto('/app-gallery'); await expect(page.getByRole('alert')).toContainText('应用暂时无法加载');
  await page.unroute('**/api/apps'); await page.route('**/api/apps', route => route.fulfill({ json: { items: [app('kept')], next_cursor: 'next' } }));
  await page.getByRole('button', { name: '重试' }).click(); await page.getByTestId('product-folder-created').click();
  await page.route('**/api/apps?**', route => route.fulfill({ status: 503, json: { error: { message: '暂不可用' } } }));
  await page.getByTestId('products-load-more').click(); await expect(page.getByTestId('product-row-kept')).toBeVisible();
  await page.route('**/api/apps?**', route => route.fulfill({ status: 401, json: { error: { message: '请登录' } } }));
  await page.getByTestId('products-load-more').click(); await expect(page).toHaveURL(/\/login\?next=%2Fapp-gallery$/);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('formal folder paths, gradients and upward glyph coordinates reach the runtime unchanged', async ({ page }, testInfo) => {
  await apps(page); await page.goto('/app-gallery');
  const folder = page.getByTestId('product-folder-created');
  await expect(folder.locator('path').first()).toHaveAttribute('d', /^M0 20 C0 8\.954305 8\.954306 0 20 0 L73\.16523 0/);
  await expect(folder.locator('path').first()).not.toHaveAttribute('stroke');
  await expect(folder.locator('stop').first()).toHaveAttribute('stop-color', '#7C62FF');
  await expect(folder.locator('path[fill="#FFFFFF"][opacity="0.1"]')).toHaveAttribute('d', /^M0 20 C0 8\.954305 8\.954306 0 20 0 L240 0/);
  await expect(folder.locator('path[fill="#FFFFFF"][opacity="0.1"]').locator('..')).toHaveAttribute('transform', 'matrix(1 0 0 1 10 55)');
  await expect(folder.locator('path[fill="#EC3EDD"]').first()).toBeAttached();
  await expect(page.getByLabel('COLLECTION').locator('path').first()).toHaveAttribute('transform', /scale\(24 -24\)/);
  if (process.env.INTELLIDEPLOY_PRODUCT_CAPTURE) await page.screenshot({ path: testInfo.outputPath('products-closed.png'), fullPage: true });
  await folder.click();
  await expect(folder.locator('path').first().locator('..')).toHaveAttribute('transform', /matrix\(0\.9938837289810181 0\.11043152958154678 0 1 10 0\)/);
  await expect(folder.getByTestId(/^folder-item-/)).toHaveCount(1);
  await expect(folder.locator('filter feGaussianBlur')).toHaveAttribute('stdDeviation', '80');
  if (process.env.INTELLIDEPLOY_PRODUCT_CAPTURE) await page.screenshot({ path: testInfo.outputPath('products-open.png'), fullPage: true });
});

test('source glyphs paint real shapes and SVG markup does not produce development errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await apps(page); await page.goto('/app-gallery');
  const glyph = page.getByLabel('COLLECTION').locator('path').first();
  await expect(glyph).toBeAttached();
  const box = await glyph.evaluate(element => { const bounds = (element as unknown as SVGGraphicsElement).getBBox(); return { width: bounds.width, height: bounds.height }; });
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
  await page.getByTestId('product-folder-created').click();
  expect(errors).toEqual([]);
});

test('formal Kiwi paint maps the upper-left to pink and lower-right to purple', async ({ page }) => {
  await apps(page); await page.goto('/app-gallery');
  const gradient = page.getByTestId('product-folder-created').locator('linearGradient#folder-gradient-created');
  await expect(gradient).toHaveAttribute('gradientTransform', /^matrix\(/);
  const samples = await gradient.evaluate(element => {
    const [a, b, c, d, e, f] = element.getAttribute('gradientTransform')!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
    const position = (x: number, y: number) => (d * (x - e) - c * (y - f)) / (a * d - b * c);
    return [position(0, 0), position(1, 1)];
  });
  expect(samples[0]).toBeCloseTo(1.068045, 5);
  expect(samples[0]).toBeGreaterThan(1);
  expect(samples[1]).toBeCloseTo(-0.293444, 5);
  expect(samples[1]).toBeLessThan(0);
});

test('closed and expanded folder origins stay at formal screen coordinates across mobile widths', async ({ page }) => {
  await apps(page);
  for (const width of [375, 320, 430]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/app-gallery');
    const folder = page.getByTestId('product-folder-created');
    await expect(folder).toHaveAttribute('aria-expanded', 'false');
    const origins = async () => {
      const rear = await folder.locator('path').first().evaluate(element => {
        const transform = (element as unknown as SVGGraphicsElement).getScreenCTM()!;
        const point = new DOMPoint(0, 0).matrixTransform(transform);
        return { x: point.x, y: point.y };
      });
      const front = await folder.locator('path[fill="#FFFFFF"][opacity="0.1"]').evaluate(element => {
        const transform = (element as unknown as SVGGraphicsElement).getScreenCTM()!;
        const point = new DOMPoint(0, 0).matrixTransform(transform);
        return { x: point.x, y: point.y };
      });
      const svg = await folder.locator('svg').boundingBox();
      return { rear, front, svg };
    };
    const closed = await origins();
    expect(closed.rear.y, `closed rear at ${width}`).toBeCloseTo(255, 2);
    expect(closed.front.y, `closed front at ${width}`).toBeCloseTo(310, 2);
    expect(closed.rear.x).toBeCloseTo((width - 260) / 2, 2);
    expect(closed.svg!.y).toBeCloseTo(255, 2);
    await folder.click();
    const open = await origins();
    expect(open.rear.y, `expanded rear at ${width}`).toBeCloseTo(255, 2);
    expect(open.front.y, `expanded front at ${width}`).toBeCloseTo(355, 2);
    expect(open.rear.x).toBeCloseTo(closed.rear.x, 2);
    expect(open.front.x).toBeCloseTo(closed.front.x, 2);
    expect(open.svg!.y, `preview viewport includes 30pt above rear at ${width}`).toBeCloseTo(225, 2);
    await folder.click();
    expect((await origins()).rear.y).toBeCloseTo(255, 2);
  }
});
