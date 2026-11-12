# Main integration notes

## Integration rule

- Base is the latest local `main`; preserve its backend, billing, platform and font commits.
- For overlapping frontend files, document functional differences explicitly.
- Preserve the mobile Figma branch's visual implementation unless doing so would remove a newer functional contract from `main`.
- Resolve functionality by composition: keep the newer backend/API behavior from `main`, then adapt it to the mobile branch's visual component structure.
- Do not claim the 16 deferred visual failures pass after merge.

## Main-exclusive frontend changes before integration

- User-provided functional authority for the latest `main`:
  - Web: application creation/workspace, job recovery, community/copy, instance management, payments, developer evaluation, and no false delivery link on failure.
  - Expo: persistent jobs, cross-client continuation, community/copy, payment/quota recovery, identity and secure storage.
  - Shared client: updated `packages/api-client` OpenAPI types and request interfaces.
  - Backend: API, worker, generation/publication, capabilities, ledger/payment, evaluation, legacy-data migration and operations.
- Added Alibaba PuHuiTi 3.0 and multiple licensed variable-font files plus `FONT_SOURCES.md`.
- Updated `frontend/components/InstanceControls.tsx` for newer platform/runtime operations.
- Added billing and payment E2E coverage and updated `BillingScreen.tsx`.
- Updated `frontend/e2e/cross-client.spec.ts` and `frontend/playwright.config.ts` for the newer Phase 1 backend and cross-client acceptance.
- Updated `frontend/screens/app-detail/AppDetailScreen.tsx` for newer backend/application behavior.

## Required conflict outcomes

- Fonts: retain all `main` font files and provenance; keep the mobile branch's explicit runtime typography mapping unless a tracked licensed font is intentionally selected.
- `AppDetailScreen.tsx`: retain `main`'s newer functional/API behavior and the mobile branch's raw-reply, recovery, accessibility and Figma-aligned layout behavior. Record any behavior that cannot coexist.
- Cross-client tests/config: retain `main`'s newer Phase 1 coverage while keeping the mobile branch's safe `INTELLIDEPLOY_TEST_DATABASE_URL` resolver and local-only database validation.
- Billing and `InstanceControls`: take `main` functionality; the four pending visual families remain `VISUAL_PENDING` unless separately approved.
- Failed jobs/deliveries: retain `main`'s rule that failed states never expose fabricated or stale delivery links; Figma success visuals may render only for a genuine successful `DeliveryResult`.
- Expo persistence/security: retain `main`'s persistent task, cross-client continuation, payment/quota recovery, identity and secure-storage behavior; adapt those states into the mobile branch's components rather than restoring older screen logic.
- API client/backend: generated types and request contracts from `main` are authoritative. Frontend compile errors must be resolved by updating callers, never by reverting generated contracts or backend capabilities.

## Post-merge evidence

### Resolved composition

- `frontend/components/InstanceControls.tsx`: retained the feature branch's `GlassCard`, `ErrorState`, persistent idempotency drafts, operation polling and 44pt switch target; added `main`'s quota-stop `补充额度` action with the owning `appId`. Start, stop and confirmed delete behavior remains the authoritative `main` API flow.
- `frontend/screens/app-detail/AppDetailScreen.tsx`: retained the Figma-aligned `ChatbotPage`, raw assistant reply bytes, state-driven actions, draft persistence, 402/409 readback, accessibility and secondary `VISUAL_PENDING` shell. Both billing entry points now carry `appId`, preserving `main`'s payment/quota return-to-resume flow. `DeliveryCard` remains the only delivery entry and renders no open action without a real `DeliveryResult` plus a running instance; failed/in-progress jobs do not fabricate a link.
- `frontend/screens/billing/BillingScreen.tsx`: retained all `main` account, SKU, order, checkout, refund, subscription cancellation, app-resume return and foreground/readback behavior inside the feature branch's `WorkspacePage` + `VisualPendingSection` + `GlassCard`/`ErrorState` shell. `/billing` remains `VISUAL_PENDING`.
- `frontend/playwright.config.ts`: retained `main`'s payment-aware real API fixture and newer Web/Expo coverage while sourcing `DATABASE_URL` only through the feature branch's local-only `resolveTestDatabaseUrl()`.
- `tests/phase1/payment_browser_api.py` and `frontend/e2e/payment-cross-client.spec.ts`: the payment fixture and direct test setup now validate/use the same resolved local test database, including allowed isolated `INTELLIDEPLOY_TEST_DATABASE_URL` names. Ambient `DATABASE_URL` cannot redirect the suite.
- `frontend/e2e/mobile-visual-pending.spec.ts`: updated only the billing route fixtures to return the authoritative separate balance/policy/usage/subscription/SKU/order response shapes.

### User-visible differences

- Required `main` behavior adds quota top-up, purchase/order, subscription and return-to-resume controls inside the existing billing and app-detail secondary pending shells. These two page families were already explicitly `VISUAL_PENDING`; no approved formal Figma screen was replaced.
- No other user-visible functional or visual difference was introduced by conflict resolution. No visual reference, mask or threshold was changed.

### Commands and results

- `npm --workspace @intellideploy/api-client run build` — PASS. This refreshed the local package build so frontend typechecking consumed `main`'s merged payment contracts rather than stale pre-merge `dist` declarations.
- `npm --workspace frontend run typecheck` — PASS.
- `npm --workspace frontend test -- --run tests/testDatabase.test.ts tests/visualPending.test.ts tests/jobVisualState.test.ts` — PASS: 36 passed, 2 intentionally skipped.
- `npm --workspace frontend exec -- playwright test e2e/billing.spec.ts e2e/payment-cross-client.spec.ts e2e/mobile-chatbot.spec.ts e2e/community.spec.ts e2e/mobile-visual-pending.spec.ts e2e/mobile-source-rendering.spec.ts` — intentionally interrupted after the functional group completed because `mobile-source-rendering.spec.ts` requires the 375x812 mobile fixture config, not the standard 390x844 integration config. Before interruption, billing/community/job recovery/instance-operation cases passed (17 passed, 2 source-dependent skips). The invalid 390px source-geometry failures were not treated as product evidence.
- `npm --workspace frontend exec -- playwright test e2e/payment-cross-client.spec.ts e2e/mobile-visual-pending.spec.ts` — payment/resume and non-billing pending-shell cases passed; two billing pending tests exposed stale pre-merge catch-all mocks. After updating only those mocks, `npm --workspace frontend exec -- playwright test e2e/mobile-visual-pending.spec.ts --grep 'billing keeps|billing retries'` — PASS: 2 passed. The signed cross-client payment test passed against the real API/PostgreSQL/crypto path with only the provider substituted, and resumed the same paused job.
- `npm --workspace frontend exec -- playwright test --config playwright.mobile.config.ts e2e/mobile-source-rendering.spec.ts --grep 'short actual multiline reply|detailed actual reply|successful actual reply|actual conversation bytes|actual public assistant reply|older assistant reply|complete local delivery'` — PASS: 7 passed. This covers raw replies, exact source geometry, management access, old-reply/new-job separation, genuine local delivery and `NOT_RUN` external acceptance.
- `npm --workspace frontend exec -- playwright test --config playwright.mobile.config.ts e2e/mobile-visual.spec.ts --grep 'chatbot page-(48|49|50|51|52|53|54|55|58)'` — captured all nine fresh app-detail formal states; Playwright's auxiliary `toHaveScreenshot` gate reports missing untracked Darwin snapshot baselines, so this command is not a PASS claim.
- `npm --workspace frontend run visual:compare:mobile` — retained the documented deferred visual status. Fresh app-detail classifications match the latest feature evidence: pages 48-49 PASS; pages 50-55 and 58 remain pre-existing FAIL/VISUAL_DEFERRED. Their MAE and changed-pixel ratios differ from the latest feature evidence by at most `0.000044` and `0.000105` respectively, consistent with the same rendering; references, the `0.08/0.03/32` thresholds and masks were untouched. Other already-documented deferred families also remain failures and are not claimed as fixed.
- Final gate: `npm --workspace @intellideploy/api-client run build && npm --workspace frontend test && npm --workspace frontend run typecheck && .venv/bin/python -m py_compile tests/phase1/payment_browser_api.py && git diff --check && ! rg -n '^(<<<<<<<|=======|>>>>>>>)' ...` — PASS: API client build succeeded; all 20 frontend unit files passed (114 passed, 9 source-dependent skips); frontend typecheck and Python syntax checks succeeded; no whitespace errors or conflict markers remained.

### Controller final whole-branch gates

- API client build: PASS.
- Frontend units: 114 PASS, 9 named source-dependent skips.
- Frontend typecheck: PASS before and after all three exports.
- Functional mock mobile E2E (`--grep-invert @visual`): 140 PASS, 2 named source-package skips.
- Persistent workspace/community against the local test backend: 26/26 PASS.
- Cross-client app/community/payment and paused-job resume: 3/3 PASS.
- Web, iOS and Android Expo exports: PASS.
- Original strict visual comparator: **10 PASS / 16 FAIL, exit 1, overall FAIL**. This exactly preserves the explicitly accepted deferred milestone; no reference, mask, threshold or baseline changed.
- Playwright snapshot capture: all 26 actual states regenerated; command exits 1 because the deliberately unapproved Darwin snapshot baselines do not exist.
- Main preservation check: `git diff main..HEAD -- backend web packages/api-client` is empty. Backend, Web and shared API client functionality therefore matches `main` byte-for-byte; only the four documented Expo/frontend conflict-composition files differ from `main`.
- `git diff --check`, unmerged-stage check and conflict-marker review: PASS.
- Native Maestro: NOT_RUN; no newly available booted/connected matching app target was introduced by the merge.
