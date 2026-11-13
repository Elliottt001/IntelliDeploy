# Task 5 Report: Source-Driven Responsive Login01

## Scope

- Implemented only Task5 frontend login/font/source evidence work.
- Modified login implementation, login render evidence/extractor, font aliases, and focused login/font tests.
- Did not change backend, API contracts, shared client, database, auth scheme, dependencies, source references, or comparators.

## Source Evidence

- Design root: `/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221`.
- Original source read: `design-data/document.kiwi.json`.
- Login frame: `119:76618`, size `375x812`, no `prototypeInteractions`.
- Input parent: `119:76685`, transform `x=47 y=356`, size `280x112`.
- Account surface: `119:76686`, size `280x48`, inside stroke `0.30000001192092896`, corner radius `12`, fill `#FFFFFF`, stroke `#A3B2FF`.
- Account placeholder: `119:76687`, transform `16.5/16.5`, font size `11`, derived glyph baseline `11.460000038146973`.
- Password surface/text: `119:76688` / `119:76689`, same surface stroke and placeholder transform; password surface source offset from account is `64`.
- Font files verified locally with SFNT PostScript names:
  - `AlibabaPuHuiTi_3_45_Light`
  - `AlibabaPuHuiTi_3_55_Regular`
  - `AlibabaPuHuiTi_3_55_Regular_L3`
  - `AlibabaPuHuiTi_3_75_SemiBold`
  - `AlibabaPuHuiTi_3_85_Bold`

## RED Evidence

Log: `.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/logs/task5-red-summary.log`

- `mobileFonts.test.ts` failed because `mobileFontAssets` still resolved existing aliases to PuHuiTi 2.0 files instead of tracked PuHuiTi 3.0 files.
- `mobile-login.spec.ts` failed because `login-account-surface` did not exist.
- `mobile-login.spec.ts` also failed the responsive width RED at 320px: expected `238.93333333333334`, received fixed `280`.

## Implementation

- Regenerated `frontend/design/loginRenderEvidence.ts` from original Kiwi with input source data for surfaces and placeholder text metrics.
- Registered existing PuHuiTi 3.0 font files under current Expo aliases, preserving unrelated fonts and old 2.0 files.
- Split login inputs into:
  - SVG source surface using exact fill/stroke/corner/stroke width.
  - Transparent editable layer preserving `login-account` / `login-password` test IDs and real input behavior.
- Used `fitSourceWidth` for responsive input width at 320/360/375/390/430 instead of fixed 280pt.
- Preserved 375pt source origin by applying the source left/right margin imbalance from `47/48`.
- Removed the custom 0.58s login entrance animation path; login now uses a plain layout wrapper because formal login01 has no prototype interaction.
- Kept existing auth, 401 error, failed-input preservation, disabled providers, remember, privacy, next/register, and forgot-password-unavailable behavior.

## GREEN Evidence

- Focused units:
  - Command: `INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 npm --workspace frontend test -- mobileFonts.test.ts loginOptions.test.ts authStorage.test.ts`
  - Log: `.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/logs/task5-focused-units-green.log`
  - Result: `3 passed`, `6 tests passed`.
- Login E2E:
  - Command: `INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 npm --workspace frontend run test:e2e:mobile -- mobile-login.spec.ts`
  - Log: `.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/logs/task5-mobile-login-green.log`
  - Result: `8 passed`.
- Typecheck:
  - Command: `INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 npm --workspace frontend run typecheck`
  - Log: `.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/logs/task5-typecheck-green.log`
  - Result: exit 0.
- Full source + DTO unit suite:
  - Command: `INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 INTELLIDEPLOY_DTO_PYTHON=/Users/bytedance/Projects/my/byte-intelli/.venv/bin/python npm --workspace frontend test`
  - Log: `.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/logs/task5-full-source-dto-units-green.log`
  - Result: `26 passed`, `156 tests passed`.

## Self-Review

- File scope is limited to the Task5 listed frontend files plus this report/log evidence.
- No new backend/API/shared-client/database/dependency changes.
- Runtime login uses source data generated from Kiwi, not PNG/PDF/image inference.
- Source fractional stroke remains an SVG stroke, not a CSS border.
- Editable input layer remains real and transparent; auth and error semantics are unchanged.
- Existing 2.0 font files remain in the repo; only aliases changed to 3.0.

## Limitations

- Native iOS/Android device rendering was not run in this task; native-only visual/device acceptance remains `NOT_RUN`.
- Expo web server continues to print existing package compatibility warnings for `react-native` and `react-native-svg`; this task did not change dependencies.
- Unsupported source effects remain bounded by existing source-effect support reporting; Task5 did not broaden native effect support.
