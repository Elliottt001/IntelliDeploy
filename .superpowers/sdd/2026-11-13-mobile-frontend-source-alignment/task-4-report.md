# Task 4 Report: Source Paint, Mask, and Effect Preservation

Date: 2026-11-13
Worktree: `/Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma`
Branch: `codex/intellideploy-mobile-figma`

## Scope

Implemented Task 4 only:

- `frontend/scripts/extract-mobile-component-evidence.mjs`
- `frontend/scripts/extract-home-render-evidence.mjs`
- `frontend/design/figmaComponentEvidence.ts`
- `frontend/design/homeRenderEvidence.ts`
- `frontend/design/sourceEffectSupport.ts`
- `frontend/components/mobile/GlassCard.tsx`
- `frontend/tests/sourceEffects.test.ts`
- `frontend/tests/figmaComponentEvidence.test.ts`
- `frontend/e2e/mobile-source-effects.spec.ts`
- `frontend/e2e/mobile-source-rendering.spec.ts`

No backend/API/Web/shared-client/database/source-package/dependency/worktree changes were made.

The extraction path now preserves source effect identity and raw fields separately from renderer support. Preserving a raw field is evidence fidelity only; it is not a renderer `PASS`.

## RED

Command:

```bash
INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 npm --workspace frontend test -- sourceEffects.test.ts
```

Initial RED failed for the expected missing Task 4 behavior:

```text
FAIL tests/sourceEffects.test.ts
Tests 4 failed (4)
```

Failures covered:

- `GLASS` from source node `270:26624` was not preserved as `GLASS`; the old normalizer remapped it to `BACKGROUND_BLUR`.
- `NOISE` source data from `270:26319` was missing from generated evidence.
- `GlassCard` did not consume source stack padding from `825:6570`.
- `sourceEffectSupport.ts` did not exist, so no `PASS` / `NOT_IMPLEMENTED` / `NOT_RUN` classification was available.

Root cause: the existing effect normalization path conflated source effect preservation with current renderer approximation. It also sorted or filtered effect data in ways that made raw source order and unsupported source types unreliable for later consumers.

## Implementation

`extract-mobile-component-evidence.mjs` now exports `normalizeSourceEffect(effect, sourceNodeId)` and keeps visible source effects in source order. It preserves:

- `rawType` and `type` without remapping `GLASS` to `BACKGROUND_BLUR`.
- `sourceNodeId`, opacity, radius, spread, style id, blend mode, clip flags, bevel size, and shadow flags.
- GLASS optical fields: `refractionRadius`, `refractionIntensity`, `reflectionDistance`, `specularAngle`, `specularIntensity`, `chromaticAberration`.
- NOISE fields: `seed`, `density`, `noiseSize`, `noiseType`.
- unmapped source payload in `rawFields`, including `rawFields.authoredColor`.

`extract-home-render-evidence.mjs` reuses the same normalizer for home evidence and includes `sourceEffectSamples.storeSearchSurface` for source node `270:26624`.

`sourceEffectSupport.ts` records renderer support separately:

```text
DROP_SHADOW/web -> PASS
BACKGROUND_BLUR/web -> PASS
FOREGROUND_BLUR/web -> PASS
INNER_SHADOW/web -> PASS
LAYER_BLUR/web -> PASS
GLASS/web -> NOT_IMPLEMENTED
NOISE/web -> NOT_IMPLEMENTED
any supported native type on ios/android -> NOT_RUN
```

`GlassCard` consumes only capabilities the current stack can render:

- source stack padding from evidence.
- web `BACKGROUND_BLUR` as `backdropFilter: blur(<source radius>px)`.

It does not claim optical `GLASS` support.

## GREEN

Focused Task 4 unit command:

```bash
INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 npm --workspace frontend test -- sourceEffects.test.ts
```

Result:

```text
Test Files 1 passed (1)
Tests 4 passed (4)
```

Focused source evidence command:

```bash
INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 npm --workspace frontend test -- sourceEffects.test.ts figmaComponentEvidence.test.ts
```

Result:

```text
Test Files 2 passed (2)
Tests 23 passed (23)
```

Mobile source effects E2E command:

```bash
npm --workspace frontend run test:e2e:mobile -- mobile-source-effects.spec.ts
```

Result:

```text
2 passed
```

Legacy GLASS renderer classification E2E command:

```bash
npm --workspace frontend run test:e2e:mobile -- mobile-source-rendering.spec.ts --grep "backdrop blur approximation"
```

Result:

```text
1 passed
```

Full frontend unit/source/DTO command:

```bash
INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 INTELLIDEPLOY_DTO_PYTHON=/Users/bytedance/Projects/my/byte-intelli/.venv/bin/python npm --workspace frontend test
```

Result:

```text
Test Files 26 passed (26)
Tests 154 passed (154)
```

Typecheck command:

```bash
npm --workspace frontend run typecheck
```

Result: exit 0.

Deterministic component evidence regeneration command:

```bash
tmpdir=$(mktemp -d /tmp/intellideploy-task4-determinism.XXXXXX)
INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 node --input-type=module - "$tmpdir" <<'NODE'
import { extractMobileComponentEvidence } from './frontend/scripts/extract-mobile-component-evidence.mjs';
const outDir = process.argv[2];
const designSource = '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221';
await extractMobileComponentEvidence({ designSource, outputPath: `${outDir}/one.ts` });
await extractMobileComponentEvidence({ designSource, outputPath: `${outDir}/two.ts` });
NODE
cmp -s "$tmpdir/one.ts" "$tmpdir/two.ts"
wc -c "$tmpdir/one.ts" "$tmpdir/two.ts"
```

Result:

```text
287933 one.ts
287933 two.ts
cmp exit 0
```

Scope scan command:

```bash
git diff -- backend web packages/api-client infra tests/phase1 | wc -l
```

Result:

```text
0
```

## Support Classification

Current renderer status is intentionally narrow:

- `PASS`: web-only effect types with runtime evidence in current tests, such as `DROP_SHADOW` and `BACKGROUND_BLUR`.
- `NOT_IMPLEMENTED`: raw source types preserved but not faithfully rendered, including `GLASS` optical fields and `NOISE` seed/density/texture semantics.
- `NOT_RUN`: native platforms for supported raw types until iOS/Android runtime evidence exists.

Native verification remains `NOT_RUN`. During local Expo startup, `react-native-svg@15.16.1` warned, and the known native `FeMorphology` path warns/returns null. This task does not convert that into a native renderer pass.

## Deferred Consumers

Later task consumers must use preserved evidence and `effectSupport` instead of assuming raw preservation means rendered support.

Task 6:

- `frontend/features/home/MobileHome.tsx`
- `frontend/features/home/HomeArtwork.tsx`
- `frontend/features/home/homeContent.ts`
- `frontend/scripts/extract-home-render-evidence.mjs`
- `frontend/design/homeRenderEvidence.ts`
- `frontend/components/mobile/CircleAction.tsx`
- `frontend/components/mobile/BottomNav.tsx`
- `frontend/e2e/mobile-home.spec.ts`
- `frontend/e2e/mobile-source-rendering.spec.ts`

Task 7:

- `frontend/features/store/StoreScreen.tsx`
- `frontend/features/store/StoreRankingScreen.tsx`
- `frontend/features/store/PublicationCarousel.tsx`
- `frontend/features/store/PublicationCard.tsx`
- `frontend/features/store/publicationViewModel.ts`
- `frontend/scripts/extract-store-card-render-evidence.mjs`
- `frontend/scripts/extract-ranking-render-evidence.mjs`
- `frontend/design/storeCardRenderEvidence.ts`
- `frontend/design/rankingRenderEvidence.ts`
- `frontend/e2e/mobile-store.spec.ts`

Task 8:

- `frontend/components/mobile/MiboStage.tsx`
- `frontend/components/mobile/ChatComposer.tsx`
- `frontend/components/mobile/JobProgress.tsx`
- `frontend/features/chatbot/CreateWorkspaceView.tsx`
- `frontend/features/chatbot/AppConversationView.tsx`
- `frontend/features/chatbot/replyLayout.ts`
- `frontend/screens/app-detail/AppDetailScreen.tsx`
- `frontend/scripts/extract-mibo-render-evidence.mjs`
- `frontend/design/miboRenderEvidence.ts`
- `frontend/e2e/mobile-chatbot.spec.ts`
- `frontend/e2e/mobile-source-rendering.spec.ts`
- `frontend/tests/replyLayout.test.ts`

Task 9:

- `frontend/features/products/ProductFolder.tsx`
- `frontend/features/products/ProductList.tsx`
- `frontend/features/products/LibraryScreen.tsx`
- `frontend/screens/app-gallery/AppGalleryScreen.tsx`
- `frontend/features/products/extractProductFolderEvidence.mjs`
- `frontend/features/products/productFolderEvidence.ts`
- `frontend/e2e/mobile-products.spec.ts`

Task 10:

- `frontend/screens/community/CommunityScreen.tsx`
- `frontend/features/community/DiscoveryCard.tsx`
- `frontend/features/community/FeaturedPublication.tsx`
- `frontend/features/community/CommunityBackground.tsx`
- `frontend/features/community/communityViewModel.ts`
- `frontend/features/community/extractCommunityEvidence.mjs`
- `frontend/features/community/communityEvidence.ts`
- `frontend/e2e/mobile-community.spec.ts`
- `frontend/e2e/community.spec.ts`
- `frontend/e2e/community-cross-client.spec.ts`
- `frontend/app.config.js`
- `frontend/e2e/component-fixture-app/_layout.tsx`
- `frontend/e2e/component-fixture-app/index.tsx`
- `frontend/playwright.component.config.ts`
- `frontend/e2e/components/community-source.spec.ts`
- `frontend/tests/componentFixtureConfig.test.ts`

## Notes

Plan helper scripts in this worktree are not executable. When mentioning or rerunning them, use `bash` with absolute paths and pass explicit output paths.

## Self-Review

Checked:

- `GLASS` and `NOISE` remain raw source types in evidence.
- Source effect order is preserved.
- Unsupported source optical/noise data is preserved for later consumers but classified as `NOT_IMPLEMENTED`.
- Web `BACKGROUND_BLUR` is rendered only from an actual `BACKGROUND_BLUR` raw effect, not from optical `GLASS`.
- `GlassCard` uses source padding from the Figma stack.
- Generated evidence contains `sourceNodeId`, `sourcePadding`, and `rawFields`.
- Frontend scope stayed isolated; backend/API/Web/shared-client/database/source-package/dependency files were not changed.

Remaining limitations:

- No faithful optical `GLASS` renderer was implemented.
- No faithful `NOISE` renderer was implemented.
- Native support remains `NOT_RUN`.
- Later page tasks still need to consume the preserved evidence and support table in their own runtime contexts.
