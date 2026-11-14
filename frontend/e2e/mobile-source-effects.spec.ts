import { expect, test } from '@playwright/test';

import { effectSupport } from '../design/sourceEffectSupport';
import { sourceNode } from '../tests/figmaSource';

test('GlassCard runtime consumes source padding and supported background blur', async ({ page }) => {
  await page.goto('/register');
  const card = page.getByText('在这里，实现你的奇思妙想').locator('xpath=ancestor::*[contains(@style, "border-radius")][1]');

  await expect(card).toBeVisible();
  const style = await card.evaluate((element) => {
    const computed = getComputedStyle(element as HTMLElement);
    const webkitBackdropFilter = computed.getPropertyValue('-webkit-backdrop-filter');
    return {
      backdropFilter: computed.backdropFilter || webkitBackdropFilter,
      overflow: computed.overflow,
      paddingBottom: computed.paddingBottom,
      paddingLeft: computed.paddingLeft,
      paddingRight: computed.paddingRight,
      paddingTop: computed.paddingTop,
      shadowColor: computed.boxShadow,
    };
  });

  expect(style).toMatchObject({
    backdropFilter: 'blur(16px)',
    overflow: 'hidden',
    paddingBottom: '24px',
    paddingLeft: '24px',
    paddingRight: '24px',
    paddingTop: '24px',
  });
  expect(style.shadowColor).toContain('rgba(31, 38, 135');
});

test('tested source optics are supported on Web while native device evidence stays NOT_RUN', () => {
  expect(effectSupport('GLASS', 'web')).toBe('PASS');
  expect(effectSupport('NOISE', 'web')).toBe('PASS');
  expect(effectSupport('DROP_SHADOW', 'ios')).toBe('NOT_RUN');
  expect(effectSupport('BACKGROUND_BLUR', 'ios')).toBe('NOT_IMPLEMENTED');
  expect(effectSupport('LAYER_BLUR', 'web')).toBe('NOT_IMPLEMENTED');
  expect(effectSupport('FUTURE_EFFECT', 'ios')).toBe('NOT_IMPLEMENTED');
});

test('shared source renderers apply supported effects with source color, order, clipping and blend contracts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
  await page.route('**/auth/me', (route) =>
    route.fulfill({ json: { id: 1, username: 'Oasis' } }),
  );
  await page.goto('/');

  const storeComposite = page.locator('g[data-source-effect-node="270:26347"]');
  await expect(storeComposite).toHaveCount(1);
  await expect(storeComposite).not.toHaveAttribute('filter');
  await expect(storeComposite.locator('g[filter]')).toHaveAttribute('filter', 'url(#home-store-effect-270-26347)');
  await expect(storeComposite.locator('[data-glass-backdrop=live]')).toHaveCount(1);
  await expect(storeComposite.locator('path[data-source-node="270:26347"]')).toHaveCount(2);
  await expect(
    page.locator('path[data-source-node="270:26347"][filter]'),
  ).toHaveCount(0);

  const storeFilter = page.locator('filter[id="home-store-effect-270-26347"]');
  await expect(storeFilter.locator('feComposite[operator="arithmetic"]')).toHaveCount(3);
  expect(
    await storeFilter.locator('feFlood').evaluateAll((nodes) =>
      nodes.map((node) => ({
        color: node.getAttribute('flood-color'),
        opacity: node.getAttribute('flood-opacity'),
      })),
    ),
  ).toEqual([
    { color: 'rgb(255,255,255)', opacity: '0.25' },
    { color: 'rgb(232,244,255)', opacity: '0.25' },
    { color: 'rgb(255,255,255)', opacity: '0.25' },
  ]);
  await expect(storeFilter.locator('feFlood[flood-color*="NaN"]')).toHaveCount(0);

  const avatarDrop = page.locator('g[data-source-group="270:26293"] > defs > filter');
  const rawShadows = sourceNode('270:26293').effects.filter((effect: {type: string; visible?: boolean}) => effect.type === 'DROP_SHADOW' && effect.visible !== false);
  expect(rawShadows).toHaveLength(2);
  await expect(avatarDrop).toHaveCount(1);
  const actualOffsets = await avatarDrop.locator('feOffset').evaluateAll(nodes => nodes.map(node => [Number(node.getAttribute('dx')), Number(node.getAttribute('dy'))]));
  expect(actualOffsets).toEqual(rawShadows.map((effect: {offset: {x: number; y: number}}) => [Number(effect.offset.x.toFixed(6)), Number(effect.offset.y.toFixed(6))]));
  await expect(avatarDrop.locator('feMergeNode')).toHaveCount(3);
  await expect(avatarDrop.locator('feFlood[flood-color*="NaN"]')).toHaveCount(0);
  await expect(page.locator('g[data-source-group="270:26298"] > defs > filter feGaussianBlur')).toBeAttached();

  await expect(page.locator('g[data-source-group="270:26291"] > defs > clipPath rect')).toHaveAttribute('rx', '0');
  expect(sourceNode('270:26297').mask).toBe(true);
  const normalMask = page.locator('clipPath[id$="-mask-270-26297"] path');
  await expect(normalMask).toHaveAttribute(
    'transform',
    'matrix(0.9961645007133484 -0.0875004380941391 0.12028589844703674 0.9927393198013306 1.1416083574295044 10.582049369812012)',
  );
  await expect(normalMask).toHaveAttribute('fill-rule', 'nonzero');
  await expect(page.locator('g[data-source-group="270:26295"]')).toHaveCSS('mix-blend-mode', 'normal');
});
