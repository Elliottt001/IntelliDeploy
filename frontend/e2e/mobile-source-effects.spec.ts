import { expect, test } from '@playwright/test';

import { effectSupport } from '../design/sourceEffectSupport';

test('GlassCard runtime consumes source padding and supported background blur', async ({ page }) => {
  await page.goto('/register');
  const card = page.getByText('在这里，实现你的奇思妙想').locator('xpath=ancestor::*[contains(@style, "border-radius")][1]');

  await expect(card).toBeVisible();
  const style = await card.evaluate((element) => {
    const computed = getComputedStyle(element as HTMLElement);
    const webkitBackdropFilter = computed.getPropertyValue('-webkit-backdrop-filter');
    return {
      backdropFilter: computed.backdropFilter || webkitBackdropFilter,
      paddingBottom: computed.paddingBottom,
      paddingLeft: computed.paddingLeft,
      paddingRight: computed.paddingRight,
      paddingTop: computed.paddingTop,
    };
  });

  expect(style).toMatchObject({
    backdropFilter: 'blur(16px)',
    paddingBottom: '24px',
    paddingLeft: '24px',
    paddingRight: '24px',
    paddingTop: '24px',
  });
});

test('unsupported source optical effects stay classified as unsupported at runtime boundary', () => {
  expect(effectSupport('GLASS', 'web')).toBe('NOT_IMPLEMENTED');
  expect(effectSupport('NOISE', 'web')).toBe('NOT_IMPLEMENTED');
  expect(effectSupport('DROP_SHADOW', 'ios')).toBe('NOT_RUN');
});
