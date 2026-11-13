import { expect, type Locator, type Page } from '@playwright/test';

import {
  makeVisualApp,
  visualCommunityPublications,
  visualProductApps,
  visualRankingPublications,
  visualStorePublications,
} from './mobileVisualFixtures';

export async function installMobileSourceFixtures(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fixture-token');
  });
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: { id: 1, username: 'Oasis', email: 'fixture@test.example' },
    }),
  );
  await page.route('**/api/quota/**', (route) =>
    route.fulfill({
      json: {
        available_units: 900,
        default_budget_units: 100,
        failed_usage_rule: '失败按实际用量结算',
        hard_cap_units: 1000,
        items: [],
        price_version: 'fixture',
        reserved_units: 100,
      },
    }),
  );
  await page.route('**/api/community/apps**', (route) => {
    const url = new URL(route.request().url());
    const family = url.pathname.includes('/ranking')
      ? visualRankingPublications
      : url.searchParams.get('family') === 'community'
        ? visualCommunityPublications
        : visualStorePublications;
    return route.fulfill({ json: { items: family, next_cursor: null } });
  });
  await page.route('**/api/apps/app', (route) =>
    route.fulfill({ json: makeVisualApp(49, 'RUNNING', 'clarifying') }),
  );
  await page.route('**/api/jobs/job', (route) =>
    route.fulfill({
      json: makeVisualApp(49, 'RUNNING', 'clarifying').latest_job,
    }),
  );
  await page.route('**/api/apps', (route) =>
    route.fulfill({ json: { items: visualProductApps, next_cursor: null } }),
  );
  await page.route('**/api/library/**', (route) =>
    route.fulfill({ json: { items: [], next_cursor: null } }),
  );
  await page.route('**/api/instances/fixture-instance/login-code', (route) =>
    route.fulfill({ json: { code: 'local-fixture-code', expires_in: 60 } }),
  );
}

export async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.viewport);
}

export async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}
