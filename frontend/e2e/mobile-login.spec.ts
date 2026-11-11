import { expect, test } from '@playwright/test';

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
