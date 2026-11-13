import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  expectTouchTarget,
  installMobileSourceFixtures,
} from './sourceAssertions';

async function appBackgroundBox(page: Page, testID: string) {
  return page.getByTestId(testID).evaluate((root) => {
    const safeArea = root.children[1] as HTMLElement;
    const content = safeArea.firstElementChild as HTMLElement;
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      content: rect(content),
      safeArea: rect(safeArea),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
}

test('shared mobile background uses real usable width across source mobile screens', async ({
  page,
}) => {
  const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
  test.skip(!source, 'Requires the original Figma source for frame evidence');
  const document = JSON.parse(
    await readFile(`${source}/design-data/document.kiwi.json`, 'utf8'),
  );
  const sourceSize = (nodeId: string) => {
    const node = document.nodeChanges.find(
      (entry: { guid: { sessionID: number; localID: number } }) =>
        `${entry.guid.sessionID}:${entry.guid.localID}` === nodeId,
    );
    return node.size;
  };
  expect(sourceSize('270:26263')).toEqual({ x: 375, y: 812 });
  expect(sourceSize('168:6299')).toEqual({ x: 375, y: 812 });

  await installMobileSourceFixtures(page);

  const byPage: Record<string, { testID: string; touchID: string }> = {
    '/': { testID: 'mobile-home', touchID: 'home-bottom-nav' },
    '/app-gallery': {
      testID: 'mobile-products',
      touchID: 'products-actions-open',
    },
  };
  const widths = [320, 360, 375, 390, 430];
  const heights = [568, 812, 932];
  const contentAt375: Record<string, number> = {};

  for (const [route, target] of Object.entries(byPage)) {
    for (const width of widths) {
      for (const height of heights) {
        await page.setViewportSize({ width, height });
        await page.goto(route);
        await expect(page.getByTestId(target.testID)).toBeVisible();
        const box = await appBackgroundBox(page, target.testID);

        expect(box.safeArea.width, `${route} safe area at ${width}x${height}`).toBe(
          width,
        );
        expect(
          box.content.width,
          `${route} content should fit viewport at ${width}x${height}`,
        ).toBeLessThanOrEqual(width);
        expect(box.content.width).toBeGreaterThan(0);
        expect(box.scrollWidth).toBeLessThanOrEqual(box.viewportWidth);
        await expectNoHorizontalOverflow(page);
        await expectTouchTarget(page.getByTestId(target.touchID));

        if (width === 375 && height === 812) {
          contentAt375[route] = box.content.width;
        }
        if (width === 430 && height === 812) {
          expect(box.content.width).toBeGreaterThan(contentAt375[route]);
        }
      }
    }
  }
});
