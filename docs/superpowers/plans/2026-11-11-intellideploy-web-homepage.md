# IntelliDeploy Web Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public IntelliDeploy Web homepage in `web/` with Figma-faithful light/dark visuals, true responsive reflow, real community and SKU data, and an unchanged authenticated creation flow at `/create`.

**Architecture:** Keep Next.js as the only Web runtime. Render the marketing page primarily with Server Components, isolate theme/menu behavior in small Client Components, reuse the shared OpenAPI client, and expose an anonymous read-only SKU projection backed by the existing `ProductSku` table. Route Groups separate the marketing shell from the existing product shell without changing public URLs.

**Tech Stack:** Next.js 16.4.6, React 19.2, TypeScript 5.9, Tailwind 4 plus CSS Modules, FastAPI, SQLAlchemy, PostgreSQL, shared OpenAPI TypeScript client, Vitest, pytest, Playwright, ImageMagick.

**Spec:** `docs/superpowers/specs/2026-11-11-intellideploy-web-homepage-design.md`

## Global Constraints

- Before coding any visual section, locate its formal Figma node and record the node ID, dimensions, typography, spacing, paint/effect values, and asset source in `web/design/marketing-home.ts`.
- Figma source package: `/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/`; original `.fig` SHA-256 is `5951997a694f1da0a343029dfec889b81ea377e098eb94f0e4b9d61f589e949a`.
- Do not copy the full homepage PNG into production. It is reference-only.
- `/` is public marketing; `/create` owns the existing creation form; `/community`, `/login`, `/register`, and `/apps` keep their current public URLs.
- Web mobile means responsive browser layout only. Do not modify the Expo native page flow in this plan.
- Public pricing must come from the existing `ProductSku` data source and shared `QuotaSku` schema. Do not create a second pricing table.
- `/api/catalog/skus` is anonymous and read-only. Balance, usage, private SKU, subscription, order, app, and library endpoints remain authenticated.
- `amount_minor` stays an integer. The Web only formats it for display and never calculates discounts, exchange rates, grants, or checkout amounts.
- Payment creation, callbacks, `/billing`, and quota grants remain outside this plan and continue under `06-F2/F3`.
- Do not ship fake statistics, fake testimonials, fake applications, hard-coded prices, empty `#` links, or Figma's mental-health placeholder copy.
- Theme defaults to the operating-system preference, persists a manual choice, restores before hydration, and respects `prefers-reduced-motion`.
- Use the downloaded Alibaba PuHuiTi 3.0 and OFL fonts selectively. Do not commit or serve `PingFangUI.ttc`.
- Do not introduce a new UI component library.
- Tests use only the dedicated local `intellideploy_test` PostgreSQL database or explicit test fixtures. Do not touch production services, payment providers, or deployment targets.

## Review Focus

- Both anonymous data calls can fail independently; the page must keep rendering static sections while showing the correct community or pricing error state. Covered in Task 6 loader tests and Task 8 E2E.
- Malicious or malformed `next` parameters such as `//evil.test`, `https://evil.test`, and `/\\evil.test` must never redirect outside approved product routes. Covered in Task 3 unit and E2E tests.
- Long publication names, mixed CNY/USD SKUs, and an arbitrary number of cards must wrap without horizontal overflow at `390px`. Covered in Task 7 formatting tests and Task 8 responsive E2E.
- Stored theme, OS theme, hydration, and reduced-motion behavior must agree without a visible flash or motion-only state. Covered in Task 4 unit/E2E and Task 8 visual checks.
- Disabled SKUs and private quota/account data must not appear through the anonymous catalog, while authenticated quota routes still reject anonymous access. Covered in Task 2 backend and BFF tests.

---

## File Map

### Design evidence and assets

- `web/design/marketing-home.ts`: committed Figma node, reference hash, asset, font, and token evidence used by the implementation.
- `web/public/marketing/*`: production-safe visual assets with stable ASCII names.
- `web/assets/fonts/*`: selected distributable local fonts and their license/source notes.
- `web/tests/marketing-design.test.ts`: ensures the required evidence, files, and hashes stay intact and excludes PingFang/full-page screenshots.

### Backend and shared client

- `backend/app/billing/catalog.py`: shared enabled-SKU query plus anonymous catalog router.
- `backend/app/billing/router.py`: authenticated SKU route delegates to the shared query.
- `backend/app/main.py`: registers the catalog router.
- `tests/phase1/test_public_catalog.py`: anonymous/private catalog contract and filtering.
- `packages/api-client/src/client.ts`: `listPublicSkus()`.
- Generated `packages/api-client/openapi.json` and `src/generated.ts`: shared schema contract.
- `web/lib/proxy.ts`, `web/app/api/[...path]/route.ts`: exact anonymous BFF allowlist entry.

### Web route and shells

- `web/app/(marketing)/page.tsx`: public homepage.
- `web/app/(platform)/layout.tsx`: existing product shell.
- `web/app/(platform)/create/page.tsx`: creation page.
- Existing apps/community/auth pages move under `(platform)` without URL changes.
- `web/components/CreateAppForm.tsx`: migrated creation logic.
- `web/components/PlatformHeader.tsx`: existing product navigation.
- `web/lib/navigation.ts`: approved internal redirect validation.

### Marketing UI

- `web/app/fonts.ts`: `next/font/local` declarations and CSS variables.
- `web/lib/theme.ts`: pure theme storage/selection functions.
- `web/components/marketing/ThemeToggle.tsx`: manual theme control.
- `web/components/marketing/MobileMenu.tsx`: accessible mobile navigation.
- `web/components/marketing/MarketingHeader.tsx`: Figma-aligned marketing navigation.
- `web/components/marketing/content.ts`: truthful static product copy and real links.
- `web/components/marketing/HeroSection.tsx`, `CapabilityStrip.tsx`, `MiboFeature.tsx`, `CommunityFeature.tsx`, `CommunityPreview.tsx`, `DeliveryFlow.tsx`, `PricingSection.tsx`, `MarketingFooter.tsx`: focused page sections.
- `web/components/marketing/marketing.module.css`: marketing-only light/dark/responsive styles.
- `web/lib/marketing-data.ts`: parallel community/SKU loader with independent states.
- `web/lib/money.ts`: supported-currency display formatting only.

### Verification

- `web/e2e/fixture-api.mjs`: explicit test-only API for SSR community/SKU data, including resettable success/empty/error modes.
- `web/e2e/marketing-home.spec.ts`: routing, data state, interaction, accessibility, and mobile behavior.
- `web/e2e/marketing-home.visual.spec.ts`: deterministic light/dark viewport snapshots.
- `web/e2e/marketing-home.visual.spec.ts-snapshots/*`: reviewed visual baselines.

---

### Task 1: Freeze Figma Evidence, Fonts, and Production Assets

**Files:**
- Create: `web/design/marketing-home.ts`
- Create: `web/tests/marketing-design.test.ts`
- Create: `web/public/marketing/logo.svg`
- Create: `web/public/marketing/mibo-hero.png`
- Create: `web/public/marketing/mibo-small.png`
- Create: `web/public/marketing/feature-chat.png`
- Create: `web/public/marketing/feature-appstore.png`
- Create: `web/public/marketing/feature-community-primary.png`
- Create: `web/public/marketing/feature-community-secondary.png`
- Create: `web/assets/fonts/AlibabaPuHuiTi-3-55-Regular.ttf`
- Create: `web/assets/fonts/AlibabaPuHuiTi-3-75-SemiBold.ttf`
- Create: `web/assets/fonts/Inter-Variable.ttf`
- Create: `web/assets/fonts/Geist-Variable.ttf`
- Create: `web/assets/fonts/IbarraRealNova-Variable.ttf`
- Create: `web/assets/fonts/InstrumentSans-Variable.ttf`
- Create: `web/assets/fonts/PixelifySans-Variable.ttf`
- Create: `web/assets/fonts/ZiTiQuanWeiJunHei-W3.ttf`
- Create: `web/assets/fonts/FONT_SOURCES.md`
- Create: `web/assets/fonts/OFL-1.1.txt`

**Interfaces:**
- Consumes: downloaded Figma package, existing verified Expo assets, downloaded font files.
- Produces: `marketingHomeEvidence`, stable `/marketing/*` asset URLs, and local font files used by Tasks 4-8.

- [ ] **Step 1: Write the failing evidence and asset-integrity test**

```ts
// web/tests/marketing-design.test.ts
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { marketingHomeEvidence } from '../design/marketing-home';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('marketing design evidence', () => {
  test('pins every formal homepage section to its Figma node', () => {
    expect(marketingHomeEvidence.root).toBe('100:4630');
    expect(marketingHomeEvidence.sections.map(section => section.node)).toEqual([
      '100:5063', '100:5099', '100:5107', '100:5114',
      '100:5329', '100:5496', '100:5547', '100:5549',
    ]);
    expect(marketingHomeEvidence.pricing).toEqual({ frame: '100:5547', instance: '100:5548', symbol: '100:2691' });
  });

  test('ships only reviewed assets and distributable fonts', () => {
    for (const file of marketingHomeEvidence.assets) {
      const path = `${webRoot}/${file.target}`;
      expect(existsSync(path), file.target).toBe(true);
      expect(sha256(path), file.target).toBe(file.sha256);
    }
    for (const font of marketingHomeEvidence.fonts) {
      expect(existsSync(`${webRoot}/${font.target}`), font.target).toBe(true);
    }
    expect(existsSync(`${webRoot}/assets/fonts/PingFangUI.ttc`)).toBe(false);
    expect(marketingHomeEvidence.assets.some(asset => asset.target.includes('New：Home'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing manifest/assets fail**

Run: `npm --workspace web run test -- marketing-design.test.ts`

Expected: FAIL because `web/design/marketing-home.ts` and the checked-in Web assets do not exist.

- [ ] **Step 3: Inspect the formal Figma nodes before copying files**

Run:

```bash
FIGMA_DIR=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221
jq -r '.nodeChanges[] | select(.parentIndex.guid.sessionID==100 and .parentIndex.guid.localID==4630) | [(.guid.sessionID|tostring)+":"+(.guid.localID|tostring),.name,.size.x,.size.y,.transform.m02,.transform.m12] | @tsv' "$FIGMA_DIR/design-data/document.kiwi.json"
jq '.nodeChanges[] | select(.guid.sessionID==100 and .guid.localID==5548) | {name,symbolData,size,transform}' "$FIGMA_DIR/design-data/document.kiwi.json"
shasum -a 256 "$FIGMA_DIR/original/IntelliDeploy.fig" "$FIGMA_DIR/web/assets/New：Home（浅色模式）.png" "$FIGMA_DIR/web/assets/New：Home（深色模式）.png"
```

Expected: root children include navigation `100:5063`, hero text `100:5099`, transition `100:5107`, features `100:5114`, editorial/delivery `100:5496`, pricing `100:5547`, and footer frame `100:5549`; the three hashes match the values recorded below.

- [ ] **Step 4: Copy the reviewed assets and fonts into the Web package**

Run:

```bash
mkdir -p web/public/marketing web/assets/fonts web/design
cp frontend/assets/images/logo.svg web/public/marketing/logo.svg
cp frontend/assets/images/mibo-cat-hero.png web/public/marketing/mibo-hero.png
cp frontend/assets/images/mibo-cat-small.png web/public/marketing/mibo-small.png
cp frontend/assets/images/feature-chat.png web/public/marketing/feature-chat.png
cp frontend/assets/images/feature-appstore.png web/public/marketing/feature-appstore.png
cp frontend/assets/images/feature-community1.png web/public/marketing/feature-community-primary.png
cp frontend/assets/images/feature-community2.png web/public/marketing/feature-community-secondary.png
cp frontend/assets/fonts/AlibabaPuHuiTi-3-55-Regular.ttf web/assets/fonts/
cp frontend/assets/fonts/AlibabaPuHuiTi-3-75-SemiBold.ttf web/assets/fonts/
cp frontend/assets/fonts/Inter-Variable.ttf web/assets/fonts/
cp frontend/assets/fonts/Geist-Variable.ttf web/assets/fonts/
cp frontend/assets/fonts/IbarraRealNova-Variable.ttf web/assets/fonts/
cp frontend/assets/fonts/InstrumentSans-Variable.ttf web/assets/fonts/
cp frontend/assets/fonts/PixelifySans-Variable.ttf web/assets/fonts/
cp frontend/assets/fonts/ZiTiQuanWeiJunHei-W3.ttf web/assets/fonts/
cp frontend/assets/fonts/FONT_SOURCES.md web/assets/fonts/
cp frontend/assets/fonts/OFL-1.1.txt web/assets/fonts/
```

Do not copy `PingFangUI.ttc`, the full homepage PNGs, or unused font weights.

- [ ] **Step 5: Create the evidence manifest with exact IDs and hashes**

```ts
// web/design/marketing-home.ts
export const marketingHomeEvidence = {
  sourcePackage: 'IntelliDeploy-design-2026-11-10-2221',
  figSha256: '5951997a694f1da0a343029dfec889b81ea377e098eb94f0e4b9d61f589e949a',
  referenceRenders: {
    light: { path: 'web/assets/New：Home（浅色模式）.png', sha256: '8472dfb13f9991a33d2ef4e58af61f3837c859caa3f4616a8992eb508b8a6e19' },
    dark: { path: 'web/assets/New：Home（深色模式）.png', sha256: 'fe976e215881434fb92fd3a50d1bf025b171d81b969d2cb5890a5c8654e74f06' },
  },
  root: '100:4630',
  rootSize: { width: 2025, height: 10620 },
  contentGuide: { left: 141, right: 1884, width: 1743 },
  sections: [
    { key: 'navigation', node: '100:5063', width: 1704, height: 100 },
    { key: 'hero', node: '100:5099', width: 1917, height: 602 },
    { key: 'capabilities', node: '100:5107', width: 832.8696, height: 216 },
    { key: 'features', node: '100:5114', width: 2231, height: 4775.6143 },
    { key: 'community', node: '100:5329', width: 1743, height: 1243 },
    { key: 'delivery', node: '100:5496', width: 1745, height: 1304 },
    { key: 'pricing', node: '100:5547', width: 1745, height: 2221 },
    { key: 'footer', node: '100:5549', width: 2025.1057, height: 3010.7813 },
  ],
  pricing: { frame: '100:5547', instance: '100:5548', symbol: '100:2691' },
  featureNodes: { mibo: '100:5117', appstore: '100:5228', community: '100:5329' },
  tokens: {
    primary: '#7C62FF', surfaceSoft: '#EFF3FF', text: '#494A64', textMuted: '#7F80A1',
    blue: '#94ACF6', pink: '#FFAFDC', orchid: '#EDAFF6', lavender: '#D0C7FE',
  },
  assets: [
    { target: 'public/marketing/logo.svg', sha256: '343d61809dc8c954de1c0f4447793ed774581ed1f2e73477e2a136d9c8355462' },
    { target: 'public/marketing/mibo-hero.png', sha256: 'ad03b7afea147f2f5d9ee834bb30d05da03e6adcaf0e2ed238eaaecc22f731d7' },
    { target: 'public/marketing/mibo-small.png', sha256: 'e3b80c248897cb452585f33feb62e38c87f93a8c6b5b2673c57ac63a1b9117db' },
    { target: 'public/marketing/feature-chat.png', sha256: '36cd893a76724aaab21308dac5986aa2413672f609a57fb176aaed28cff89a38' },
    { target: 'public/marketing/feature-appstore.png', sha256: '59e443101bd535ac58a945cc9a5c761a556f53972ac5cbc95d0eade9ddc6e32e' },
    { target: 'public/marketing/feature-community-primary.png', sha256: 'd378c77c14b0d4fd4cd2fbd20cc52f3538425c20bc19da655053431e962b6e98' },
    { target: 'public/marketing/feature-community-secondary.png', sha256: '32c1b53a369ea54279653554860a6f5909d24b094f717f9494c05faad899617e' },
  ],
  fonts: [
    'AlibabaPuHuiTi-3-55-Regular.ttf', 'AlibabaPuHuiTi-3-75-SemiBold.ttf',
    'Inter-Variable.ttf', 'Geist-Variable.ttf', 'IbarraRealNova-Variable.ttf',
    'InstrumentSans-Variable.ttf', 'PixelifySans-Variable.ttf', 'ZiTiQuanWeiJunHei-W3.ttf',
  ].map(file => ({ target: `assets/fonts/${file}` })),
} as const;
```

- [ ] **Step 6: Run the design evidence test**

Run: `npm --workspace web run test -- marketing-design.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the evidence and selected assets**

```bash
git add web/design web/tests/marketing-design.test.ts web/public/marketing web/assets/fonts
git commit -m "chore: pin homepage design evidence and assets"
```

---

### Task 2: Add the Anonymous SKU Catalog and Shared Client Contract

**Files:**
- Create: `backend/app/billing/catalog.py`
- Create: `tests/phase1/test_public_catalog.py`
- Modify: `backend/app/billing/router.py:1-79`
- Modify: `backend/app/main.py:15-42`
- Modify: `packages/api-client/src/client.ts:55-70`
- Modify: `packages/api-client/tests/client.test.ts`
- Modify: `web/lib/proxy.ts:1-18`
- Modify: `web/app/api/[...path]/route.ts:18-25`
- Modify: `web/tests/proxy.test.ts`
- Modify: `web/tests/bff.test.ts`
- Regenerate: `packages/api-client/openapi.json`
- Regenerate: `packages/api-client/src/generated.ts`
- Regenerate: `packages/api-client/dist/*`

**Interfaces:**
- Produces: `list_enabled_skus(db: Session) -> list[QuotaSku]`, `GET /api/catalog/skus`, and `api.listPublicSkus()`.
- Preserves: authenticated `GET /api/quota/skus` and all other quota authorization boundaries.

- [ ] **Step 1: Write the failing backend catalog contract**

```py
# tests/phase1/test_public_catalog.py
from app.billing.models import ProductSku


def test_public_catalog_is_anonymous_filters_disabled_and_matches_private_catalog(
    api_client, owner_headers, session_factory
):
    with session_factory() as session:
        session.add_all([
            ProductSku(id='cny-pack', name='基础额度包', provider='alipay', currency='CNY', amount_minor=9900, units=10000, period=None, enabled=True),
            ProductSku(id='usd-monthly', name='月度套餐', provider='stripe', currency='USD', amount_minor=1900, units=30000, period='MONTH', enabled=True),
            ProductSku(id='hidden', name='未发布套餐', provider='wechat', currency='CNY', amount_minor=1, units=1, period=None, enabled=False),
        ])
        session.commit()

    public = api_client.get('/api/catalog/skus')
    assert public.status_code == 200
    assert [item['id'] for item in public.json()] == ['cny-pack', 'usd-monthly']
    assert all(set(item) == {'id', 'name', 'provider', 'currency', 'amount_minor', 'units', 'period'} for item in public.json())

    assert api_client.get('/api/quota/skus').status_code == 401
    private = api_client.get('/api/quota/skus', headers=owner_headers)
    assert private.status_code == 200
    assert private.json() == public.json()
```

- [ ] **Step 2: Run the backend test and verify the catalog route is missing**

Run: `PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1/test_public_catalog.py -q`

Expected: FAIL with `404` for `/api/catalog/skus`.

- [ ] **Step 3: Implement one shared enabled-SKU projection**

```py
# backend/app/billing/catalog.py
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.billing.models import ProductSku
from app.core.types import QuotaSku
from app.database import get_db

router = APIRouter(prefix='/api/catalog', tags=['catalog'])


def list_enabled_skus(db: Session) -> list[QuotaSku]:
    rows = db.scalars(
        select(ProductSku).where(ProductSku.enabled.is_(True)).order_by(ProductSku.id)
    )
    return [
        QuotaSku(
            id=row.id,
            name=row.name,
            provider=row.provider,
            currency=row.currency,
            amount_minor=row.amount_minor,
            units=row.units,
            period=row.period,
        )
        for row in rows
    ]


@router.get('/skus', response_model=list[QuotaSku])
def public_skus(db: Session = Depends(get_db)):
    return list_enabled_skus(db)
```

Modify the authenticated handler to call `list_enabled_skus(db)` and register `catalog.router` in `backend/app/main.py`. Do not add `get_current_user` to the public route and do not remove it from the private route.

- [ ] **Step 4: Run the backend contract**

Run: `PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1/test_public_catalog.py -q`

Expected: PASS.

- [ ] **Step 5: Write failing shared-client and BFF tests**

```ts
// packages/api-client/tests/client.test.ts
test('public catalog uses the anonymous catalog path', async () => {
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([])));
  const api = createApiClient({ baseUrl: '', fetchImpl });
  expect(await api.listPublicSkus()).toEqual([]);
  expect(fetchImpl.mock.calls[0][0]).toBe('/api/catalog/skus');
});

// web/tests/proxy.test.ts
expect(backendPath(['catalog', 'skus'])).toBe('/api/catalog/skus');
```

Add a BFF test that calls `GET /api/catalog/skus` without a cookie, expects the upstream request to occur without `Authorization`, and separately verifies `GET /api/quota/skus` still returns `401` without reaching upstream.

- [ ] **Step 6: Run the TypeScript tests and verify the new method/allowlist fail**

Run:

```bash
npm --workspace @intellideploy/api-client test
npm --workspace web run test -- proxy.test.ts bff.test.ts
```

Expected: FAIL because `listPublicSkus` and the catalog BFF path do not exist.

- [ ] **Step 7: Add the client method and exact anonymous BFF exception**

```ts
// packages/api-client/src/client.ts
listPublicSkus: () => request<Schema['QuotaSku'][]>('/api/catalog/skus'),
```

Add `/^\/api\/catalog\/skus$/` to `ALLOWED`. In the BFF route, extend `anonymous` only with `path === '/api/catalog/skus' && request.method === 'GET'`.

- [ ] **Step 8: Regenerate and verify the shared contract**

Run:

```bash
npm run api:generate
npm --workspace @intellideploy/api-client test
npm --workspace web run test -- proxy.test.ts bff.test.ts
```

Expected: all commands PASS.

- [ ] **Step 9: Commit the catalog slice**

```bash
git add backend/app/billing backend/app/main.py tests/phase1/test_public_catalog.py packages/api-client web/lib/proxy.ts web/app/api/'[...path]'/route.ts web/tests
git commit -m "feat: expose public read-only SKU catalog"
```

---

### Task 3: Separate Marketing and Platform Routes Without Regressing Creation

**Files:**
- Create: `web/lib/navigation.ts`
- Create: `web/tests/navigation.test.ts`
- Create: `web/components/CreateAppForm.tsx`
- Create: `web/components/PlatformHeader.tsx`
- Create: `web/app/(platform)/layout.tsx`
- Create: `web/app/(platform)/create/page.tsx`
- Create: `web/app/(marketing)/page.tsx`
- Move: `web/app/apps/**` to `web/app/(platform)/apps/**`
- Move: `web/app/community/**` to `web/app/(platform)/community/**`
- Move: `web/app/login/**` to `web/app/(platform)/login/**`
- Move: `web/app/register/**` to `web/app/(platform)/register/**`
- Modify: moved pages to use `@/components` and `@/lib` imports
- Modify: `web/tsconfig.json`
- Modify: `web/app/layout.tsx`
- Modify: `web/global.css`
- Modify: `web/components/AuthForm.tsx`
- Modify: `web/e2e/workspace.spec.ts`

**Interfaces:**
- Produces: `safeNext(value: string | null, fallback?: string): string`, `/create`, a platform shell, and a temporary marketing route that later tasks fill.
- Preserves: `intellideploy:draft`, `intellideploy:create-key`, `api.createApp`, and `/apps/:id` success navigation.

- [ ] **Step 1: Write the failing internal-redirect tests**

```ts
// web/tests/navigation.test.ts
import { expect, test } from 'vitest';
import { safeNext } from '../lib/navigation';

test('safeNext accepts only approved product routes', () => {
  expect(safeNext('/create')).toBe('/create');
  expect(safeNext('/apps/app-1')).toBe('/apps/app-1');
  expect(safeNext('/community/public-1?from=home')).toBe('/community/public-1?from=home');
  expect(safeNext('//evil.test')).toBe('/apps');
  expect(safeNext('https://evil.test')).toBe('/apps');
  expect(safeNext('/\\evil.test')).toBe('/apps');
  expect(safeNext('/api/auth/logout')).toBe('/apps');
});
```

- [ ] **Step 2: Run the navigation test and verify it fails**

Run: `npm --workspace web run test -- navigation.test.ts`

Expected: FAIL because `web/lib/navigation.ts` does not exist.

- [ ] **Step 3: Implement strict internal redirect validation**

```ts
// web/lib/navigation.ts
const allowedRoots = ['/create', '/apps', '/community'] as const;

export function safeNext(value: string | null, fallback = '/apps') {
  if (!value || value.includes('\\')) return fallback;
  try {
    const url = new URL(value, 'https://intellideploy.local');
    if (url.origin !== 'https://intellideploy.local') return fallback;
    const allowed = allowedRoots.some(root => url.pathname === root || url.pathname.startsWith(`${root}/`));
    return allowed ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
```

Use `safeNext()` in `AuthForm` instead of checking only `startsWith('/')`.

- [ ] **Step 4: Extract the current creation form and fix its login return path**

Move the current `web/app/page.tsx` client logic into `web/components/CreateAppForm.tsx`. Keep its storage keys and API call unchanged, but use this 401 branch:

```ts
if (exc instanceof ApiError && exc.status === 401) {
  router.push(`/login?next=${encodeURIComponent('/create')}`);
} else {
  setError(exc instanceof Error ? exc.message : '网络连接失败，请稍后重试');
}
```

`web/app/(platform)/create/page.tsx` renders `<CreateAppForm />` and exports create-page metadata.

- [ ] **Step 5: Move routes under Route Groups and scope the existing product CSS**

Add the alias:

```json
// web/tsconfig.json compilerOptions
"baseUrl": ".",
"paths": { "@/*": ["./*"] }
```

Root layout becomes HTML/body/font/theme-only. Platform layout renders:

```tsx
import PlatformHeader from '@/components/PlatformHeader';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <><PlatformHeader /><main className="platform-shell">{children}</main></>;
}
```

Scope the current generic `main`, `section`, form, action, message, and heading rules under `.platform-shell` so they do not style marketing sections.

The temporary marketing page must be functional, not empty:

```tsx
import Link from 'next/link';

export default function MarketingHome() {
  return <main id="main-content"><h1>让想法成为真正可用的应用</h1><Link href="/create">开始创建</Link></main>;
}
```

- [ ] **Step 6: Update and extend the creation E2E**

Change the existing draft test to open `/create`. Add a test that stores a draft, returns `401` for `POST /api/apps`, submits, and expects `/login?next=%2Fcreate`; then complete a stubbed login and expect `/create` with the original draft still present.

Add an open-redirect regression using the real login form:

```ts
test('login rejects an external next target', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ json: { ok: true } }));
  await page.goto('/login?next=%2F%2Fevil.test');
  await page.getByLabel('用户名').fill('owner');
  await page.getByLabel('密码').fill('password-for-test');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/apps$/);
});
```

- [ ] **Step 7: Run route, unit, and creation-flow checks**

Run:

```bash
npm --workspace web run test -- navigation.test.ts
npm --workspace web run typecheck
npm --workspace web run test:e2e -- workspace.spec.ts
```

Expected: PASS; public URLs are unchanged and the creation draft survives authentication.

- [ ] **Step 8: Commit the route split**

```bash
git add web/app web/components web/lib/navigation.ts web/tests/navigation.test.ts web/e2e/workspace.spec.ts web/global.css web/tsconfig.json
git commit -m "refactor: separate marketing and platform web routes"
```

---

### Task 4: Add Local Fonts, Theme Bootstrap, and Accessible Marketing Navigation

**Files:**
- Create: `web/app/fonts.ts`
- Create: `web/lib/theme.ts`
- Create: `web/tests/theme.test.ts`
- Create: `web/components/marketing/ThemeToggle.tsx`
- Create: `web/components/marketing/MobileMenu.tsx`
- Create: `web/components/marketing/MarketingHeader.tsx`
- Create: `web/components/marketing/marketing.module.css`
- Modify: `web/app/layout.tsx`
- Modify: `web/app/(marketing)/page.tsx`
- Modify: `web/global.css`
- Modify: `web/design/marketing-home.ts`
- Create: `web/e2e/marketing-home.spec.ts`

**Interfaces:**
- Produces: `Theme`, `readStoredTheme`, `resolveTheme`, `applyTheme`, font CSS variables, and the reusable marketing header.
- Consumes: font files and node `100:5063` from Task 1.

- [ ] **Step 1: Write failing pure theme tests**

```ts
// web/tests/theme.test.ts
import { expect, test } from 'vitest';
import { readStoredTheme, resolveTheme } from '../lib/theme';

test('stored theme wins and invalid storage falls back to the OS', () => {
  expect(readStoredTheme('dark')).toBe('dark');
  expect(readStoredTheme('sepia')).toBeNull();
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme(null, true)).toBe('dark');
  expect(resolveTheme(null, false)).toBe('light');
});
```

- [ ] **Step 2: Run the theme test and verify it fails**

Run: `npm --workspace web run test -- theme.test.ts`

Expected: FAIL because `web/lib/theme.ts` does not exist.

- [ ] **Step 3: Implement theme helpers and pre-hydration bootstrap**

```ts
// web/lib/theme.ts
export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'intellideploy:theme';

export function readStoredTheme(value: string | null): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function resolveTheme(stored: Theme | null, prefersDark: boolean): Theme {
  return stored ?? (prefersDark ? 'dark' : 'light');
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
```

Root layout uses `suppressHydrationWarning` and an inline `<script>` in `<head>` that reads `intellideploy:theme`, falls back to `matchMedia('(prefers-color-scheme: dark)')`, and sets `data-theme` before body paint. The script must catch storage access errors and still apply the OS theme.

- [ ] **Step 4: Declare the selected local fonts**

```ts
// web/app/fonts.ts
import localFont from 'next/font/local';

export const alibaba = localFont({
  src: [
    { path: '../assets/fonts/AlibabaPuHuiTi-3-55-Regular.ttf', weight: '400' },
    { path: '../assets/fonts/AlibabaPuHuiTi-3-75-SemiBold.ttf', weight: '600' },
  ],
  variable: '--font-alibaba',
  display: 'swap',
});
export const inter = localFont({ src: '../assets/fonts/Inter-Variable.ttf', variable: '--font-inter', display: 'swap' });
export const geist = localFont({ src: '../assets/fonts/Geist-Variable.ttf', variable: '--font-geist', display: 'swap' });
export const ibarra = localFont({ src: '../assets/fonts/IbarraRealNova-Variable.ttf', variable: '--font-ibarra', display: 'swap' });
export const instrument = localFont({ src: '../assets/fonts/InstrumentSans-Variable.ttf', variable: '--font-instrument', display: 'swap' });
export const pixelify = localFont({ src: '../assets/fonts/PixelifySans-Variable.ttf', variable: '--font-pixelify', display: 'swap' });
export const weijun = localFont({ src: '../assets/fonts/ZiTiQuanWeiJunHei-W3.ttf', variable: '--font-weijun', display: 'swap' });
```

Apply all variables on `<html>` and keep `PingFang SC` only in CSS fallback lists.

- [ ] **Step 5: Build the Figma-aligned navigation and accessible mobile menu**

Dump and inspect the formal navigation nodes before editing JSX or CSS:

```bash
FIGMA_JSON=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/design-data/document.kiwi.json
mkdir -p artifacts/figma/homepage
for id in 5063 5065 5068 5085 5086 5087 5088; do
  jq --argjson local "$id" '.nodeChanges[] | select(.guid.sessionID == 100 and .guid.localID == $local)' "$FIGMA_JSON" > "artifacts/figma/homepage/100-$id.json"
done
```

Use node `100:5063` dimensions and child typography from `100:5065`, `100:5068`, `100:5085-5088`. Correct Figma spelling in production copy. The real links are:

Record the inspected navigation dimensions, padding, gaps, typography, radii, paint, and shadow values in the navigation entry of `web/design/marketing-home.ts` before implementing the component.

```ts
const marketingLinks = [
  { href: '#mibo', label: 'Mibo' },
  { href: '#community', label: '应用社区' },
  { href: '#pricing', label: '套餐' },
] as const;
```

`MobileMenu` uses a button with `aria-expanded`, focuses the first menu link after opening, closes on Escape, and restores focus to the trigger. `ThemeToggle` stores the next theme and calls `applyTheme`.

- [ ] **Step 6: Add navigation/theme browser checks**

```ts
// web/e2e/marketing-home.spec.ts
import { expect, test } from '@playwright/test';

test('theme persists and the mobile menu closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换为浅色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  await expect(page.getByRole('navigation', { name: '移动导航' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: '移动导航' })).toBeHidden();
});
```

- [ ] **Step 7: Run theme, type, and focused E2E checks**

Run:

```bash
npm --workspace web run test -- theme.test.ts
npm --workspace web run typecheck
npm --workspace web run test:e2e -- marketing-home.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit theme and navigation**

```bash
git add web/app web/components/marketing web/lib/theme.ts web/tests/theme.test.ts web/e2e/marketing-home.spec.ts web/global.css web/design/marketing-home.ts
git commit -m "feat: add homepage theme and responsive navigation"
```

---

### Task 5: Build the Hero, Capability, Mibo, and Community Feature Sections

**Files:**
- Create: `web/components/marketing/content.ts`
- Create: `web/components/marketing/HeroSection.tsx`
- Create: `web/components/marketing/CapabilityStrip.tsx`
- Create: `web/components/marketing/MiboFeature.tsx`
- Create: `web/components/marketing/CommunityFeature.tsx`
- Create: `web/tests/marketing-content.test.tsx`
- Modify: `web/vitest.config.ts`
- Modify: `web/components/marketing/marketing.module.css`
- Modify: `web/app/(marketing)/page.tsx`
- Modify: `web/design/marketing-home.ts` only if the node inspection reveals a corrected formal value; record the exact reason in the commit.

**Interfaces:**
- Produces: truthful `marketingCopy` and the static upper-page visual sections.
- Consumes: nodes `100:5099`, `100:5107`, `100:5117`, `100:5228`, `100:5329` and Task 1 assets.

- [ ] **Step 1: Write failing copy and markup tests**

```tsx
// web/tests/marketing-content.test.tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { marketingCopy } from '../components/marketing/content';
import HeroSection from '../components/marketing/HeroSection';

const forbidden = ['381032', '5289', '2319', 'Cummunitty', 'Calyra', 'Mindful Start', 'Brightwave', 'Alice'];

describe('marketing copy', () => {
  test('contains only real routes and no Figma placeholder claims', () => {
    const serialized = JSON.stringify(marketingCopy);
    forbidden.forEach(value => expect(serialized).not.toContain(value));
    expect(marketingCopy.hero.primaryHref).toBe('/create');
    expect(marketingCopy.hero.secondaryHref).toBe('/community');
    expect(serialized).not.toContain('href":"#"');
  });

  test('hero exposes one page heading and both real calls to action', () => {
    const html = renderToStaticMarkup(<HeroSection />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/community"');
  });
});
```

- [ ] **Step 2: Run the content test and verify missing components fail**

Run: `npm --workspace web run test -- marketing-content.test.tsx`

Expected: FAIL because the content and section modules do not exist.

- [ ] **Step 3: Record the inspected values before writing section CSS**

Run the exact node dump for `100:5099`, `100:5107`, `100:5117`, `100:5228`, and `100:5329`:

```bash
FIGMA_JSON=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/design-data/document.kiwi.json
mkdir -p artifacts/figma/homepage
for id in 5099 5107 5117 5228 5329; do
  jq --argjson local "$id" '.nodeChanges[] | select(.guid.sessionID == 100 and .guid.localID == $local)' "$FIGMA_JSON" > "artifacts/figma/homepage/100-$id.json"
done
```

Read the dumped nodes and add the measured heading sizes, section dimensions, content widths, stack spacing, corner radii, and paint/effect summaries to the matching entries in `web/design/marketing-home.ts`. Do not copy the fake text values from `text.csv`.

- [ ] **Step 4: Define truthful product copy**

```ts
// web/components/marketing/content.ts
export const marketingCopy = {
  hero: {
    eyebrow: 'IntelliDeploy',
    title: '让想法成为真正可用的应用',
    description: '描述你的需求，IntelliDeploy 会整理验收目标、选择实现路径、验证功能，并交付可以继续调整的应用。',
    primaryLabel: '开始创建', primaryHref: '/create',
    secondaryLabel: '浏览应用社区', secondaryHref: '/community',
  },
  capabilities: [
    ['自然语言需求', '从业务目标开始，而不是先填写云资源参数。'],
    ['持续对话调整', '在同一个应用和版本链路中继续修改。'],
    ['按验收项验证', '用实际业务操作和证据判断是否完成。'],
    ['独立运行交付', '应用、版本、实例和公开页面边界清晰。'],
  ],
  mibo: {
    label: 'Mibo', title: '把需求说清楚，再开始实现',
    description: 'Mibo 会围绕用途、数据、权限和外部能力提出必要问题，并把确认结果保存为可验证的需求。',
    href: '/create', action: '和 Mibo 开始创建',
  },
  community: {
    label: '应用社区', title: '使用真实公开应用，也可以创建独立副本',
    description: '公开应用展示经过发布的版本和可用入口。创建副本会获得独立应用、实例和数据空间，不复制作者的私有数据。',
    href: '/community', action: '进入应用社区',
  },
} as const;
```

- [ ] **Step 5: Implement the static visual sections**

Build semantic sections with stable IDs `mibo` and `community`. Use `next/image` for the checked-in PNGs, mark pure atmosphere layers as decorative, and give the Mibo image meaningful alt text. Use CSS Grid/Flex instead of absolute page coordinates. At `>=1440px`, use `max-width: 1744px`; at smaller widths, preserve reading order.

Update Vitest once in this task so JSX-bearing unit tests are discovered without weakening the existing test boundary:

```ts
// web/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.{ts,tsx}'] } });
```

The CSS must define tokenized values rather than repeated literals:

```css
.page {
  --marketing-max: 1744px;
  --primary: #7c62ff;
  --text: #494a64;
  --muted: #7f80a1;
  --surface-soft: #eff3ff;
  color: var(--text);
  overflow: clip;
}
.container { width: min(var(--marketing-max), calc(100% - 2 * clamp(20px, 6vw, 141px))); margin-inline: auto; }
.heroTitle { font-family: var(--font-weijun); font-size: clamp(4.5rem, 13.8vw, 17.5rem); line-height: .9; }
```

Use the node evidence to refine exact section-specific values rather than treating this initial token block as the finished visual result.

- [ ] **Step 6: Assemble the upper homepage and run tests**

The marketing page renders `MarketingHeader`, `HeroSection`, `CapabilityStrip`, `MiboFeature`, and `CommunityFeature` in Figma order.

Run:

```bash
npm --workspace web run test -- marketing-content.test.tsx marketing-design.test.ts
npm --workspace web run typecheck
npm --workspace web run build
```

Expected: PASS.

- [ ] **Step 7: Commit the upper-page sections**

```bash
git add web/components/marketing web/app/'(marketing)'/page.tsx web/tests/marketing-content.test.tsx web/design/marketing-home.ts web/vitest.config.ts
git commit -m "feat: build Figma-aligned homepage hero and features"
```

---

### Task 6: Load and Render Real Community Data With Independent Failure States

**Files:**
- Create: `web/lib/marketing-data.ts`
- Create: `web/tests/marketing-data.test.ts`
- Create: `web/components/marketing/CommunityPreview.tsx`
- Create: `web/components/marketing/DeliveryFlow.tsx`
- Modify: `web/components/marketing/marketing.module.css`
- Modify: `web/app/(marketing)/page.tsx`
- Modify: `web/design/marketing-home.ts`

**Interfaces:**
- Produces: `LoadState<T>`, `MarketingData`, and `loadMarketingData(client?)`.
- Consumes: `publicApi.listPublications()`, `publicApi.listPublicSkus()`, `PublicationPage`, `QuotaSku[]`, and formal delivery node `100:5496`.

- [ ] **Step 1: Write failing loader-state tests, including independent failures**

```ts
// web/tests/marketing-data.test.ts
import { expect, test, vi } from 'vitest';
import { loadMarketingData } from '../lib/marketing-data';

const publicationPage = { items: [], next_cursor: null };
const skus = [{ id: 'cny', name: '额度包', provider: 'alipay', currency: 'CNY', amount_minor: 9900, units: 10000, period: null }];

test('loads community and pricing in parallel', async () => {
  const client = { listPublications: vi.fn(async () => publicationPage), listPublicSkus: vi.fn(async () => skus) };
  await expect(loadMarketingData(client)).resolves.toEqual({
    community: { status: 'ready', data: publicationPage },
    pricing: { status: 'ready', data: skus },
  });
  expect(client.listPublications).toHaveBeenCalledOnce();
  expect(client.listPublicSkus).toHaveBeenCalledOnce();
});

test('a community failure does not erase valid pricing', async () => {
  const client = { listPublications: vi.fn(async () => { throw new Error('offline'); }), listPublicSkus: vi.fn(async () => skus) };
  await expect(loadMarketingData(client)).resolves.toEqual({
    community: { status: 'error' },
    pricing: { status: 'ready', data: skus },
  });
});
```

Add the mirror case: SKU failure with successful community data.

- [ ] **Step 2: Run the loader tests and verify they fail**

Run: `npm --workspace web run test -- marketing-data.test.ts`

Expected: FAIL because `web/lib/marketing-data.ts` does not exist.

- [ ] **Step 3: Implement the parallel loader with explicit result states**

```ts
// web/lib/marketing-data.ts
import type { components } from '@intellideploy/api-client';
import { publicApi } from './community';

type Schema = components['schemas'];
export type LoadState<T> = { status: 'ready'; data: T } | { status: 'error' };
export type MarketingData = {
  community: LoadState<Schema['PublicationPage']>;
  pricing: LoadState<Schema['QuotaSku'][]>;
};
type MarketingClient = Pick<typeof publicApi, 'listPublications' | 'listPublicSkus'>;

export async function loadMarketingData(client: MarketingClient = publicApi): Promise<MarketingData> {
  const [community, pricing] = await Promise.allSettled([
    client.listPublications(),
    client.listPublicSkus(),
  ]);
  return {
    community: community.status === 'fulfilled' ? { status: 'ready', data: community.value } : { status: 'error' },
    pricing: pricing.status === 'fulfilled' ? { status: 'ready', data: pricing.value } : { status: 'error' },
  };
}
```

- [ ] **Step 4: Implement the real community preview states**

`CommunityPreview` accepts `LoadState<PublicationPage>` and renders exactly three states:

```tsx
if (state.status === 'error') {
  return <section id="community-preview" aria-labelledby="community-title"><p role="status">社区内容暂时无法加载。</p><Link href="/community">前往应用社区</Link></section>;
}
if (state.data.items.length === 0) {
  return <section id="community-preview" aria-labelledby="community-title"><p>社区暂时还没有公开应用。</p><Link href="/community">查看应用社区</Link></section>;
}
return <ul>{state.data.items.slice(0, 3).map(publication => <li key={publication.id}><Link href={`/community/${publication.id}`}>{publication.name}</Link><p>{publication.summary}</p><span>{publication.available ? '正在运行' : '暂不可用'}</span></li>)}</ul>;
```

Do not render favorite/copy/use actions on the marketing preview. Those stay on the real community pages.

- [ ] **Step 5: Replace the fake testimonial geometry with the real delivery flow**

Inspect the formal delivery frame before implementing it:

```bash
FIGMA_JSON=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/design-data/document.kiwi.json
mkdir -p artifacts/figma/homepage
jq '.nodeChanges[] | select(.guid.sessionID == 100 and .guid.localID == 5496)' "$FIGMA_JSON" > artifacts/figma/homepage/100-5496.json
```

Record the measured geometry, typography, paint/effects, and internal spacing in `web/design/marketing-home.ts`. Use node `100:5496` for visual structure, but render these verified steps:

```ts
const deliverySteps = [
  ['整理需求', '保存用途、数据、权限和可观察验收结果。'],
  ['选择路径', '优先评估可复用应用，再决定部署、改造、整合或生成。'],
  ['验证交付', '运行接口和页面检查，保存 PASS、FAIL 或 NOT_RUN 证据。'],
  ['继续调整', '新版本验证成功后发布；失败不替换当前可用版本。'],
] as const;
```

Keep the Figma editorial composition and Ibarra/Inter typography, but remove all Calyra/Alice/Brightwave text and star-rating semantics.

- [ ] **Step 6: Load data in the Server Component and run tests**

```tsx
// web/app/(marketing)/page.tsx
export const dynamic = 'force-dynamic';

export default async function MarketingHome() {
  const data = await loadMarketingData();
  return <MarketingPage community={data.community} pricing={data.pricing} />;
}
```

Run:

```bash
npm --workspace web run test -- marketing-data.test.ts marketing-content.test.tsx
npm --workspace web run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the real community and delivery slice**

```bash
git add web/lib/marketing-data.ts web/tests/marketing-data.test.ts web/components/marketing web/app/'(marketing)'/page.tsx web/design/marketing-home.ts
git commit -m "feat: connect homepage community and delivery sections"
```

---

### Task 7: Render Real SKU Pricing, Footer, and the Complete Marketing Page

**Files:**
- Create: `web/lib/money.ts`
- Create: `web/tests/money.test.tsx`
- Create: `web/components/marketing/PricingSection.tsx`
- Create: `web/components/marketing/MarketingFooter.tsx`
- Create: `web/components/marketing/MarketingPage.tsx`
- Modify: `web/components/marketing/marketing.module.css`
- Modify: `web/app/(marketing)/page.tsx`
- Modify: `web/app/layout.tsx` metadata
- Modify: `web/design/marketing-home.ts`

**Interfaces:**
- Produces: `formatMinorAmount(currency, amountMinor)`, complete pricing states, final footer, and full page assembly.
- Consumes: `LoadState<QuotaSku[]>`, pricing frame `100:5547`, instance `100:5548`, symbol `100:2691`, and footer frame `100:5549`.

- [ ] **Step 1: Write failing integer-money and pricing-state tests**

```tsx
// web/tests/money.test.tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { formatMinorAmount } from '../lib/money';
import PricingSection from '../components/marketing/PricingSection';

test('formats supported integer minor units without inventing discounts', () => {
  expect(formatMinorAmount('CNY', 9900)).toContain('99.00');
  expect(formatMinorAmount('USD', 1900)).toContain('19.00');
});

test('pricing renders empty and error truthfully', () => {
  expect(renderToStaticMarkup(<PricingSection state={{ status: 'ready', data: [] }} />)).toContain('套餐暂未发布');
  expect(renderToStaticMarkup(<PricingSection state={{ status: 'error' }} />)).toContain('套餐信息暂时无法加载');
});
```

- [ ] **Step 2: Run the money test and verify it fails**

Run: `npm --workspace web run test -- money.test.tsx`

Expected: FAIL because the money and pricing modules do not exist.

- [ ] **Step 3: Implement display-only currency formatting**

```ts
// web/lib/money.ts
export function formatMinorAmount(currency: 'CNY' | 'USD', amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new RangeError('amount_minor must be a non-negative safe integer');
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
```

This conversion is presentation only. It does not calculate price, discount, grant, exchange rate, or checkout amount.

- [ ] **Step 4: Implement pricing from `QuotaSku` only**

Inspect the pricing frame, instance, and symbol before implementing the cards:

```bash
FIGMA_JSON=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/design-data/document.kiwi.json
mkdir -p artifacts/figma/homepage
for id in 5547 5548 2691; do
  jq --argjson local "$id" '.nodeChanges[] | select(.guid.sessionID == 100 and .guid.localID == $local)' "$FIGMA_JSON" > "artifacts/figma/homepage/100-$id.json"
done
```

Record the measured card geometry, typography, spacing, paints, borders, radii, and effects in `web/design/marketing-home.ts`. Each card renders `name`, formatted `amount_minor`, `units`, `period`, and `provider`. Provider labels are a fixed translation of the schema enum: 支付宝、微信支付、Stripe. Period labels are derived without claiming auto-renewal: `MONTH` -> `每月额度`, `YEAR` -> `每年额度`, null -> `单次额度包`, unknown non-empty values -> display the raw server period after safe text rendering.

The only pricing CTA in this plan is:

```tsx
<Link href="/login?next=%2Fcreate">登录后管理额度</Link>
```

Do not use “立即购买”, “订阅成功”, discount badges, feature bullets, or a highlighted “best” card.

- [ ] **Step 5: Implement the real footer and page assembly**

Dump `100:5549` and record its measured alignment, typography, paint, and spacing values in `web/design/marketing-home.ts` before writing the footer CSS:

```bash
FIGMA_JSON=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/design-data/document.kiwi.json
mkdir -p artifacts/figma/homepage
jq '.nodeChanges[] | select(.guid.sessionID == 100 and .guid.localID == 5549)' "$FIGMA_JSON" > artifacts/figma/homepage/100-5549.json
```

Footer links are `/create`, `/community`, `/apps`, `/login`, and `/register`. Omit Terms/Privacy links until real pages exist. Assemble sections in this order:

```tsx
<div className={styles.page}>
  <MarketingHeader />
  <main id="main-content">
    <HeroSection />
    <CapabilityStrip />
    <MiboFeature />
    <CommunityFeature />
    <CommunityPreview state={community} />
    <DeliveryFlow />
    <PricingSection state={pricing} />
  </main>
  <MarketingFooter />
</div>
```

Update root metadata to describe the actual platform without duration or success-rate claims.

- [ ] **Step 6: Run unit, type, and build checks**

Run:

```bash
npm --workspace web run test -- money.test.tsx marketing-content.test.tsx marketing-data.test.ts
npm --workspace web run typecheck
npm --workspace web run build
```

Expected: PASS.

- [ ] **Step 7: Commit the complete page assembly**

```bash
git add web/lib/money.ts web/tests/money.test.tsx web/components/marketing web/app web/design/marketing-home.ts
git commit -m "feat: complete homepage pricing and footer"
```

---

### Task 8: Finish Responsive, Accessibility, Dark-Theme, and Visual Verification

**Files:**
- Create: `web/e2e/fixture-api.mjs`
- Modify: `web/playwright.config.ts`
- Modify: `web/e2e/marketing-home.spec.ts`
- Create: `web/e2e/marketing-home.visual.spec.ts`
- Create: `web/e2e/marketing-home.visual.spec.ts-snapshots/*`
- Modify: `web/components/marketing/marketing.module.css`
- Modify: `web/global.css`
- Modify: section components only when a browser/accessibility failure identifies a concrete issue

**Interfaces:**
- Produces: deterministic SSR fixtures, final responsive styles, reviewed screenshots, and complete verification evidence.
- Consumes: all previous task outputs and the Figma light/dark reference renders.

- [ ] **Step 1: Add a test-only SSR fixture API**

```js
// web/e2e/fixture-api.mjs
import http from 'node:http';

const defaultMode = { community: 'ready', catalog: 'ready' };
let mode = { ...defaultMode };

const publication = {
  id: 'public-home', app_id: 'app-home', instance_id: 'instance-home', version_id: 'version-home',
  name: '面向跨部门协作的公开笔记与知识整理应用', summary: '保存、读取并继续整理个人笔记', features: ['保存笔记', '读取历史'],
  creator: '测试发布者', preview_url: null, url: null, available: false,
  payer_policy: 'VISITOR', sponsor_period: 'DAY', sponsor_limit_units: 0,
  copy_url: '/api/publications/public-home/copies', updated_at: '2026-11-11T00:00:00Z',
};
const skus = [
  { id: 'cny-pack', name: '基础额度包', provider: 'alipay', currency: 'CNY', amount_minor: 9900, units: 10000, period: null },
  { id: 'usd-monthly', name: '月度额度套餐', provider: 'stripe', currency: 'USD', amount_minor: 1900, units: 30000, period: 'MONTH' },
  { id: 'cny-team', name: '团队协作额度包', provider: 'wechat', currency: 'CNY', amount_minor: 29900, units: 50000, period: null },
  { id: 'usd-yearly', name: '年度额度套餐', provider: 'stripe', currency: 'USD', amount_minor: 19900, units: 360000, period: 'YEAR' },
  { id: 'cny-large', name: '大型项目额度包', provider: 'alipay', currency: 'CNY', amount_minor: 99900, units: 200000, period: null },
];

const send = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

const readBody = request => new Promise((resolve, reject) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
    catch (error) { reject(error); }
  });
  request.on('error', reject);
});

http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:9100');
  if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { ok: true });
  if (request.method === 'POST' && url.pathname === '/__fixture__/reset') {
    mode = { ...defaultMode };
    return send(response, 200, mode);
  }
  if (request.method === 'POST' && url.pathname === '/__fixture__/mode') {
    try {
      const next = await readBody(request);
      for (const key of ['community', 'catalog']) {
        if (next[key] !== undefined && !['ready', 'empty', 'error'].includes(next[key])) {
          return send(response, 400, { error: { code: 'INVALID_MODE', message: `invalid ${key} mode`, retryable: false } });
        }
      }
      mode = { ...mode, ...next };
      return send(response, 200, mode);
    } catch {
      return send(response, 400, { error: { code: 'INVALID_JSON', message: 'fixture body must be JSON', retryable: false } });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/community/apps') {
    if (mode.community === 'error') return send(response, 503, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'fixture community failure', retryable: true } });
    return send(response, 200, { items: mode.community === 'empty' ? [] : [publication], next_cursor: null });
  }
  if (request.method === 'GET' && url.pathname === '/api/catalog/skus') {
    if (mode.catalog === 'error') return send(response, 503, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'fixture catalog failure', retryable: true } });
    return send(response, 200, mode.catalog === 'empty' ? [] : skus);
  }
  if (request.method === 'GET' && url.pathname === '/api/publications/public-home') return send(response, 200, publication);
  return send(response, 404, { error: { code: 'NOT_FOUND', message: 'fixture route not found', retryable: false } });
}).listen(9100, '127.0.0.1');
```

Update Playwright to run fixture-dependent files serially, give screenshots a platform-independent path, and start the fixture API before Next:

```ts
// web/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 15000,
  workers: 1,
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node e2e/fixture-api.mjs',
      url: 'http://127.0.0.1:9100/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'npm run build && npm run start -- --port 3100',
      url: 'http://127.0.0.1:3100/api/auth/me',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        API_BASE_URL: 'http://127.0.0.1:9100',
        SESSION_SECRET: 'test-only-session-secret-with-over-32-chars',
        WEB_ORIGIN: 'http://127.0.0.1:3100',
      },
    },
  ],
});
```

- [ ] **Step 2: Add responsive and accessibility E2E assertions**

Extend `marketing-home.spec.ts` with:

```ts
import { expect, test } from '@playwright/test';

const fixtureUrl = 'http://127.0.0.1:9100';

test.afterEach(async ({ request }) => {
  await request.post(`${fixtureUrl}/__fixture__/reset`);
});

test('mobile reflows long real-shaped content without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('link', { name: '开始创建' })).toHaveAttribute('href', '/create');
  const emptyLinks = await page.locator('a').evaluateAll(links => links.filter(link => !link.getAttribute('href') || link.getAttribute('href') === '#').length);
  expect(emptyLinks).toBe(0);
});

test('dynamic sections fail independently without hiding the homepage', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__fixture__/mode`, { data: { catalog: 'error' } });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '让想法成为真正可用的应用' })).toBeVisible();
  await expect(page.getByText('套餐信息暂时无法加载')).toBeVisible();
  await expect(page.getByText('面向跨部门协作的公开笔记与知识整理应用')).toBeVisible();
});

test('community failure keeps real pricing visible', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__fixture__/mode`, { data: { community: 'error' } });
  await page.goto('/');
  await expect(page.getByText('社区内容暂时无法加载')).toBeVisible();
  await expect(page.getByText('基础额度包')).toBeVisible();
});

test('dynamic sections render truthful empty states', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__fixture__/mode`, { data: { community: 'empty', catalog: 'empty' } });
  await page.goto('/');
  await expect(page.getByText('社区暂时还没有公开应用')).toBeVisible();
  await expect(page.getByText('套餐暂未发布')).toBeVisible();
  await expect(page.getByText('面向跨部门协作的公开笔记与知识整理应用')).toHaveCount(0);
});

test('reduced motion removes meaningful animation durations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const maxDurationMs = await page.locator('body').evaluate(body => {
    const milliseconds = (value: string) => value.split(',').map(part => {
      const duration = part.trim();
      return duration.endsWith('ms') ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000;
    });
    return Math.max(...[body, ...body.querySelectorAll('*')].flatMap(element => {
      const style = getComputedStyle(element);
      return [...milliseconds(style.animationDuration), ...milliseconds(style.transitionDuration)];
    }));
  });
  expect(maxDurationMs).toBeLessThanOrEqual(0.01);
});
```

The browser never intercepts these API calls because the homepage fetches them in a Server Component. Control the dedicated local fixture with Playwright's `request` fixture instead; do not replace Server Components with client fetching merely to simplify the test.

- [ ] **Step 3: Finish the responsive CSS from actual browser evidence**

Use these structure rules:

```css
@media (max-width: 1439px) {
  .featureGrid, .pricingGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  .desktopNav { display: none; }
  .mobileTrigger { display: inline-flex; }
  .heroGrid, .featureGrid, .pricingGrid, .deliveryGrid { grid-template-columns: minmax(0, 1fr); }
  .heroCopy { order: 1; }
  .heroVisual { order: 2; }
}
@media (prefers-reduced-motion: reduce) {
  .page *, .page *::before, .page *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
```

Refine section-specific values by checking `2025`, `1440`, `1024`, `768`, and `390` viewports. Do not solve overflow with `transform: scale()` or a globally fixed page width.

- [ ] **Step 4: Add deterministic visual snapshot tests**

```ts
// web/e2e/marketing-home.visual.spec.ts
import { expect, test } from '@playwright/test';

for (const scenario of [
  { name: 'desktop-light', width: 2025, height: 1200, theme: 'light' },
  { name: 'desktop-dark', width: 2025, height: 1200, theme: 'dark' },
  { name: 'laptop-light', width: 1440, height: 1000, theme: 'light' },
  { name: 'mobile-light', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
] as const) {
  test(`marketing ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.addInitScript(theme => localStorage.setItem('intellideploy:theme', theme), scenario.theme);
    await page.goto('/');
    await expect(page).toHaveScreenshot(`${scenario.name}.png`, { fullPage: true, animations: 'disabled' });
  });
}
```

Generate the first baselines only after manual comparison with the Figma renders:

```bash
npm --workspace web run test:e2e -- marketing-home.visual.spec.ts --update-snapshots
```

- [ ] **Step 5: Perform the required Figma overlay inspection**

Run the visual test at `2025px`, then compare the light and dark full-page screenshots with resized Figma references:

```bash
mkdir -p artifacts/visual/homepage
magick '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/web/assets/New：Home（浅色模式）.png' -resize 2025x artifacts/visual/homepage/figma-light-2025.png
magick '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/web/assets/New：Home（深色模式）.png' -resize 2025x artifacts/visual/homepage/figma-dark-2025.png
magick artifacts/visual/homepage/figma-light-2025.png web/e2e/marketing-home.visual.spec.ts-snapshots/desktop-light.png -compose difference -composite artifacts/visual/homepage/light-difference.png
magick artifacts/visual/homepage/figma-dark-2025.png web/e2e/marketing-home.visual.spec.ts-snapshots/desktop-dark.png -compose difference -composite artifacts/visual/homepage/dark-difference.png
```

Inspect the reference, implementation, and difference images section by section. Correct container guides, section order, vertical rhythm, font scale, card ratios, radii, gradients, shadows, and asset placement before accepting baselines. Text pixels may differ because the production copy is truthful, but text block widths and visual density must preserve the design intent.

- [ ] **Step 6: Run the complete local verification suite**

Start the dedicated local PostgreSQL service if it is not already available, then run:

```bash
docker compose -p intellideploy-dev -f infra/compose.dev.yml up -d --wait postgres
PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1/test_public_catalog.py -q
npm --workspace @intellideploy/api-client test
npm --workspace web run test
npm --workspace web run typecheck
npm --workspace web run build
npm --workspace web run test:e2e
git diff --check
```

Expected: every command exits `0`. If a visual snapshot changes after a code edit, inspect it against Figma again before updating the baseline.

- [ ] **Step 7: Commit the responsive and visual verification slice**

```bash
git add web/playwright.config.ts web/e2e web/components/marketing web/global.css
git commit -m "test: verify responsive Figma-aligned homepage"
```

---

## Plan Self-Review Checklist

- Spec coverage: Tasks 1-8 cover Figma evidence, assets/fonts, routing, creation migration, theme, light/dark visuals, static truthful content, real community/SKU data, BFF/auth boundaries, errors, accessibility, responsive reflow, and visual verification.
- Scope: payment callbacks/orders and Expo native pages remain separate, as required.
- Type consistency: `QuotaSku`, `PublicationPage`, `LoadState<T>`, `MarketingData`, `safeNext`, and `formatMinorAmount` have one definition each and matching consumers.
- Review Focus: all five failure classes have an owning task and explicit automated test.
- Placeholder scan: the plan contains no unresolved implementation fields; every task names exact files, interfaces, tests, commands, and commit boundaries.
