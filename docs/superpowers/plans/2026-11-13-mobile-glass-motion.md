# Mobile source glass and motion implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Steps use checkbox syntax.

**Goal:** Implement real live-backdrop, source-parameter glass/noise and complete supported source interactions on the existing mobile pages.

**Architecture:** Reuse source geometry/effect extraction and existing cancellable motion. A small shared optical model feeds Web SVG backdrop filters and native Skia live-underlay shader rendering. Page adapters preserve actual source paint order; route/control transitions preserve existing business navigation.

**Tech Stack:** Expo55/RN0.83, react-native-svg, React Animated/Reanimated; native Skia2.4.18 only where required; existing Vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-glass-motion-design.md`.

## Global constraints

- Same worktree; original source SHA and 26-state manifest remain authoritative. No design screenshot/PNG/PDF inference.
- Frontend only, optional necessary frontend graphics dependency/lockfile. No backend/API/shared DTO/DB/seed/Web-client/production changes.
- Real data via existing API. Mibo timeout never advances Job; pure UI Symbol timeout has no business side effects.
- Source duration/easing/geometry/paint/visibility/clip/matrix and independent actual-runtime evidence. No blur-as-GLASS, no parameter-label-as-proof.
- Responsive320/360/375/390/430 and short/long/insets; preserve text/44pt targets.
- Existing auth/draft/key/401/402/409/Delivery/favorite/copy/created navigation remains.
- Preserve WIP, original baselines and ledgers. No push/main workspace switch/worktree deletion.

### Task 1: Real source glass/noise core and all existing page adapters

**Files:**
- Create: `frontend/components/mobile/glass/sourceGlassModel.ts`, `SourceGlassLayer.web.tsx`, `SourceGlassLayer.native.tsx`, `LiveGlassBackdrop.native.tsx`, `LiveGlassBackdrop.tsx`.
- Create: `frontend/scripts/extract-glass-evidence.mjs`, `frontend/design/glassEvidence.ts`.
- Modify: `frontend/components/mobile/FigmaGeometry.tsx`, `FigmaTree.tsx`, `FigmaEffects.tsx`, `AppBackground.tsx`, `GlassCard.tsx`, `CircleAction.tsx`, `ChatComposer.tsx`, `BottomNav.tsx`.
- Modify page surfaces as necessary: `frontend/features/home/HomeArtwork.tsx`, `MobileHome.tsx`; `frontend/features/products/ProductFolder.tsx`; `frontend/features/store/StoreScreen.tsx`, `PublicationCard.tsx`, `PublicationCarousel.tsx`, `StoreRankingScreen.tsx`; `frontend/screens/login/LoginScreen.tsx`; `frontend/features/community/DiscoveryCard.tsx`, `FeaturedPublication.tsx`; `frontend/components/mobile/MiboStage.tsx`.
- Modify only as required: `frontend/package.json`, root `package-lock.json`, Metro config for platform-safe native dependency imports.
- Create: `frontend/tests/sourceGlassModel.test.ts`, `liveGlassBackdrop.test.tsx`, `frontend/e2e/components/glass-source.spec.ts`; extend isolated component root only for test fixtures.
- Modify: `frontend/design/sourceEffectSupport.ts` only after actual implementation checks.

**Interfaces:** `SourceGlassLayer` receives raw effect records, original shape/path/size/matrix and current layout; shared raw lookup by sourceNodeId has no runtime Downloads dependency. Native underlay is real separately painted RN content or an explicitly ordered current source scene; it never contains the optics currently being evaluated. Web directly samples the live actual backdrop. Both adapters consume one documented optical field model, with pure evaluation available to tests.

- [ ] Write RED: original raw values equal source; changing refraction/dispersion/light/noise actually changes computed/rendered output; zero controls remove their effect; seed repeats; geometry/matrix clips remain; dynamic input changes without remount.

```ts
test('source controls affect optics independently', () => {
  const raw = sourceNode('270:26624').effects.find(e => e.type === 'GLASS');
  const a = evaluateGlassField(raw, {x:2,y:18,width:295,height:36});
  const b = evaluateGlassField({...raw,refractionIntensity:0}, {x:2,y:18,width:295,height:36});
  expect(b.displacement).toEqual({x:0,y:0});
  expect(a.displacement).not.toEqual(b.displacement);
});
```

- [ ] Run RED source tests and a synthetic live-backdrop browser test; preserve the failed output.
- [ ] Implement the documented normal/displacement/RGB separation/light/noise model and real platform inputs. Native live capture single-flight/generation/disposal/scroll/DPR/cleanup; z-order adapters explicitly preserve prior paint content. Include all visible source shape classes and raw fields, not a sample-only lens.
- [ ] Run GREEN math/raw tests, actual Web lens dynamic/matrix/clip/parameter tests; shader compile and native boundary lifecycle tests. Install Expo-compatible Skia only if native shader path requires it. Test actual nested page ancestors and dynamic under-glass content, not just an isolated rectangle.
- [ ] Run source+DTO units and typecheck; relevant page/source-effects E2E and component tests sequentially; three exports for new native dependency. Honest device/performance boundaries in report.
- [ ] Commit scoped glass implementation and independent spec/quality review.

### Task 2: Complete valid source motion contracts and runtime consumers

**Files:**
- Modify: `frontend/scripts/extract-source-motion.mjs`, `frontend/design/sourceMotionEvidence.ts`.
- Create: `frontend/design/sourceControlMotionEvidence.ts`, `frontend/scripts/extract-control-motion-evidence.mjs`, `frontend/components/mobile/SourceAnimatedControl.tsx`, `SourceRouteTransition.tsx`.
- Modify: `frontend/components/mobile/CircleAction.tsx`, `BottomNav.tsx`, `BrandHeader.tsx`, `useSourceMotion.ts` only if lifecycle interface genuinely needed.
- Modify: `frontend/app/_layout.tsx`, relevant existing source route callers in Home/Store/Ranking/Product/Mibo/Community; preserve desktop WebHome.
- Create: `frontend/tests/sourceControlMotion.test.ts`, `sourceRouteTransition.test.tsx`, `frontend/e2e/mobile-complete-motion.spec.ts`; extend component fixture for pure Symbol state tests.
- Correct source audit labels in store/ranking generator and audit artifacts: actual `点赞特效` identity/ancestry; don't infer missing DTO semantics from an ancestor named 设置.

**Interfaces:** Existing `getSourceMotion`, `sampleSourceEasing`, `useSourceMotion` remain compatible. Source target Symbol dependency closure captures follow-up visual timeout states. Route transition consumes an explicit source motion and existing destination route; it doesn't create another router or unapproved page.

- [ ] Write RED for unresolved hover state, complete click/timeout Symbol chain, valid route directions/curve, and cross-route/current-presentation cancellation. Source motion coverage ledger maps every initial record and dependency action to runtime control or exact source/data limitation.

```ts
test('visual timeout is separate from Job authority', () => {
  expect(shouldStartSourceTransition(miboMotion,'prototype-timer','queued','success')).toBe(false);
  expect(controlChain('228:19794').map(x=>x.targetNodeId)).toContain('228:19791');
});
```

- [ ] Run RED relevant unit/component/rendered motion tests.
- [ ] Implement source property interpolation, settings hover, source reaction pure visual controller, route transitions and actual source event adapters. Missing social API cannot fake success. Invalid-target SCROLL_TO remains explicit source limitation, never a guessed action. Retained layers pointer/accessibility hidden; completion releases resources and IDs; latest presentation captures before replacement; AppState/reduced-motion deterministic.
- [ ] GREEN independent raw tuple/state comparisons and actual start/middle/end samples across short/reference/long viewport; rapid/reversal/background/unmount/reduced paths; correct existing navigation and no business timers.
- [ ] Commit scoped motion implementation and independent spec/quality review.

### Task 3: Final material/motion verification and precise current differences

**Files:**
- Modify: existing `frontend/e2e/mobile-source-acceptance.spec.ts`, source acceptance summary/tests only as needed to record actual new implementation/support.
- Modify: `docs/superpowers/handoffs/2026-11-13-mobile-frontend-current-design-differences.md`, `2026-11-13-mobile-frontend-source-acceptance.md`.
- Create: `docs/superpowers/handoffs/2026-11-13-mobile-glass-motion-acceptance.md`.
- Generated ignored artifacts: `frontend/artifacts/glass-motion/*`, new plan SDD reports/logs/coverage.

- [ ] Validate strict summary remains conservative; unsupported browser/native rendering and missing source/API fields cannot become PASS.
- [ ] Run final full source+DTO unit, typecheck, full nonvisual mobile, isolated component tests, targeted glass/motion suite, Web/iOS/Android export, final typecheck and diff/scope/WIP fingerprint checks. Tests/config/exports run sequentially where they share cache.
- [ ] Refresh per-state material/motion evidence. Runtime source parameter rendering, proprietary-algorithm equality, API data and real-device measurements are separate claims. Document exact unexecuted/unsupported conditions.
- [ ] Commit exact acceptance updates; whole-branch independent review with deferred/source limitations and actual renderer/shader tests, then one consolidated fix wave if needed.

## Execution

Already authorized by the user's request to implement the confirmed source glass/motion. Continue the existing SDD approach with one implementer at a time; no repeated approval gates for routine reversible technical choices. Final output is code, evidence and explicit limitations, not an analysis-only handoff.
