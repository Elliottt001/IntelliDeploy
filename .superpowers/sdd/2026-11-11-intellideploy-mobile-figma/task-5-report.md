# Task 5 Report: Native Home and Expandable Cards

## Scope

- Implemented Task5 only in worktree `.worktrees/intellideploy-mobile-figma`.
- Touched only listed Task5 files plus this report:
  - `frontend/features/home/homeContent.ts`
  - `frontend/features/home/MobileHome.tsx`
  - `frontend/tests/homeContent.test.ts`
  - `frontend/e2e/mobile-home.spec.ts`
  - `frontend/screens/home/HomeScreen.tsx`

## Figma Evidence

- Formal local package: `/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/`.
- Global evidence priority followed: `design-data/移动端UI.nodes.json`, existing audited `frontend/design/figmaComponentEvidence.ts`, generated local mobile asset manifest, and existing theme tokens/components. PNG/PDF were not used as runtime assets.
- Home formal evidence:
  - `mobileEvidence.home.pages`: `page-02`, `page-29`, `page-30`, `page-31`, `page-32`, `page-33`, `page-34`, `page-35`.
  - `mobileEvidence.home.frameIds`: `270:26263`, `188:16287`, `188:16759`, `266:21147`, `268:22904`, `268:23238`, `268:23572`, `268:23906`.
  - `270:26263` page02 size: `375x812`.
  - `270:26318` wordcloud: `303x111 @39,277`, with measured text nodes such as `270:26320 AI Copilot`, `270:26321 Notion 模版`, `270:26335 Vibe Coding`, `270:26344 自动化工作流`.
  - `270:26345`, `270:26431`, `270:26460`, `270:26504`: four stacked home cards around `321x70/69/68` closed surfaces, with expanded formal surfaces `321x195`.
  - `270:26530` / `270:26531`: bottom capsule nav geometry, implemented through existing audited `BottomNav`.
- Component evidence reused:
  - `BrandHeader` / `brandMark` from `figmaComponentEvidence.brandMark`.
  - `CircleAction` settings from audited `settings` / `circleAction` evidence.
  - `BottomNav` from audited `bottomNav` and nav icon evidence.
  - `GlassCard` from audited `glassCard` evidence.
  - Mibo image from checked-in generated local mobile asset `mobileAssets['845:3522:114']`, no runtime Figma URL.

## TDD Evidence

- RED command: `npm --workspace frontend test -- homeContent.test.ts`
- RED output: failed because `../features/home/homeContent` did not exist.
- GREEN command: `npm --workspace frontend test -- homeContent.test.ts`
- GREEN output: `1 passed (1)`.

## Implementation Notes

- `homeContent.ts` exports curated-only suggestions and approved destinations:
  - `store -> /store`
  - `products -> /app-gallery`
  - `community -> /community`
  - `profile -> /app-gallery`
- `MobileHome.tsx`:
  - Uses `authAPI.getMe()` only for real username; fallback is `你好`.
  - Suggestions fill `/chatbot?prompt=...` only.
  - Card tap toggles visible expanded state with `accessibilityState.expanded` and explicit web `aria-expanded`.
  - Separate `进入` action performs actual route navigation.
  - Keeps `BottomNav` above safe area.
  - Removes fake examples from prior implementation: `99+`, profile `80/100%`, hot post counts, invented project/app counts.
- `HomeScreen.tsx`:
  - Preserves `WebHome` when `Platform.OS === 'web'` and `EXPO_PUBLIC_MOBILE_UI_PREVIEW !== '1'`.
  - Uses `<MobileHome />` for native and mock mobile preview.

## Verification

- Scoped GREEN/typecheck/E2E:
  - `npm --workspace frontend test -- homeContent.test.ts && npm --workspace frontend run typecheck && npm --workspace frontend run test:e2e:mobile -- mobile-home.spec.ts`
  - Result: unit `1 passed`; typecheck exit 0; mobile-home E2E `2 passed`.
- Full frontend once:
  - `npm --workspace frontend test`
  - Result: `11 passed (11)`, `59 passed (59)`.
- Required removal scan:
  - `rg -n "figma.com/api/mcp/asset|DESIGN_WIDTH|transformOrigin|⚙|✎" frontend/screens/home frontend/features/home`
  - Result: no matches.
- Fake metric scan:
  - `rg -n "99\\+|1\\.2k|8\\.5w|80/100|项目 12|应用 8|自动化 4|下载量|点赞|评论|在线人数|评分|今日十大" frontend/screens/home frontend/features/home`
  - Result: no matches.
- Runtime path/remote scan:
  - `rg -n "https?://|/Users/bytedance/Downloads|page-[0-9]+\\.png|configured-assets" frontend/features/home frontend/screens/home`
  - Result: no matches.

## Self Review

- Confirmed Task5 file bounds except for this required report file.
- Confirmed no backend/API/SecureStore contract changes.
- Confirmed no production/external environment changes.
- Confirmed no subagents were used.
- Known concern: Task12 strict `changedPixelRatio <= 0.03` is not proven here. This implementation now preserves the measured page02 composition more closely than the first-pass grid/chip version, but the truthful neutral replacements for fake Figma example metrics and profile completion will remain visual differences to record in Task12.
- Known concern: existing Expo web server warns that `react-native` and `react-native-svg` versions differ from Expo's expected versions. This was observed during E2E and not changed for Task5.
