# IntelliDeploy Mobile Visual Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不伪造业务数据、不修改原始视觉合同的前提下，逐项处理当前 16 个严格视觉失败，并完成原生设备和四类 `VISUAL_PENDING` 的准确验收记录。

**Architecture:** 继续将 Figma 结构化证据与真实 API 数据分开验证。静态几何、矢量、材质、字体和 effect 以 Kiwi/FIG/Symbol 为准；Publication、App、Job、Conversation、DeliveryResult 继续来自真实接口或仓库本地中性 fixture。每个任务先用区域诊断证明静态根因，再写失败测试、最小修复、完整回归和独立 review；不能通过替换参考图、增加 mask、放宽阈值或复制 Figma 示例业务数据来变绿。

**Tech Stack:** Expo 55、React Native 0.83、TypeScript 5.9、React Native SVG、Vitest、Playwright、Maestro。

**Spec:** `docs/superpowers/specs/2026-11-11-intellideploy-mobile-figma-design.md`

## Global Constraints

- 本目录 `visual-report.json` 的 16 个 FAIL 是下期输入；初始整体状态固定为 `FAIL`。
- 原始 26 张 reference、mask、`MAE <= 0.08`、`changedPixelRatio <= 0.03`、`channelDelta = 32` 不得修改。
- 所有页面继续支持 320pt、375pt 和更宽手机；禁止整页比例缩放，触控目标不得小于 `44x44pt`。
- Pawzzle 手机图仅作为来源可核实的静态设计插画；真实 `preview_url` 优先，失败预览保持中性，空 API 结果不能插入假应用。
- 不得伪造评分、下载量、排名热度、点赞、评论、在线人数、任务步骤、依赖信息、完成百分比、验收结果、成功状态或公开 URL。
- `/store`、`/community` 匿名可读；受保护路由与 401/402/409、草稿、幂等键、SecureStore、轮询和恢复语义保持不变。
- 所有 cross-client 测试仅使用仓库本地 fixture 和显式 `INTELLIDEPLOY_TEST_DATABASE_URL` 指向的本地测试数据库。
- 每个任务必须 RED -> GREEN -> regression -> 独立 review；失败图只在完整 26 图同版重拍后才能改为 PASS。
- Maestro 没有可用设备时记录 `NOT_RUN` 和准确前置条件，不能声称原生通过。
- 不执行 push、生产发布、线上 API/RPC、生产数据库、远程配置或环境变更。

---

### Task 1: Freeze and Classify the 16 Failure Regions

**Files:**
- Read: `frontend/artifacts/figma/mobile/next-phase-failures-2026-11-12/visual-report.json`
- Read: `frontend/artifacts/figma/mobile/next-phase-failures-2026-11-12/{actual,reference,overlays}/*`
- Create: `frontend/artifacts/figma/mobile/next-phase-failures-2026-11-12/region-classification.json`
- Test: `frontend/tests/mobileVisualGate.test.ts`

**Interfaces:**
- Consumes: 16 个失败页面的 actual/reference/overlay 和未修改的 comparator。
- Produces: 每页 `staticSourceRegions`、`apiTruthRegions`、`enginePendingRegions`，每项含源 node、屏幕矩形、证据类型和允许的修复范围。

- [ ] **Step 1: Add a failing classification contract test**

在 `mobileVisualGate.test.ts` 读取新 JSON，断言恰好覆盖 16 个 FAIL；每个区域必须有 `kind`、`rect`、`evidence`，且 `apiTruthRegions` 不得声明需要复制参考图中的评分、统计或任务事实。

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm --workspace frontend test -- mobileVisualGate.test.ts`

Expected: FAIL because `region-classification.json` does not exist.

- [ ] **Step 3: Inspect structured Figma evidence and write the classification**

按 `document.kiwi.json -> original .fig -> node JSON -> Symbol/override -> CSV -> raw assets` 顺序记录静态来源。对无法证明为静态根因的差异标为 `apiTruth` 或 `enginePending`，不得猜测。

- [ ] **Step 4: Run the test and visual-report integrity check**

Run: `npm --workspace frontend test -- mobileVisualGate.test.ts`

Run: `node -e "const r=require('./frontend/artifacts/figma/mobile/next-phase-failures-2026-11-12/visual-report.json'); if(r.formal.length!==26||r.formal.filter(x=>x.status==='FAIL').length!==16) process.exit(1)"`

Expected: PASS and unchanged `10 PASS / 16 FAIL` input.

- [ ] **Step 5: Commit only the classification and its test**

```bash
git add frontend/tests/mobileVisualGate.test.ts frontend/artifacts/figma/mobile/next-phase-failures-2026-11-12/region-classification.json
git commit -m "test: classify remaining mobile visual failures"
```

### Task 2: Finish Near-threshold Home and Mibo Static Conformance

**Files:**
- Modify: `frontend/features/home/HomeArtwork.tsx`
- Modify: `frontend/features/home/MobileHome.tsx`
- Modify: `frontend/components/mobile/MobileBackdrop.tsx`
- Modify: `frontend/components/mobile/AppBackground.tsx`
- Modify: `frontend/components/mobile/MiboStage.tsx`
- Modify: `frontend/components/mobile/ChatComposer.tsx`
- Modify: `frontend/e2e/mobile-home.spec.ts`
- Modify: `frontend/e2e/mobile-chatbot.spec.ts`
- Modify: `frontend/e2e/mobile-source-rendering.spec.ts`

**Interfaces:**
- Consumes: Task 1 中 `home 32-35`、`chatbot 50-55/58` 的 `staticSourceRegions`。
- Produces: 只改变可证明的矢量、effect、字体基线、可见性或父变换；真实 Job 状态与完整回复保持不变。

- [ ] **Step 1: Add one failing rendered-geometry/effect test per proved shared cause**

每个测试必须从源 node 推导期望屏幕坐标或 effect 参数，并在当前实际 DOM/SVG 上失败。若 49/50 或 31/32 的共享静态像素完全相同，不得创建虚假的逐状态修复。

- [ ] **Step 2: Run focused tests and capture RED logs**

Run: `npm --workspace frontend run test:e2e:mobile -- mobile-home.spec.ts mobile-chatbot.spec.ts mobile-source-rendering.spec.ts`

Expected: only the newly proved source assertions fail.

- [ ] **Step 3: Implement the minimum static-source corrections**

复用现有 evidence producer 和原生组件；不修改 fixture 文案、Job phase、Conversation 内容或 DeliveryResult 来追像素。

- [ ] **Step 4: Run functional and responsive regression**

Run: `npm --workspace frontend run test:e2e:mobile -- mobile-home.spec.ts mobile-chatbot.spec.ts workspace.spec.ts`

Run: `npm --workspace frontend run typecheck`

Expected: PASS at 320/375/430, with 44pt targets and raw reply preservation.

- [ ] **Step 5: Re-capture all 26 images and record honest status**

Run: `npm --workspace frontend run test:visual:mobile`

Run: `npm --workspace frontend run visual:compare:mobile`

Expected: comparator may still exit 1; record exact changes without approving a baseline unless all 26 pass.

- [ ] **Step 6: Commit reviewed source fixes only**

```bash
git add frontend/features/home frontend/components/mobile frontend/e2e/mobile-home.spec.ts frontend/e2e/mobile-chatbot.spec.ts frontend/e2e/mobile-source-rendering.spec.ts
git commit -m "fix: align remaining home and Mibo source geometry"
```

### Task 3: Store and Products Material Conformance Without Fake Catalog Facts

**Files:**
- Modify: `frontend/features/store/PublicationCard.tsx`
- Modify: `frontend/features/store/PublicationCarousel.tsx`
- Modify: `frontend/features/store/StoreRankingScreen.tsx`
- Modify: `frontend/features/products/ProductFolder.tsx`
- Modify: `frontend/e2e/mobile-store.spec.ts`
- Modify: `frontend/e2e/mobile-products.spec.ts`
- Modify: `frontend/tests/publicationViewModel.test.ts`

**Interfaces:**
- Consumes: store 03/40 and products 57 static regions; real Publication/App DTOs and the approved static-design illustration classification.
- Produces: source-correct card/folder material and layout while keeping API preview priority, updated-at ordering, empty/error states and full real product list.

- [ ] **Step 1: Add RED tests for each proved material, clip or source transform mismatch**

Tests must assert node geometry/effect/clip and API priority separately. Include real preview, missing preview static illustration, failed preview neutral state, empty result, and five-plus product pagination.

- [ ] **Step 2: Run RED**

Run: `npm --workspace frontend test -- publicationViewModel.test.ts`

Run: `npm --workspace frontend run test:e2e:mobile -- mobile-store.spec.ts mobile-products.spec.ts`

- [ ] **Step 3: Apply minimum native component fixes**

Do not add ratings, downloads, awards, popularity scores, fake App rows or screenshot-based cards.

- [ ] **Step 4: Run regression and full strict comparison**

Run: `npm --workspace frontend test`

Run: `npm --workspace frontend run test:e2e:mobile`

Run: `npm --workspace frontend run visual:compare:mobile`

- [ ] **Step 5: Commit reviewed store/products fixes**

```bash
git add frontend/features/store frontend/features/products frontend/e2e/mobile-store.spec.ts frontend/e2e/mobile-products.spec.ts frontend/tests/publicationViewModel.test.ts
git commit -m "fix: align store and product source materials"
```

### Task 4: Community Static Shell With Real Publication Semantics

**Files:**
- Modify: `frontend/features/community/CommunityBackground.tsx`
- Modify: `frontend/features/community/DiscoveryCard.tsx`
- Modify: `frontend/features/community/FeaturedPublication.tsx`
- Modify: `frontend/e2e/mobile-community.spec.ts`
- Modify: `frontend/e2e/community.spec.ts`
- Modify: `frontend/e2e/community-cross-client.spec.ts`

**Interfaces:**
- Consumes: community 59/60 static regions and real Publication response ordering.
- Produces: source-correct shell, rail, featured material and horizontal state without inventing Feed/social fields.

- [ ] **Step 1: Write rendered source geometry/effect RED tests**

Assert header, rail, featured card, avatar slot, preview UV, clipping and the 94pt real wheel shift. Keep accessible grouped-card names tied to actual title/creator/summary/availability.

- [ ] **Step 2: Run focused RED and API behavior regressions**

Run: `npm --workspace frontend run test:e2e:mobile -- mobile-community.spec.ts`

Run: `npm --workspace frontend run test:e2e -- community.spec.ts community-cross-client.spec.ts`

- [ ] **Step 3: Implement only source-backed shell/material fixes**

Do not add Li Wei/Chen Mo, likes, comments, timestamps, online counts, “today top ten” or notifications without a real protocol.

- [ ] **Step 4: Run focused GREEN, anonymous access and cross-client tests**

Run the two commands from Step 2 plus `npm --workspace frontend run typecheck`.

- [ ] **Step 5: Re-capture 59/60 and then all 26**

Run: `npm --workspace frontend run test:visual:mobile`

Run: `npm --workspace frontend run visual:compare:mobile`

- [ ] **Step 6: Commit reviewed community fixes**

```bash
git add frontend/features/community frontend/e2e/mobile-community.spec.ts frontend/e2e/community.spec.ts frontend/e2e/community-cross-client.spec.ts
git commit -m "fix: align community source shell"
```

### Task 5: Native, Pending Families, and Final Acceptance

**Files:**
- Modify only if a real defect is found: `frontend/.maestro/*.yaml`
- Update: `frontend/artifacts/figma/mobile/visual-report.json`
- Create: `frontend/artifacts/figma/mobile/next-phase-failures-2026-11-12/final-acceptance.md`

**Interfaces:**
- Consumes: all reviewed fixes and current API truth contract.
- Produces: one honest final acceptance record; either all strict gates pass or remaining failures stay explicitly open.

- [ ] **Step 1: Run the complete frontend and persistent gates**

```bash
npm --workspace frontend test
npm --workspace frontend run typecheck
npm --workspace frontend run test:e2e:mobile
npm --workspace frontend run test:e2e -- workspace.spec.ts community.spec.ts
npm --workspace frontend run test:e2e -- cross-client.spec.ts community-cross-client.spec.ts
```

Use only the owned local fixture database and run Playwright suites serially to avoid port conflicts.

- [ ] **Step 2: Run visual capture and unchanged comparator**

```bash
npm --workspace frontend run test:visual:mobile
npm --workspace frontend run visual:compare:mobile
```

Expected for approval: all 26 rows `PASS`. Otherwise keep overall `FAIL`; never approve or replace baselines.

- [ ] **Step 3: Run native checks or record exact NOT_RUN prerequisites**

Run the existing Maestro navigation, generate, recover, products and community flows only on a booted/connected device with the matching app build. If unavailable, record `NOT_RUN` rather than PASS.

- [ ] **Step 4: Export all platforms and scan prohibited content**

```bash
npx expo export --platform web --output-dir dist/web
npx expo export --platform ios --output-dir dist/ios
npx expo export --platform android --output-dir dist/android
git diff --check
```

Run the plan's sensitive-log, remote-resource, fake-data and placeholder scans. Preserve the intentional Web 金咪奖/寻爪 placeholder and approved static Pawzzle design illustration classification.

- [ ] **Step 5: Fresh independent whole-branch review**

Reviewer must triage every Critical/Important finding and verify the final 26-row report. Fix and re-review all blocking findings before integration.

- [ ] **Step 6: Integrate only after main is clean and every required gate is satisfied**

Do not touch the current dirty main workspace. After its owner commits or clears those changes, merge latest local `main` into the feature branch, rerun all gates, obtain final review, then merge locally without push.

## Completion Rule

This follow-up is complete only when:

1. all 26 original strict comparisons pass without reference/mask/threshold changes;
2. API truth and security/route semantics remain green;
3. native checks pass, or explicitly accepted `NOT_RUN` prerequisites are recorded without claiming native completion;
4. four `VISUAL_PENDING` families remain accurately labelled until separately approved;
5. main integration occurs only in a clean primary workspace and all post-merge gates pass.
