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

Complete this section during integration with resolved files, commands, results and any functional differences that remain visible to users.
