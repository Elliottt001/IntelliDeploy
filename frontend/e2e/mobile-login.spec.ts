import { expect, test } from '@playwright/test';

test('login brand preserves the source header origin beyond the narrower input gutters', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  const brand = page.getByLabel('INTELLIDEPLOY', { exact: true });
  await expect(brand).toBeVisible();
  const box = (await brand.boundingBox())!;
  // Header119:76659(14,47), brand119:76660(0,2).
  expect(box.x).toBeCloseTo(14, 1);
  expect(box.y).toBeCloseTo(49, 1);
});

test('login settings export keeps the source circle center and radii at one to one scale', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  const settings = page.getByRole('button', { name: '设置', exact: true });
  await expect(settings).toBeVisible();
  const circle = await settings.locator('circle').first().evaluate(element => {
    const node = element as SVGCircleElement, m = node.getScreenCTM()!;
    const center = new DOMPoint(node.cx.baseVal.value, node.cy.baseVal.value).matrixTransform(m);
    return { x: center.x, y: center.y, rx: node.r.baseVal.value * m.a, ry: node.r.baseVal.value * m.d };
  });
  //119:76671 origin323,47 + actual ellipse119:76672 local2,2.202872.
  for (const [key, expected] of Object.entries({ x: 341.521731, y: 65.724612, rx: 16.52174, ry: 16.52174 })) {
    // Chromium quantizes CSS box sizes/positions to1/64pt; allow their
    // combined rounding, not the old2.52pt shift or nonuniform SVG stretch.
    expect(Math.abs(circle[key as keyof typeof circle] - expected), key).toBeLessThan(1 / 32);
  }
  const target = (await settings.boundingBox())!;
  expect(target.width).toBeGreaterThanOrEqual(44);
  expect(target.height).toBeGreaterThanOrEqual(44);
});

test('login static controls preserve source coordinates independently of touch targets', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.getByTestId('login-account')).toBeVisible();
  // Formal Kiwi 119:76691, 76693, 76696, 76718 and 76728: visual
  // rectangles retain their source positions while controls remain >=44pt.
  for (const [id, x, y, width, height] of [
    ['login-privacy-artwork', 48.5, 491, 11, 11],
    ['login-remember-artwork', 279.5, 490.5, 11, 11],
    ['login-google-artwork', 97, 649, 40, 40],
    ['login-github-artwork', 167, 649, 40, 40],
    ['login-apple-artwork', 237, 649, 40, 40],
    ['login-footer', 0, 730, 375, 113],
  ] as const) {
    const artwork = id === 'login-footer'
      ? page.getByText('还没有账号？', { exact: true }).locator('../..')
      : id.includes('privacy') || id.includes('remember')
        ? page.getByTestId(id.replace('-artwork', '')).locator(':scope > div').first()
        : page.getByTestId(id.replace('-artwork', '')).locator('img').locator('../../..');
    const box = await artwork.boundingBox();
    expect(box, id).not.toBeNull();
    for (const [key, expected] of Object.entries({ x, y, width, height })) {
      expect(box![key as 'x' | 'y' | 'width' | 'height'], `${id}.${key}`).toBeCloseTo(expected, 1);
    }
  }
});

test('login glow export preserves the original ellipse geometry instead of stretching its padded viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.getByTestId('login-account')).toBeVisible();
  const geometry = await page.locator('ellipse[fill="#A3B2FF"]').evaluate(element => {
    const ellipse = element as SVGEllipseElement;
    const transform = ellipse.getScreenCTM()!;
    const center = new DOMPoint(ellipse.cx.baseVal.value, ellipse.cy.baseVal.value).matrixTransform(transform);
    return { x: center.x, y: center.y, rx: ellipse.rx.baseVal.value * transform.a, ry: ellipse.ry.baseVal.value * transform.d };
  });
  // Kiwi 119:76679: 278x130 at (48.5,375), radius100 blur.
  for (const [key, expected] of Object.entries({ x: 187.5, y: 440, rx: 139, ry: 65 })) {
    expect(geometry[key as keyof typeof geometry], key).toBeCloseTo(expected, 1);
  }
});

test('login preserves input after a public backend error and keeps providers disabled', async ({
  page,
}) => {
  await page.route('**/auth/login', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { message: '账号或密码错误' } },
    }),
  );
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto('/login');
  await page.getByTestId('login-account').fill('oasis');
  await page.getByTestId('login-password').fill('wrong');
  await page.getByTestId('login-privacy').click();
  await page.getByTestId('login-submit').click();

  await expect(page.getByTestId('login-error')).toHaveText('账号或密码错误');
  await expect(page.getByTestId('login-account')).toHaveValue('oasis');
  await expect(page.getByTestId('login-password')).toHaveValue('wrong');
  expect(dialogs).toEqual([]);

  for (const provider of ['google', 'github', 'apple']) {
    const button = page.getByTestId(`login-${provider}`);
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toContainText('暂未开放');
  }
});

test('320px layout keeps the submit action reachable with 44px controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/login');

  await page.getByTestId('login-account').fill('oasis');
  await page.getByTestId('login-password').fill('wrong');
  await page.getByTestId('login-password').focus();
  await page.getByTestId('login-submit').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('login-submit')).toBeInViewport();

  for (const target of [
    'login-account',
    'login-password',
    'login-privacy',
    'login-remember',
    'login-submit',
    'login-google',
    'login-github',
    'login-apple',
    'login-register',
  ]) {
    const box = await page.getByTestId(target).boundingBox();
    expect(box, `${target} should have a layout box`).not.toBeNull();
    expect(box!.height, `${target} should be at least 44px tall`).toBeGreaterThanOrEqual(44);
    expect(box!.width, `${target} should be at least 44px wide`).toBeGreaterThanOrEqual(44);
  }
});
