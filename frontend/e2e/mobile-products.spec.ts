import { expect, test, type Page } from '@playwright/test';
import { getSourceMotion } from '../design/sourceMotionEvidence';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceNode } from '../tests/figmaSource';

const app = (id: string, source: string | null = null, status: string | null = 'RUNNING') => ({ id, name: `真实应用-${id}`, updated_at: '', source_version_id: source, active_job_id: null, instance_status: status });
const publication = (id: string) => ({ id, app_id: `private-${id}`, instance_id: `instance-${id}`, version_id: `version-${id}`, name: `公开应用-${id}`, summary: `${id}摘要`, features: [], creator: '真实作者', preview_url: null, url: null, available: true, payer_policy: 'VISITOR', sponsor_period: 'DAY', sponsor_limit_units: 100, copy_url: `/api/publications/${id}/copies`, updated_at: '' });
async function auth(page: Page) { await page.addInitScript(() => localStorage.setItem('token', 'fixture-token')); }
async function viewAppList(page:Page){await page.getByRole('button',{name:'产品分类与操作',exact:true}).click();await page.getByRole('button',{name:'查看应用列表',exact:true}).click();}
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
  await expect(page.getByTestId('product-row-created')).toHaveCount(0);
  await viewAppList(page);
  await expect(page.getByTestId('product-row-created')).toContainText('应用正在运行');
  await page.getByRole('button', { name: '产品分类与操作', exact: true }).click();
  await page.getByRole('button', { name: '我的副本', exact: true }).click();
  await page.getByTestId('product-folder-copies').click();
  await viewAppList(page);
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
  await page.getByRole('button', { name: '产品分类与操作', exact: true }).click();
  await page.getByRole('button', { name: '我的副本', exact: true }).click();
  await page.getByTestId('product-folder-copies').click();
  await expect(page.getByText('这个文件夹还没有应用')).toBeVisible();
  await page.getByRole('button', { name: '产品分类与操作', exact: true }).click();
  await page.getByRole('button', { name: '新建应用', exact: true }).click();
  await expect(page).toHaveURL(/\/chatbot$/);
});
test('folder preview and full API list close normally and reset when the category changes',async({page})=>{
 await apps(page);await page.goto('/app-gallery');await viewAppList(page);await expect(page.getByTestId('product-row-created')).toBeVisible();await page.getByTestId('products-actions-open').click();await page.getByRole('button',{name:'收起应用列表',exact:true}).click();await expect(page.getByTestId('product-row-created')).toHaveCount(0);await expect(page.getByTestId('product-folder-created')).toHaveAttribute('aria-expanded','true');await page.getByTestId('products-actions-open').click();await page.getByRole('button',{name:'我的副本',exact:true}).click();await expect(page.getByTestId('product-folder-copies')).toHaveAttribute('aria-expanded','false');await expect(page.getByTestId('product-row-copy')).toHaveCount(0);await viewAppList(page);await expect(page.getByTestId('product-row-copy')).toBeVisible();await page.getByTestId('product-folder-copies').click();await expect(page.getByTestId('product-row-copy')).toHaveCount(0);
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
    await page.getByRole('button', { name: '产品分类与操作', exact: true }).click();
    for (const target of [page.getByTestId('product-folder-created'), page.getByTestId('products-load-more'), ...['我创建的', '我的副本', '我的收藏', '最近使用'].map(name => page.getByRole('button', { name, exact: true }))]) {
      const box = await target.boundingBox(); expect(box).not.toBeNull(); expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await expect(page.getByTestId('mobile-products')).toHaveCSS('transform', 'none');
    await page.getByRole('button', { name: '我的收藏', exact: true }).click(); await expect(page).toHaveURL(/\/library\/favorites$/);
    await page.getByRole('button', { name: '返回我的产品' }).click();
    await page.getByRole('button', { name: '产品分类与操作', exact: true }).click();
    await page.getByRole('button', { name: '最近使用', exact: true }).click(); await expect(page).toHaveURL(/\/library\/recent$/);
  }
});

test('app initial/paging errors and 401 retain retry and the protected destination', async ({ page }) => {
  await apps(page);
  await page.route('**/api/apps', route => route.fulfill({ status: 503, json: { error: { message: '暂不可用' } } }));
  await page.goto('/app-gallery'); await expect(page.getByRole('alert')).toContainText('应用暂时无法加载');
  await page.unroute('**/api/apps'); await page.route('**/api/apps', route => route.fulfill({ json: { items: [app('kept')], next_cursor: 'next' } }));
  await page.getByRole('button', { name: '重试' }).click(); await page.getByTestId('product-folder-created').click(); await viewAppList(page);
  await page.route('**/api/apps?**', route => route.fulfill({ status: 503, json: { error: { message: '暂不可用' } } }));
  await page.getByTestId('products-load-more').click(); await expect(page.getByTestId('product-row-kept')).toBeVisible();
  await page.route('**/api/apps?**', route => route.fulfill({ status: 401, json: { error: { message: '请登录' } } }));
  await page.getByTestId('products-load-more').click(); await expect(page).toHaveURL(/\/login\?next=%2Fapp-gallery$/);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('formal folder paths, gradients and upward glyph coordinates reach the runtime unchanged', async ({ page }, testInfo) => {
  await apps(page); await page.goto('/app-gallery');
  const folder = page.getByTestId('product-folder-created');
  await expect(folder.locator('path[data-source-folder-paint="closed"]').first()).toHaveAttribute('d', /^M0 20 C0 8\.954305 8\.954306 0 20 0 L73\.16523 0/);
  await expect(folder.locator('path[data-source-folder-paint="closed"]').first()).not.toHaveAttribute('stroke');
  await expect(folder.locator('stop').first()).toHaveAttribute('stop-color', '#7C62FF');
  await expect(folder.locator('path[fill="#FFFFFF"][opacity="0.1"]')).toHaveAttribute('d', /^M0 20 C0 8\.954305 8\.954306 0 20 0 L240 0/);
  await expect(folder.locator('path[fill="#FFFFFF"][opacity="0.1"]').locator('..')).toHaveAttribute('transform', 'matrix(1 0 0 1 0 55)');
  await expect(folder.locator('path[fill="#EC3EDD"]').first()).toBeAttached();
  await expect(page.getByLabel('COLLECTION').locator('path').first()).toHaveAttribute('transform', /scale\(24 -24\)/);
  if (process.env.INTELLIDEPLOY_PRODUCT_CAPTURE) await page.screenshot({ path: testInfo.outputPath('products-closed.png'), fullPage: true });
  await folder.click();
  await expect(folder.locator('path[data-source-folder-paint="closed"]').first().locator('..')).toHaveAttribute('transform', /matrix\(0\.9938837289810181 0\.11043152958154678 0 1 0 0\)/);
  await expect(folder.getByTestId(/^folder-item-/)).toHaveCount(1);
  await expect(folder.locator('[data-source-glass="280:26962"] filter feGaussianBlur')).toHaveAttribute('stdDeviation', '40');
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
      const svg = await folder.locator('svg[viewBox]').boundingBox();
      return { rear, front, svg };
    };
    const closed = await origins();
    const scale = width / 375;
    expect(closed.rear.y, `closed rear at ${width}`).toBeCloseTo(255, 2);
    expect(closed.front.y, `closed front at ${width}`).toBeCloseTo(255 + 55 * scale, 1);
    expect(closed.rear.x).toBeCloseTo((width - 260 * scale) / 2, 1);
    expect(closed.svg!.y).toBeCloseTo(255, 2);
    await folder.click();
    await expect.poll(async () => (await origins()).front.y).toBeCloseTo(255 + 100 * scale, 1);
    const open = await origins();
    expect(open.rear.y, `expanded rear at ${width}`).toBeCloseTo(255, 1);
    expect(open.front.y, `expanded front at ${width}`).toBeCloseTo(255 + 100 * scale, 1);
    expect(open.rear.x).toBeCloseTo(closed.rear.x, 1);
    expect(open.front.x).toBeCloseTo(closed.front.x, 1);
    expect(open.svg!.y, `preview viewport includes 30pt above rear at ${width}`).toBeCloseTo(255 - 30 * scale, 1);
    await folder.click();
    await expect.poll(async () => (await origins()).front.y).toBeCloseTo(255 + 55 * scale, 1);
    expect((await origins()).rear.y).toBeCloseTo(255, 2);
  }
});

test('folder shell scales from the 260pt source geometry at all five required widths', async ({ page }) => {
  await apps(page);
  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/app-gallery');
    const folder = page.getByTestId('product-folder-created');
    const shell = await folder.boundingBox();
    expect(shell).not.toBeNull();
    expect(shell!.width).toBeCloseTo((260 / 375) * width, 1);
    expect(shell!.width).toBeLessThan(width);
    expect((await page.getByText('已加载 1 个应用 · 点击展开').boundingBox())!.height).toBeGreaterThanOrEqual(18);
  }
});

test('folder follows the source spring through a real midpoint and supports reversal', async ({ page }) => {
  await apps(page); await page.goto('/app-gallery');
  const folder = page.getByTestId('product-folder-created');
  const front = folder.locator('path[fill="#FFFFFF"][opacity="0.1"]').first().locator('..');
  const matrix = async () => (await front.getAttribute('transform'))!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
  const closed = await matrix();
  const motion = getSourceMotion('280:26962', 'ON_CLICK', '380:147')!;
  await page.clock.install();
  await folder.click();
  await page.clock.runFor(Math.floor(motion.durationMs / 2));
  const middle = await matrix();
  expect(middle[1]).toBeGreaterThan(closed[1]);
  expect(Math.abs(middle[1] - 0.11043152958154678)).toBeGreaterThan(0.001);
  await folder.click();
  await page.clock.runFor(Math.ceil(motion.durationMs * 2));
  await expect(folder).toHaveAttribute('aria-expanded', 'false');
  expect((await matrix())[1]).toBeCloseTo(closed[1], 5);
});

test('folder keeps its current spring presentation while the viewport resizes', async ({ page }) => {
  await apps(page); await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/app-gallery');
  const folder = page.getByTestId('product-folder-created'); await folder.click();
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 430, height: 932 });
  await expect.poll(async () => (await folder.boundingBox())!.width).toBeCloseTo((260 / 375) * 430, 1);
  await expect(folder.locator('path[data-source-folder-paint="closed"]').first().locator('..')).toHaveAttribute('transform', 'matrix(0.9938837289810181 0.11043152958154678 0 1 0 0)');
});

test('five source slots retain their IDs and order while six real apps page without examples', async ({ page }) => {
  await auth(page);
  const first = Array.from({ length: 5 }, (_, index) => ({ ...app(`real-${index + 1}`), name: index === 0 ? `真实长名称-${'完整文字'.repeat(12)}` : `真实应用-${index + 1}` }));
  await page.route('**/api/apps?**', route => route.fulfill({ json: { items: [app('real-6')], next_cursor: null } }));
  await page.route('**/api/apps', route => route.fulfill({ json: { items: first, next_cursor: 'page-2' } }));
  await page.goto('/app-gallery');
  const folder = page.getByTestId('product-folder-created');
  await folder.click();
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  expect(await folder.getByTestId(/^folder-slot-/).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')))).toEqual([
    'folder-slot-380-191', 'folder-slot-380-192', 'folder-slot-380-193', 'folder-slot-380-194', 'folder-slot-380-195',
  ]);
  await viewAppList(page);
  await expect(page.getByTestId(/^product-row-/)).toHaveCount(5);
  await expect(page.getByTestId('product-row-real-1')).toContainText(`真实长名称-${'完整文字'.repeat(12)}`);
  await page.getByTestId('products-load-more').click();
  await expect(page.getByTestId(/^product-row-/)).toHaveCount(6);
  await expect(folder.getByTestId(/^folder-item-/)).toHaveCount(5);
});

test('switching accounts replaces created products instead of retaining the previous account data', async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('token')) localStorage.setItem('token', 'account-a'); });
  await page.route('**/api/apps', route => {
    const account = route.request().headers().authorization === 'Bearer account-b' ? 'account-b' : 'account-a';
    return route.fulfill({ json: { items: [{ ...app(account), name: `仅属于${account}` }], next_cursor: null } });
  });
  await page.goto('/app-gallery');
  await page.getByTestId('product-folder-created').click(); await viewAppList(page);
  await expect(page.getByText('仅属于account-a')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('token', 'account-b'));
  await page.reload();
  await expect(page.getByText('仅属于account-a')).toHaveCount(0);
  await page.getByTestId('product-folder-created').click(); await viewAppList(page);
  await expect(page.getByText('仅属于account-b')).toBeVisible();
});

test('reduced motion reaches the source endpoint immediately on short and long screens', async ({ page }) => {
  await apps(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const size of [{ width: 320, height: 640 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(size); await page.goto('/app-gallery');
    const folder = page.getByTestId('product-folder-created'); await folder.click();
    await expect(folder.locator('path[data-source-folder-paint="closed"]').first().locator('..')).toHaveAttribute('transform', 'matrix(0.9938837289810181 0.11043152958154678 0 1 0 0)');
    await expect(folder).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('mobile-products')).toHaveCSS('transform', 'none');
  }
});

test('product folder and header respect actual non-zero browser safe areas', async ({ page }) => {
  await apps(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  const cdp = await page.context().newCDPSession(page);
  const insets = { top: 60, left: 20, bottom: 16, right: 20 };
  await (cdp.send as (method: string, params: unknown) => Promise<unknown>)('Emulation.setSafeAreaInsetsOverride', { insets });
  const measurements = [];
  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 812 }); await page.goto('/app-gallery');
    const folder = page.getByTestId('product-folder-created'); await expect(folder).toBeVisible();
    const header = (await page.getByTestId('products-header').boundingBox())!;
    expect(header.y).toBeGreaterThanOrEqual(insets.top);
    expect(header.x).toBeGreaterThanOrEqual(insets.left);
    expect(header.x + header.width).toBeLessThanOrEqual(width - insets.right);
    const closed = (await folder.boundingBox())!; await folder.click(); const expanded = (await folder.boundingBox())!;
    for (const box of [closed, expanded]) {
      expect(box.x).toBeGreaterThanOrEqual(insets.left); expect(box.x + box.width).toBeLessThanOrEqual(width - insets.right);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const font = await page.getByText('点击查看我创建的应用', { exact: true }).evaluate(element => getComputedStyle(element).fontSize);
    expect(parseFloat(font)).toBe(sourceNode('825:5845').fontSize); measurements.push({ viewport: { width, height: 812 }, insets, header, closed, expanded, font });
  }
  await mkdir('artifacts/source-acceptance', { recursive: true });
  const sourceBytes = await readFile(`${process.env.INTELLIDEPLOY_FIGMA_SOURCE}/design-data/document.kiwi.json`);
  await writeFile('artifacts/source-acceptance/product-safe-area.json', JSON.stringify({ sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'), platform: 'Chromium CDP browser override; physical native NOT_RUN', measurements }, null, 2));
  await cdp.detach();
});
