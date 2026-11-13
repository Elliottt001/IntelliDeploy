# Mobile Frontend Source Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅修改前端，逐页完成六类26个正式移动端状态的源属性、自适应与动效对齐，使用现有API业务数据，并准确保留接口、渲染能力和设备验收缺口。

**Architecture:** 复用现有Expo Router、页面、Figma源提取器、共享API调用和持久草稿/轮询。增加小型源动效配置、响应式计算和统一取消/减少动态效果逻辑，随后逐页接入；不新建产品路由树、后端接口或通用页面引擎。源期望值直接读取原始Kiwi，实际结果从运行时组件/DOM及真实业务状态检查，分别报告。

**Tech Stack:** Expo55、React19、React Native0.83、TypeScript5.9、现有React Native SVG/Animated/Reanimated、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-figma-data-alignment-design.md`（用户已确认的仅前端修订版，内容版本82a5a7a；本轮只更新其审阅状态）。

## Global Constraints

- 本轮只修改前端，不改后端、API路由或返回结构、数据库/迁移、`packages/api-client/`共享契约、Web客户端、部署和计费逻辑。
- 允许`frontend/`中的页面、组件、源提取/证据、现有接口调用策略、错误处理和测试，以及本规格/计划/实施记录。前端依赖优先复用；仅必要的前端依赖变更可连带更新root lockfile。
- 不运行api:generate，不清理、seed或迁移开发库，不把主工作区CommunityPost/0014/seed WIP复制成实施输入或纳入提交。
- 每个已有正式页面按本地Figma节点/组件数据开发，不用图片、截图、目测或页面裁片推导尺寸、样式、布局与动效。
- 应存入数据库的业务内容必须通过现有API取得。固定标题、按钮、提示、静态示例、状态名称及有源依据的样式参数可以在前端定义，不要求全部动态化。
- 页面和内部组件均适应真实窗口、安全区、键盘和文字长度；375×812是参考，不是固定运行时屏幕尺寸。不能整体缩放整页或缩小字号/点击区。
- 适配宽度覆盖320、360、375、390、430pt，并覆盖短/长屏、非零安全区、大字体、键盘打开/关闭；触控目标至少44×44pt。保留portrait设置。
- Mibo的0.3s AFTER_TIMEOUT是原型演示，不是业务推进计时器；只有真实Job/Conversation/事件变化才允许切状态。
- 保留真实鉴权、账号隔离、草稿、幂等键、轮询、401/402/409、失败保留旧交付、收藏/副本等现有能力。
- `/app-gallery`继续默认created；收藏/最近使用保持既有入口。无稿页面不补画或重新布局。
- 缺帖子API标API_UNAVAILABLE；详情500标BACKEND_BLOCKED；不支持源效果标NOT_IMPLEMENTED；缺设备标NOT_RUN。任何一项不能伪装为PASS。
- 不改原Figma参考、旧pixel比较器、mask/阈值，不批准缺失截图基线，不以fixture/export替代真实数据/交付/设备验收。
- 继续使用已有worktree和分支，不在主工作区switch，不创建/删除worktree。各任务顺序实施、独立复核，不让多个实现者同时编辑共享文件。
- 每个Task先独立复核规格符合性，再复核代码质量；重要问题修复并复核后才能进入下一个Task。计划编写阶段只由当前agent自查，不派发实现或review代理。

---

## Workspace, execution order and file map

工作区：`/Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma`；分支：`codex/intellideploy-mobile-figma`。主工作区：`/Users/bytedance/Projects/my/byte-intelli`。

规格/计划已提交在main；实施前仅在既有worktree合入main，记录合入后的基线commit。后端文件因合入上游而更新属于基线同步，不属于本轮修改；最终比较必须使用这份基线及最新main，确保本轮没有后端/API/Web增量。

```bash
git -C /Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma status --short --branch
git -C /Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma merge main
git -C /Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma rev-parse HEAD
```

有未提交文件或merge冲突时先查看具体差异，保留用户内容；不能用reset、checkout覆盖或stash全部。merge完成后在忽略的`.superpowers/sdd/2026-11-13-mobile-front-only/progress.md`记录基线、每任务RED/GREEN/review及缺口。该ledger不代替可提交的源证据和验收记录。

在已进入worktree根的执行会话保存实际基线，后续命令直接读取该文件：

```bash
mkdir -p .superpowers/sdd/2026-11-13-mobile-front-only
git rev-parse HEAD > .superpowers/sdd/2026-11-13-mobile-front-only/baseline.txt
```

所有npm命令从worktree根执行；源提取命令明确进入`frontend/`。每个测试/生成进程使用以下源位置，不把Downloads绝对路径编译入运行时：

```bash
export INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221
npm --workspace frontend test
npm --workspace frontend run typecheck
```

baseline单测的DTO Python检查可设置`INTELLIDEPLOY_DTO_PYTHON`为主工作区已有`.venv/bin/python`；只读使用既有类型，不修改后端。未提供该解释器的两个检查必须明确记录skip。不要为减少skip写新的后端代码。

| Task | 独立交付 | 新文件/关键改动 |
| --- | --- | --- |
| 1 | 26状态源清单、有效动效及独立断言工具 | `design/sourceMotionEvidence.ts`、`scripts/extract-source-motion.mjs`、`tests/figmaSource.ts`、`e2e/sourceAssertions.ts` |
| 2 | 页面与组件响应式计算 | `theme/responsive.ts`、`components/mobile/AppBackground.tsx`、`tests/responsiveLayout.test.ts` |
| 3 | 可取消、尊重减少动态效果的源动效 | `components/mobile/useSourceMotion.ts`、`features/navigation/sourceMotionPolicy.ts`、`tests/sourceMotionPolicy.test.ts` |
| 4 | 源绘制属性保留与效果支持记录 | 现有Figma渲染/提取文件、`design/sourceEffectSupport.ts`、`e2e/mobile-source-effects.spec.ts` |
| 5 | 登录01 | 现有登录/字体/源提取及`mobile-login.spec.ts` |
| 6 | 首页02/29–35 | 现有首页/导航及`mobile-home.spec.ts` |
| 7 | 商店03、榜单40 | 现有store组件/提取及`mobile-store.spec.ts` |
| 8 | Mibo46–55/58及派生业务状态 | 现有Mibo/回复/输入及`mobile-chatbot.spec.ts` |
| 9 | 产品56/57、收藏/最近使用 | 现有products及`mobile-products.spec.ts` |
| 10 | 广场59/60源布局和缺API状态 | 现有community；仅测试用独立组件root和Playwright配置 |
| 11 | 26状态的运行时结果及完整回归 | `e2e/mobile-source-acceptance.spec.ts`、`scripts/summarize-mobile-source-acceptance.mjs`、验收记录 |

任务依赖：1→2→3→4→5→6→7→8→9→10→11。页面任务可复核自己的交付，但最终必须由Task11统一验证完整26状态；任何重要问题回到其所属任务修复。

**26个状态到任务的明确覆盖表：**

| 状态 | 源Frame | 实施任务 |
| --- | --- | --- |
| 登录01 | 119:76618 | 5 |
| 首页02 | 270:26263 | 6 |
| 首页29 | 188:16287 | 6 |
| 首页30 | 188:16759 | 6 |
| 首页31 | 266:21147 | 6 |
| 首页32 | 268:22904 | 6 |
| 首页33 | 268:23238 | 6 |
| 首页34 | 268:23572 | 6 |
| 首页35 | 268:23906 | 6 |
| 商店03 | 270:26597 | 7 |
| 榜单40 | 825:6804 | 7 |
| Mibo46 | 845:3479 | 8 |
| Mibo47 | 846:3544 | 8 |
| Mibo48 | 849:3608 | 8 |
| Mibo49 | 849:3705 | 8 |
| Mibo50 | 849:3794 | 8 |
| Mibo51 | 849:3883 | 8 |
| Mibo52 | 849:3972 | 8 |
| Mibo53 | 852:4061 | 8 |
| Mibo54 | 852:4150 | 8 |
| Mibo55 | 852:4242 | 8 |
| 产品56 | 168:6299 | 9 |
| 产品57 | 380:147 | 9 |
| Mibo58 | 852:4391 | 8 |
| 广场59 | 168:6358 | 10 |
| 广场60 | 825:6452 | 10 |

## Shared signatures used by the tasks

下列签名在对应任务创建，后续任务使用同名、同类型，不各自造另一套适配/动效函数。

```ts
// Task 1: frontend/tests/figmaSource.ts, only imported by tests.
export type SourceMatrix = {
  m00: number; m01: number; m02: number;
  m10: number; m11: number; m12: number;
};
export type SourceBox = {x: number; y: number; width: number; height: number};
export function sourceNode(nodeId: string): Record<string, any>;
export function sourceBox(frameId: string, nodeId: string): SourceBox;

// Task 1: generated runtime sourceMotionEvidence.ts.
export type SourceMotion = {
  nodeId: string;
  interactionId: string;
  event: 'ON_HOVER' | 'ON_PRESS' | 'ON_CLICK' | 'AFTER_TIMEOUT' | 'DRAG';
  navigation: 'NAVIGATE' | 'SWAP_STATE' | 'SCROLL_TO';
  targetNodeId: string | null;
  transition: string | null;
  durationMs: number;
  prototypeDelayMs: number;
  easingType: string | null;
  easingFunction: readonly number[];
};
export function getSourceMotion(
  nodeId: string, event: SourceMotion['event'], targetNodeId?: string,
): SourceMotion | null;

// Task 2: add to existing responsive.ts.
export function fitSourceWidth(
  sourceWidth: number, sourceParentWidth: number, availableWidth: number,
  policy: 'relative' | 'fixed',
): number;
export function bottomAnchor(
  viewportHeight: number, keyboardHeight: number, bottomInset: number,
  visibleHeight: number, bottomGap: number,
): number;

// Task 3: frontend/features/navigation/sourceMotionPolicy.ts.
export function shouldStartSourceTransition(
  motion: SourceMotion, reason: 'interaction' | 'snapshot' | 'prototype-timer',
  previousState: string, nextState: string,
): boolean;
// Task 3: sampler is pure and lives beside the policy, not in the native hook.
export function sampleSourceEasing(motion: SourceMotion, t: number): number;
// Task 3: frontend/components/mobile/useSourceMotion.ts imports that sampler.
export function useSourceMotion(motion: SourceMotion | null): {
  progress: import('react-native').Animated.Value;
  start: () => void;
  cancel: () => void;
};

// Task 4: frontend/design/sourceEffectSupport.ts.
export type EffectSupport = 'PASS' | 'NOT_IMPLEMENTED' | 'NOT_RUN';
export function effectSupport(
  rawEffectType: string, platform: 'web' | 'ios' | 'android',
): EffectSupport;

// Task 1: frontend/e2e/sourceAssertions.ts.
export function installMobileSourceFixtures(page: import('@playwright/test').Page): Promise<void>;
export function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void>;
export function expectTouchTarget(locator: import('@playwright/test').Locator): Promise<void>;
```

`Record<string, any>`只用于读取原始测试数据，不用于放宽运行时API类型。源节点计算不可从当前生成的evidence反向取期望值。

---

### Task 1: Preserve the full source contract and resolve effective motion

**Files:**
- Create: `frontend/tests/figmaSource.ts`
- Create: `frontend/scripts/extract-source-motion.mjs`
- Create: `frontend/design/sourceMotionEvidence.ts`
- Create: `frontend/tests/sourceMotionEvidence.test.ts`
- Create: `frontend/e2e/sourceAssertions.ts`
- Modify: `frontend/design/mobileEvidence.ts`
- Read: 原始Kiwi、移动节点、现有component extractor、`motion-source-evidence.json`审计快照。

**Interfaces:** Consumes原始nodeChanges及blobs；produces共享签名中的sourceNode/sourceBox、SourceMotion/getSourceMotion及E2E断言。源清单继续使用现有mobileEvidence，不手工维护第二份26Frame列表。

- [ ] **Step 1: 同步worktree、记录baseline，写缺失模块RED。** 在新测试直接读取原始document，检查文件夹动作、Mibo原型延时及所有正式Frame引用；不要把93原始记录当独立动作数。

```ts
import {expect, test} from 'vitest';
import {sourceNode} from './figmaSource';
import {getSourceMotion} from '../design/sourceMotionEvidence';
test('folder motion preserves the original action and parameters', () => {
  const raw = sourceNode('280:26962').prototypeInteractions[0].actions[0];
  const motion = getSourceMotion('280:26962', 'ON_CLICK')!;
  expect(motion.targetNodeId).toBe('380:147');
  expect(motion.durationMs).toBeCloseTo(raw.transitionDuration * 1000, 6);
  expect(motion.easingFunction).toEqual(raw.easingFunction);
});
```

- [ ] **Step 2: Run RED.** `npm --workspace frontend test -- sourceMotionEvidence.test.ts`；预期新模块不存在，不把现有GREEN测试当RED。
- [ ] **Step 3: 实现独立源读取及有效动作提取。** sourceBox乘完整父链矩阵再计算四角AABB；处理原始visible/opacity、Symbol/Instance、同一guidPath上的override，按interaction ID替换/删除。SCROLL_TO特殊sentinel保留为null目标和原始记录，不当有效产品路由。转换只改变时间单位，不改动作内容。

```js
// extract-source-motion.mjs: only merge records for the same effective owner/path.
export function mergeInteractions(inherited, own, overrides) {
  const effective = new Map();
  for (const group of [inherited, own, overrides]) {
    for (const value of group) {
      const key = `${value.id.sessionID}:${value.id.localID}`;
      if (value.isDeleted) effective.delete(key);
      else effective.set(key, value);
    }
  }
  return [...effective.values()];
}
```

源生成器导出`extractSourceMotion({designSource, outputPath})`，将effective owner node/path对应的动作生成到runtime TS；临时写入后rename，输出不含Downloads绝对路径。默认输出相对脚本目录定位到`frontend/design/`，避免根目录误写。

`figmaSource.ts`实现独立原始读取和父矩阵，以下代码展示关键完整计算，不能转而import生成的源evidence作为期望：

```ts
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
let nodeIndex: Map<string, Record<string, any>> | undefined;
const guid = (value: {sessionID: number; localID: number}) => `${value.sessionID}:${value.localID}`;
export function sourceNode(nodeId: string): Record<string, any> {
  if (!nodeIndex) {
    const root = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
    if (!root) throw Error('INTELLIDEPLOY_FIGMA_SOURCE is required for source checks');
    const doc = JSON.parse(readFileSync(join(root,'design-data/document.kiwi.json'),'utf8'));
    nodeIndex = new Map(doc.nodeChanges.map((node: Record<string, any>) => [guid(node.guid),node]));
  }
  const node = nodeIndex.get(nodeId);
  if (!node) throw Error(`Missing source node ${nodeId}`);
  return node;
}
const identity = {m00:1,m01:0,m02:0,m10:0,m11:1,m12:0};
function multiply(a: SourceMatrix,b: SourceMatrix): SourceMatrix {
  return {m00:a.m00*b.m00+a.m01*b.m10,m01:a.m00*b.m01+a.m01*b.m11,
    m02:a.m00*b.m02+a.m01*b.m12+a.m02,m10:a.m10*b.m00+a.m11*b.m10,
    m11:a.m10*b.m01+a.m11*b.m11,m12:a.m10*b.m02+a.m11*b.m12+a.m12};
}
export function sourceBox(frameId: string,nodeId: string): SourceBox {
  const leaf = sourceNode(nodeId), chain: SourceMatrix[] = [];
  let current = leaf;
  while (guid(current.guid) !== frameId) {
    chain.unshift(current.transform ?? identity);
    if (!current.parentIndex?.guid) throw Error('Node is outside the source frame');
    current = sourceNode(guid(current.parentIndex.guid));
  }
  const m = chain.reduce(multiply,identity), w = leaf.size.x, h = leaf.size.y;
  const points = [[0,0],[w,0],[0,h],[w,h]].map(([x,y]) =>
    ({x:m.m00*x+m.m01*y+m.m02,y:m.m10*x+m.m11*y+m.m12}));
  const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
  return {x:Math.min(...xs),y:Math.min(...ys),
    width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}
```

这是不含效果扩张的源AABB。遇到mask、祖先透明度或symbol derived path，应另核相应字段，不能把AABB当最终绘制边界。

E2E fixtures复用现有makeVisualApp/visualStorePublications，提供`/auth/me`、现有quota读取和既有apps/jobs/library响应，只有测试模块包含这些样例。`expectTouchTarget`实际检查boundingBox两个维度≥44；`expectNoHorizontalOverflow`检查document滚动宽度，不把被clip的装饰AABB算页面溢出。

```ts
export async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  const {expect} = await import('@playwright/test');
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.viewport);
}
```

- [ ] **Step 4: Run GREEN and determinism.** 单测验证override替换/删除、未知目标、毫秒转换、所有26Frame。生成到两个不同的临时输出，再cmp；不要运行会改基线的旧extractor默认命令。

```bash
npm --workspace frontend test -- sourceMotionEvidence.test.ts mobileDesignExtraction.test.ts
npm --workspace frontend run typecheck
```

确定性检查使用自己的临时目录，从worktree根执行：

```bash
export TASK_MOTION_TMP=$(mktemp -d)
node --input-type=module -e "import {extractSourceMotion} from './frontend/scripts/extract-source-motion.mjs'; import path from 'node:path'; for (const name of ['a.ts','b.ts']) await extractSourceMotion({designSource:process.env.INTELLIDEPLOY_FIGMA_SOURCE,outputPath:path.join(process.env.TASK_MOTION_TMP,name)});"
cmp "$TASK_MOTION_TMP/a.ts" "$TASK_MOTION_TMP/b.ts"
```

- [ ] **Step 5: 独立review。** 检查原始父链/实例继承是否正确、生成文件是否可重建、无运行时源包路径、helpers不写业务数据。重要问题修复后重跑相关GREEN。
- [ ] **Step 6: Scoped commit。** 仅上述新文件及确实修改的mobileEvidence；提交`feat: preserve mobile source motion contracts`。

### Task 2: Make shared layout depend on usable screen space

**Files:**
- Modify: `frontend/theme/responsive.ts`
- Modify: `frontend/components/mobile/AppBackground.tsx`
- Create: `frontend/tests/responsiveLayout.test.ts`
- Create: `frontend/e2e/mobile-responsive-layout.spec.ts`

**Interfaces:** Consumes源参考width及SafeAreaInsets；producesfitSourceWidth/bottomAnchor，保留getMobileLayout现有调用签名。

- [ ] **Step 1: 写独立宽度/短屏/键盘RED。** 检查相对容器能随父宽度增长、FIXED元素窄屏不能溢出、零空间不出负数。

```ts
import {expect, test} from 'vitest';
import {fitSourceWidth, bottomAnchor} from '../theme/responsive';
test('relative container grows while a fixed leaf stays bounded', () => {
  expect(fitSourceWidth(280, 375, 375, 'relative')).toBe(280);
  expect(fitSourceWidth(280, 375, 430, 'relative')).toBeGreaterThan(280);
  expect(fitSourceWidth(38, 375, 20, 'fixed')).toBe(20);
  expect(fitSourceWidth(280, 375, 0, 'relative')).toBe(0);
});
test('composer anchor reacts to the actual keyboard', () => {
  expect(bottomAnchor(812, 0, 0, 54, 29)).toBe(729);
  expect(bottomAnchor(812, 300, 20, 54, 29)).toBe(409);
});
```

- [ ] **Step 2: Run RED。** `npm --workspace frontend test -- responsiveLayout.test.ts`；预期函数不存在。
- [ ] **Step 3: 实现窄小计算函数，并让AppBackground使用真实可用区域。** 参数必须有限且reference width>0；源约束决定relative/fixed，不能所有孩子统一scale。短屏由ScrollView处理，不用绝对y补偿整页。

```ts
export function fitSourceWidth(w: number, parent: number, available: number,
  policy: 'relative' | 'fixed'): number {
  if (![w, parent, available].every(Number.isFinite) || parent <= 0 || w < 0) {
    throw new Error('Invalid source width');
  }
  const usable = Math.max(0, available);
  return Math.min(usable, policy === 'fixed' ? w : usable * w / parent);
}
export function bottomAnchor(h: number, keyboard: number, inset: number,
  visibleHeight: number, gap: number): number {
  return Math.max(0, h - Math.max(0, keyboard) - Math.max(0, inset)
    - visibleHeight - gap);
}
```

不要让子组件二次扣除父容器已经处理的safe area。背景flex填充，最大阅读宽度是明确约束，不能拿321/375固定cap限制所有宽屏卡片。

fitSourceWidth只用于有界布局容器。源中有意超出容器、由mask裁切的光晕/ripple/blur仍使用原几何和局部适配矩阵，不能一律clamp宽度后改变源形状。

- [ ] **Step 4: Run GREEN and runtime RED→GREEN。** 测试五个宽度、height568/812/932和source gutter；新E2E在首页及app-gallery检查实际容器宽度430大于375，窄屏无横向滚动，点击区不缩小。非零inset/keyboard数值先做纯计算测试，真实设备键盘由Task11单独记录。

```bash
npm --workspace frontend test -- responsiveLayout.test.ts mobileDesignSystem.test.ts
npm --workspace frontend run test:e2e:mobile -- mobile-responsive-layout.spec.ts
npm --workspace frontend run typecheck
```

- [ ] **Step 5: 独立review。** 检查局部图形/文字/命中区域没有一起缩放，source375参考仍对齐，横向inset只扣一次。
- [ ] **Step 6: Scoped commit。** 提交上述4文件：`feat: size mobile layouts from usable screen space`。

### Task 3: Implement source motion with cancellation and real-state gating

**Files:**
- Create: `frontend/features/navigation/sourceMotionPolicy.ts`
- Create: `frontend/components/mobile/useSourceMotion.ts`
- Create: `frontend/tests/sourceMotionPolicy.test.ts`
- Create: `frontend/tests/sourceMotionCurve.test.ts`
- Read: Task1 SourceMotion、现有Animated/Reanimated、原始easingFunction/transition字段。

**Interfaces:** ConsumesSourceMotion；producesshouldStartSourceTransition、sampleSourceEasing、useSourceMotion；后续页面提供真实事件或snapshot，不提供自动业务推进timer。

- [ ] **Step 1: 写业务状态不能由原型timer推进的RED。** 时间曲线测试检查起点0/终点1、源spring允许过冲、bezier类型分辨和未知曲线拒绝。

```ts
import {expect, test} from 'vitest';
import {getSourceMotion} from '../design/sourceMotionEvidence';
import {shouldStartSourceTransition} from '../features/navigation/sourceMotionPolicy';
test('prototype timeout cannot advance a live job', () => {
  const source = getSourceMotion('846:3544', 'AFTER_TIMEOUT')!;
  expect(shouldStartSourceTransition(source, 'prototype-timer', 'QUEUED', 'RUNNING')).toBe(false);
  expect(shouldStartSourceTransition(source, 'snapshot', 'QUEUED', 'RUNNING')).toBe(true);
  expect(shouldStartSourceTransition(source, 'snapshot', 'RUNNING', 'RUNNING')).toBe(false);
});
```

- [ ] **Step 2: Run RED。** `npm --workspace frontend test -- sourceMotionPolicy.test.ts sourceMotionCurve.test.ts`；记录真实缺模块/行为失败。
- [ ] **Step 3: 实现policy与一个可取消的hook。** spring tuple必须先按源schema核对mass/stiffness/damping/velocity，不能当cubic-bezier解释。时间采用源durationMs；纯曲线按source tuple解弹簧方程并对有限时长端点归一化，保留过冲；bezier按源四参数求值并反解x。未知/非法参数明确拒绝，不偷偷改统一曲线。

```ts
export function shouldStartSourceTransition(motion: SourceMotion,
  reason: 'interaction' | 'snapshot' | 'prototype-timer',
  previousState: string, nextState: string): boolean {
  if (reason === 'prototype-timer') return false;
  if (reason === 'snapshot') return previousState !== nextState;
  return motion.event !== 'AFTER_TIMEOUT';
}
```

hook以Animated.Value为progress，start先取消旧animation；reducedMotion为true时直接置1。监听Web匹配媒体及原生AccessibilityInfo.isReduceMotionEnabled/reduceMotionChanged，卸载时remove listener/stop动画。用现有Animated.timing搭配sampleSourceEasing，避免同时使用不相容的spring duration和stiffness参数。

```ts
const animation = Animated.timing(progress, {
  toValue: 1,
  duration: motion.durationMs,
  easing: t => sampleSourceEasing(motion, t),
  useNativeDriver: Platform.OS !== 'web',
});
// Store this animation in a ref; cancel calls stop, cleanup cancels and removes listeners.
animation.start();
```

纯curve放在sourceMotionPolicy.ts，避免Vitest为数值测试加载原生模块。如下实现同时使用源时长与源参数，review须先核对tuple语义；不允许仅测试配置字段而不检查函数的中间输出：

```ts
export function sampleSourceEasing(motion: SourceMotion,input: number): number {
  const t = Math.max(0,Math.min(1,input));
  if (t === 0 || t === 1 || motion.durationMs === 0) return t;
  const p = motion.easingFunction;
  if (motion.easingType?.includes('SPRING')) {
    const [mass,k,damping,velocity] = p;
    if (p.length !== 4 || !p.every(Number.isFinite) || mass <= 0 || k <= 0 || damping < 0) {
      throw Error('Unsupported source spring');
    }
    const alpha = damping/(2*mass), omega2 = k/mass;
    const response = (seconds: number): number => {
      let displacement: number;
      const delta = omega2-alpha*alpha;
      if (Math.abs(delta) < 1e-8) {
        displacement = Math.exp(-alpha*seconds)*(1+(alpha-velocity)*seconds);
      } else if (delta > 0) {
        const omega = Math.sqrt(delta);
        displacement = Math.exp(-alpha*seconds)*(Math.cos(omega*seconds)
          +(alpha-velocity)/omega*Math.sin(omega*seconds));
      } else {
        const root = Math.sqrt(-delta), a = -alpha+root, b = -alpha-root;
        const ca = (-velocity-b)/(a-b), cb = 1-ca;
        displacement = ca*Math.exp(a*seconds)+cb*Math.exp(b*seconds);
      }
      return 1-displacement;
    };
    const seconds = motion.durationMs/1000, end = response(seconds);
    if (!Number.isFinite(end) || Math.abs(end) < 1e-8) throw Error('Unresolvable source spring duration');
    return response(t*seconds)/end;
  }
  if (motion.easingType === 'LINEAR') return t;
  if (p.length !== 4 || !p.every(Number.isFinite) || !motion.easingType?.includes('CUBIC')) {
    throw Error('Unsupported source easing');
  }
  const [x1,y1,x2,y2] = p;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) throw Error('Invalid source bezier');
  const value = (u:number,a:number,b:number) => 3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*b+u*u*u;
  let low = 0, high = 1;
  for (let i=0;i<24;i++) {
    const mid = (low+high)/2;
    if (value(mid,x1,x2) < t) low = mid; else high = mid;
  }
  return value((low+high)/2,y1,y2);
}
```

若源schema/实际引擎证明时长归一化规则不同，以源定义修正该小函数及其独立测试，不能以“看起来差不多”保留错误曲线。

hook只控制视觉progress，不修改Job状态、发业务请求或绑定source prototypeDelayMs为自动timer。页面的导航、点击和提交仍由已有逻辑执行一次。

- [ ] **Step 4: Run GREEN。** 单测检查同状态snapshot无动画、快速状态变化取消、未知曲线拒绝及减少动态效果。运行typecheck；真实页面动效接入后的运行时验证在Tasks6/8/9/10逐项进行，不能把本任务纯函数GREEN计作全部动画PASS。
- [ ] **Step 5: 独立review。** 特别复核源schema映射和有限时长curve，禁止凭视觉猜参数；检查cleanup和effect依赖不会重复提交。
- [ ] **Step 6: Scoped commit。** 提交4新文件：`feat: animate mobile source transitions without advancing jobs`。

### Task 4: Preserve paint, mask and effect data instead of silently dropping it

**Files:**
- Modify: `frontend/scripts/extract-mobile-component-evidence.mjs`
- Modify: `frontend/scripts/extract-home-render-evidence.mjs`
- Modify: `frontend/design/figmaComponentEvidence.ts`
- Modify: `frontend/components/mobile/FigmaGeometry.tsx`
- Modify: `frontend/components/mobile/FigmaTree.tsx`
- Modify: `frontend/components/mobile/FigmaEffects.tsx`
- Modify: `frontend/components/mobile/GlassCard.tsx`
- Create: `frontend/design/sourceEffectSupport.ts`
- Create: `frontend/tests/sourceEffects.test.ts`
- Create: `frontend/e2e/mobile-source-effects.spec.ts`

**Interfaces:** Consumesraw node paints/effects/clip and现有geometry；produces同字段完整rawType及effectSupport。其它页面消费者不再依赖把GLASS重命名为BACKGROUND_BLUR的适配假设。

- [ ] **Step 1: 写源效果保留和运行时缺字段RED。** 从270:26624验证GLASS refraction/specular/chromatic数据；从270:26319验证NOISE及顺序；从825:6570验证blur16/padding24；从源mask节点验证角半径/路径。

```ts
test('glass remains glass with its original optical values', () => {
  const raw = sourceNode('270:26624').effects.find((e: any) => e.type === 'GLASS');
  const actual = figmaComponentEvidence.search.surfaceEffects!.find(e => e.rawType === 'GLASS')!;
  expect(actual.type).toBe('GLASS');
  expect(actual.refractionRadius).toBeCloseTo(raw.refractionRadius, 6);
  expect(actual.chromaticAberration).toBeCloseTo(raw.chromaticAberration, 6);
});
```

- [ ] **Step 2: Run RED。** `npm --workspace frontend test -- sourceEffects.test.ts`；E2E针对实际被drop的effects/clip属性先记录失败，不假设纯数据缺口就是渲染失败的全部根因。
- [ ] **Step 3: 扩展现有raw类型并接入实际渲染。** 保留visible/opacity、paint矩阵、effect顺序/作用范围和sourceID；矩形clip取源圆角或真实mask路径；不忽略父组effect/blendMode。对应GlassCard padding从源24取值。

```ts
// Extend the existing effect type without changing public API types.
type RawEffectType = 'DROP_SHADOW' | 'INNER_SHADOW' | 'FOREGROUND_BLUR'
  | 'BACKGROUND_BLUR' | 'GLASS' | 'NOISE';
// Unknown source effect parameters must survive extraction as evidence.
const rawEffects = node.effects.filter((effect: any) => effect.visible !== false);
const clipRadius = node.cornerRadius ?? 0;
// Clip Rect uses clipRadius only when the source mask is actually a rounded rect.
```

确认当前SVG/CSS/原生引擎能表达的每一种效果后实现；GLASS光学参数、noise seed/density和负spread不能靠普通blur/随机纹理冒充。以源小组件做能力验证，不新增无稿产品页。若确实需要新前端依赖，先证明现有栈缺什么和该依赖能做什么，仅改前端package/lock；无证明不加依赖。

`effectSupport`的PASS只表示该平台该类型已具备并有运行时证据；未实现为NOT_IMPLEMENTED，原生尚未运行验证为NOT_RUN。能力/缺口记录在测试/验收元数据，不将技术说明放进普通用户界面。

- [ ] **Step 4: Run GREEN for delivered capabilities。** 完整raw数据/已实现paint/clip/effect测试GREEN；独立记录尚未实现的源效果，不能因此批准整页。生成使用临时outputPath并cmp原始数据字段，更新关联evidence时只提交当前模块的确定性增量。

```bash
npm --workspace frontend test -- sourceEffects.test.ts figmaComponentEvidence.test.ts
npm --workspace frontend run test:e2e:mobile -- mobile-source-effects.spec.ts
npm --workspace frontend run typecheck
```

- [ ] **Step 5: 独立review。** 判断支持表是否由实际证据支撑，是否丢了源效果、放宽了颜色/透明度或改了clip来凑PASS。重要源渲染问题需修复，不列为“近似完成”。
- [ ] **Step 6: Scoped commit。** 提交列出的实际变动文件：`fix: preserve mobile source paint and effect contracts`。ledger保留未实现项供最终验收汇总。

### Task 5: Align login01 and its responsive inputs without inventing motion

**Files:**
- Modify: `frontend/screens/login/LoginScreen.tsx`
- Modify: `frontend/scripts/extract-login-render-evidence.mjs`
- Modify: `frontend/design/loginRenderEvidence.ts`
- Modify: `frontend/theme/fonts.ts`
- Modify: `frontend/theme/typography.ts`
- Modify: `frontend/e2e/mobile-login.spec.ts`
- Modify: `frontend/tests/mobileFonts.test.ts`

**Interfaces:** ConsumesTasks1–4；produces源登录布局和实际注册字体。保留login-account/password/submit/error/register等testID及已有认证调用。

- [ ] **Step 1: 写输入源描边/字体/内边距和五宽度RED。** 期望从119:76686/76688及文本76687/76689读取；不是再写一份47/280/48期望数组。

```ts
test('login input surface preserves the fractional source stroke', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/login');
  const raw = sourceNode('119:76686');
  const stroke = page.getByTestId('login-account-surface').locator('[stroke-width]').first();
  expect(Number(await stroke.getAttribute('stroke-width'))).toBeCloseTo(raw.strokeWeight, 6);
  await expectTouchTarget(page.getByTestId('login-account'));
});
```

- [ ] **Step 2: Run RED。** `npm --workspace frontend run test:e2e:mobile -- mobile-login.spec.ts`，预期缺source surface或实际字体/布局偏差。
- [ ] **Step 3: 源表面与编辑层分开。** CSS在DPR1可能将0.3px边框量化；使用源矢量/round rect表面绘制精确描边，上层TextInput透明、border0，保留完整真实输入。以sourceBox计算375参考位置，其它宽度通过fitSourceWidth和源左右margin约束。

```tsx
<View style={{width: inputWidth, minHeight: source.size.y}}>
  <Svg testID="login-account-surface" width="100%" height={source.size.y}>
    <Rect x={source.strokeWeight / 2} y={source.strokeWeight / 2}
      width={inputWidth - source.strokeWeight} height={source.size.y - source.strokeWeight}
      rx={source.cornerRadius} fill="white" stroke="#A3B2FF" strokeWidth={source.strokeWeight}/>
  </Svg>
  <TextInput testID="login-account" value={account} onChangeText={setAccount}
    style={{position:'absolute',inset:0,borderWidth:0,backgroundColor:'transparent',
      fontFamily:'AlibabaPuHuiTiLight',fontSize:textSource.fontSize,
      paddingLeft:textSource.transform.m02}}/>
</View>
```

该代码中的source/textSource从生成的输入节点字段读取，不在运行时读文件。最终填充/描边颜色及圆角依源paint，不能永久保留示例颜色常量忽略source variable。优先使用源完整strokeGeometry；采用Rect时核对INSIDE描边和实际corner矩阵。

将已有AlibabaPuHuiTi3.0字体文件注册到正确现有别名（45-Light、55-Regular/L3、75-SemiBold、85-Bold等），避免继续用2.0文件冒充3.0；保留其它页面别名兼容。静态字形取源，动态输入检查实际DOMfont解析。正式01无原型入场动效，移除未经源依据的0.58s入场，不增添新循环动画。

- [ ] **Step 4: Run GREEN。** 登录失败保留输入、三方禁用/未开放、隐私/remember现有语义、注册返回next、短屏滚动、五宽度≥44命中、375原坐标及源字体检查。

```bash
npm --workspace frontend test -- mobileFonts.test.ts loginOptions.test.ts authStorage.test.ts
npm --workspace frontend run test:e2e:mobile -- mobile-login.spec.ts
npm --workspace frontend run typecheck
```

- [ ] **Step 5: 独立review。** 不改认证接口/记住我持久策略；没有协议/忘记密码后端就准确保留未开放，不新增无稿流程。
- [ ] **Step 6: Scoped commit。** 提交上述确实变动文件：`fix: align responsive mobile login with source input geometry`。

### Task 6: Align all eight home states and their source interactions

**Files:**
- Modify: `frontend/features/home/MobileHome.tsx`
- Modify: `frontend/features/home/HomeArtwork.tsx`
- Modify: `frontend/features/home/homeContent.ts`
- Modify: `frontend/scripts/extract-home-render-evidence.mjs`
- Modify: `frontend/design/homeRenderEvidence.ts`
- Modify: `frontend/components/mobile/CircleAction.tsx`
- Modify: `frontend/components/mobile/BottomNav.tsx`
- Modify: `frontend/e2e/mobile-home.spec.ts`
- Modify: `frontend/e2e/mobile-source-rendering.spec.ts`

**Interfaces:** ConsumessourceMotion、响应式width及源paint；produces02/29–35实际运行时状态。用户名来自authAPI，不替换成源Oasis。静态curated模板允许保留。

- [ ] **Step 1: 写四卡可伸缩、源起止位置及press/hover RED。** 检查430宽容器大于375、320不溢出、展开前后层有实际插值，hover只处理source variant而不重复导航。

```ts
test('home card width follows screen space and expansion reaches its source state', async ({page}) => {
  await installMobileSourceFixtures(page);
  const widths: number[] = [];
  for (const width of [375,430]) {
    await page.setViewportSize({width,height:812});
    await page.goto('/');
    const shell = page.getByTestId('home-card-store-shell');
    widths.push((await shell.boundingBox())!.width);
    await page.getByTestId('home-card-store').click();
    await expect(page.getByTestId('home-card-store')).toHaveAttribute('aria-expanded','true');
    await expectTouchTarget(page.getByTestId('home-card-store-open'));
    await expectNoHorizontalOverflow(page);
  }
  expect(widths[1]).toBeGreaterThan(widths[0]);
});
```

- [ ] **Step 2: Run RED。** `npm --workspace frontend run test:e2e:mobile -- mobile-home.spec.ts mobile-source-rendering.spec.ts --grep 'home|首页'`；保留不受本任务影响的源测试。
- [ ] **Step 3: 接入每个源状态及动效。** 不再统一用321cap/固定cardCopy宽度；真实card gutter、source text/arrow/装饰跟随容器。使用Animated.progress插值源位置/高度/opacity，展开/收起取消前一次动画；文字和点击区不随局部图形scale。

```tsx
const definition = getSourceMotion(interactionNodeId, event, targetFrameId);
const animation = useSourceMotion(definition);
<Animated.View style={{width: cardWidth,
  transform:[{translateY:animation.progress.interpolate({
    inputRange:[0,1],outputRange:[closedOffset,expandedOffset],
  })}]}}>
  <HomeCardArtwork kind={card.key} expanded={expanded}/>
</Animated.View>
```

所有offset来自对应Frame的源父链，不能把各卡不同y328/401/465/544猜成统一位置。源30的pressed头像和源云状态分别绑定，不把生成文件的默认头像共用为全部variant。保留store/products/community/profile当前业务目标；无个人详情/帖子API的动态统计不填示例，profile原文字层级与实际可用入口准确对应。

- [ ] **Step 4: Run GREEN及实际时间行为。** 使用Playwright clock在页面加载后控制动画时间，检查start/中间/结束boundingBox和cancel；真实点击业务导航只发生一次。reducedMotion下直接到目标，悬停不会自动提交。复核全部8个Frame以及五宽度。

```bash
npm --workspace frontend test -- homeContent.test.ts mobileNavigation.test.ts sourceMotionPolicy.test.ts
npm --workspace frontend run test:e2e:mobile -- mobile-home.spec.ts mobile-source-rendering.spec.ts --grep 'home|首页'
npm --workspace frontend run typecheck
```

- [ ] **Step 5: 独立review。** 对比源props/实例事件覆盖/实际绘制顺序，检查当前用户名变化和静态示例身份，确认没有将帖子/收藏数写到JS。
- [ ] **Step 6: Scoped commit。** 提交所列变动文件：`feat: align responsive home states and source interactions`。

### Task 7: Align store03 and ranking40 with unchanged Publication DTOs

**Files:**
- Modify: `frontend/features/store/StoreScreen.tsx`
- Modify: `frontend/features/store/StoreRankingScreen.tsx`
- Modify: `frontend/features/store/PublicationCarousel.tsx`
- Modify: `frontend/features/store/PublicationCard.tsx`
- Modify: `frontend/features/store/publicationViewModel.ts`
- Modify: `frontend/scripts/extract-store-card-render-evidence.mjs`
- Modify: `frontend/scripts/extract-ranking-render-evidence.mjs`
- Modify: `frontend/design/storeCardRenderEvidence.ts`
- Modify: `frontend/design/rankingRenderEvidence.ts`
- Modify: `frontend/e2e/mobile-store.spec.ts`

**Interfaces:** Consumes既有PublicationResponse、source sizing/paint/motion；produces响应式搜索、真实轮播、榜单。不增加rating/category/can_copy/external_url等不存在的契约。

- [ ] **Step 1: 写源搜索表面、轮播伸缩与真实数据RED。** 375参考可见搜索295×36，独立≥44输入命中；四条不可用数据仍不可用，缺preview不冒充Pawzzle真实预览。

```ts
test('store search surface and hit area are independent', async ({page}) => {
  await installMobileSourceFixtures(page); await page.goto('/store');
  const raw = sourceNode('270:26624');
  const surface = (await page.getByTestId('store-search-surface').boundingBox())!;
  expect(surface.width).toBeCloseTo(raw.size.x,1);
  expect(surface.height).toBeCloseTo(raw.size.y,1);
  await expectTouchTarget(page.getByTestId('store-search'));
});
```

- [ ] **Step 2: Run RED。** `npm --workspace frontend run test:e2e:mobile -- mobile-store.spec.ts`；至少源尺寸或new width变化失败。
- [ ] **Step 3: 替换平面手写cap/偏移为源约束，分开搜索绘制与输入target。** 卡片前/后层用各自源surface与matrix，不用空白View冒充完整背卡。轮播interval来自实际cardWidth+源gap，resize后保持当前选中ID。

```ts
const usable = viewport.width - insets.left - insets.right;
const carouselWidth = fitSourceWidth(sourceCarousel.width, 375, usable, 'relative');
const cardWidth = fitSourceWidth(sourceCard.width, sourceCarousel.width, carouselWidth, 'relative');
const interval = cardWidth + sourceGap;
// Source sibling transforms define back-card displacement/rotation; use each layer's real data.
```

保持当前按updated_at的真实排序说明及本地“仅已加载数据”搜索边界；原数据无评分/热度/奖项时保留缺口，不挪creator去伪装评分，不显示获取成功。按钮label可静态定义；真实名称/summary/creator/available/favorite读现有API。既有分类/过滤没有接口时不新增API或声称全库分类搜索。

- [ ] **Step 4: Run GREEN。** 五宽度、滑动/resize/分页去重/收藏登录返回/错误重试/preview失败，榜单四条真实不可用夹具和长名称。检查完整03/40各自的几何/效果状态，不靠同一个卡组件存在通过。

```bash
npm --workspace frontend test -- publicationViewModel.test.ts mobileNavigation.test.ts
npm --workspace frontend run test:e2e:mobile -- mobile-store.spec.ts
npm --workspace frontend run typecheck
```

- [ ] **Step 5: 独立review。** 不改共享types，未通过复制/托管判断不得由前端推断；未实现GLASS和缺图片字段准确保留。
- [ ] **Step 6: Scoped commit。** 提交所列实际增量：`fix: align store surfaces without changing publication contracts`。

### Task 8: Align eleven Mibo states, adaptive composer and actual replies

**Files:**
- Modify: `frontend/components/mobile/MiboStage.tsx`
- Modify: `frontend/components/mobile/ChatComposer.tsx`
- Modify: `frontend/components/mobile/JobProgress.tsx`
- Modify: `frontend/features/chatbot/CreateWorkspaceView.tsx`
- Modify: `frontend/features/chatbot/AppConversationView.tsx`
- Modify: `frontend/features/chatbot/replyLayout.ts`
- Modify: `frontend/screens/app-detail/AppDetailScreen.tsx`
- Modify: `frontend/scripts/extract-mibo-render-evidence.mjs`
- Modify: `frontend/design/miboRenderEvidence.ts`
- Modify: `frontend/e2e/mobile-chatbot.spec.ts`
- Modify: `frontend/e2e/mobile-source-rendering.spec.ts`
- Modify: `frontend/tests/replyLayout.test.ts`

**Interfaces:** Consumes原有getJobVisualState/subscribeJob与SourceMotion；produces46–55/58、真实长回复/键盘布局。Job55测试沿用当前合法RUNNING/building夹具，不把源Frame名字改成后端phase。

- [ ] **Step 1: 写未变化Job不会定时完成、长正文和重复question RED。** 真实question与最后assistant同内容时只在首屏出现一次，完整conversation历史仍保留。发送键不因画面timer改变。

```ts
test('prototype delays do not change a queued job', async ({page}) => {
  await installMobileSourceFixtures(page);
  const app = makeVisualApp(48,'QUEUED','clarifying');
  await page.route('**/api/apps/app',r=>r.fulfill({json:app}));
  await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));
  await page.goto('/app-detail/app'); await page.clock.install();
  await page.clock.runFor(10000);
  await expect(page.getByTestId('job-status')).toHaveText('任务已提交');
  await expect(page.getByTestId('open-app')).toHaveCount(0);
});
```

上述测试为防退化可能已GREEN，不能当新RED；新增RED要针对当前375 artCanvas、真实重复回复、输入区窄屏重叠和源转场缺失。

- [ ] **Step 2: Run RED。** `npm --workspace frontend run test:e2e:mobile -- mobile-chatbot.spec.ts mobile-source-rendering.spec.ts --grep 'Mibo|reply|composer|对话'`，记录真正失败的用例。
- [ ] **Step 3: 局部画布响应、底部锚定及状态动效接入。** 移除固定375视觉画布对窄屏的裁切；各节点按父容器与源UV约束布局，保持局部图形比例和字形尺寸。输入区按实际viewport/keyboard/bottomInset锚定，长回复可滚动，不推低到输入框背后。

```ts
const nextKey = `${job.status}:${job.phase}`;
if (motion && shouldStartSourceTransition(motion,'snapshot',previousKey,nextKey)) {
  animation.start();
}
// Keep subscribeJob as state authority; no timeout mutates nextKey/job.
const top = bottomAnchor(viewport.height,keyboardHeight,insets.bottom,composerHeight,sourceBottomGap);
```

展示去重只处理question与最新assistant同源重复，不改任何消息字节。保留FEFF、CRLF、空行及完整历史；needsDetailedReplyLayout基于真实内容长度/换行，不根据phase制造依赖列表。未知phase维持“正在处理需求”，失败保留旧交付由原DeliveryCard决定。

- [ ] **Step 4: Run GREEN。** 完整11Frame及派生状态，source图片UV/透明度/矩阵；Job真实变化触发源转场，中途取消/后台/快速新状态不回跳；输入20,000字限制、402/409恢复、draft/key/401均不退化。

```bash
npm --workspace frontend test -- replyLayout.test.ts jobVisualState.test.ts jobPolling.test.ts workspaceStorage.test.ts
npm --workspace frontend run test:e2e:mobile -- mobile-chatbot.spec.ts mobile-source-rendering.spec.ts workspace.spec.ts
npm --workspace frontend run typecheck
```

- [ ] **Step 5: 独立review。** 核对四个500详情仍明确失败/重试/返回；禁止放宽DTO、使用数据库快照当生产fallback或发明外部打开字段。
- [ ] **Step 6: Scoped commit。** 提交所列前端实际增量：`feat: align Mibo motion and responsive conversation flow`。

### Task 9: Align responsive product folders and their open/close springs

**Files:**
- Modify: `frontend/features/products/ProductFolder.tsx`
- Modify: `frontend/features/products/ProductList.tsx`
- Modify: `frontend/features/products/LibraryScreen.tsx`
- Modify: `frontend/screens/app-gallery/AppGalleryScreen.tsx`
- Modify: `frontend/features/products/extractProductFolderEvidence.mjs`
- Modify: `frontend/features/products/productFolderEvidence.ts`
- Modify: `frontend/e2e/mobile-products.spec.ts`

**Interfaces:** Consumessource slots/matrices、fitSourceWidth、useSourceMotion；produces56/57及当前created/copies/favorites/recent语义不变。

- [ ] **Step 1: 写伸缩、开合中间状态和真实列表RED。** 375参考检查前后片260×185及m00/m10，实际壳不固定280；五个槽保留原ID/顺序，不插假Apps。动态页面数据两账号隔离。

```ts
test('folder open uses source spring and retains actual rows', async ({page}) => {
  await installMobileSourceFixtures(page); await page.goto('/app-gallery');
  const folder = page.getByTestId('product-folder-created');
  const before = (await folder.boundingBox())!;
  await page.clock.install(); await folder.click();
  const motion = getSourceMotion('280:26962','ON_CLICK')!;
  await page.clock.runFor(Math.floor(motion.durationMs / 2));
  const during = (await folder.boundingBox())!;
  expect(during.height).not.toBe(before.height);
  await page.clock.runFor(Math.ceil(motion.durationMs));
  await expect(folder).toHaveAttribute('aria-expanded','true');
});
```

- [ ] **Step 2: Run RED。** `npm --workspace frontend run test:e2e:mobile -- mobile-products.spec.ts`；当前立即expanded可能已改变高度，应另外检查中间几何不等于最终几何，从而形成真实缺插值RED。
- [ ] **Step 3: 接源矩阵/槽位并动画开合。** SVG容器局部宽度基于源父约束；预览slots、front/back矩阵和blur裁切坐标在同一局部空间中。点击区域至少44，文字列表不跟整个SVGscale。

```tsx
const motion = getSourceMotion(expanded ? '380:196' : '280:26962','ON_CLICK');
const animation = useSourceMotion(motion);
const width = fitSourceWidth(source.closed.size.width,sourceFrameWidth,usableWidth,'relative');
<Animated.View style={{width,minHeight:44}}>
  <Svg width="100%" height={localArtHeight} viewBox={localViewBox}>
    <G transform={interpolatedSourceMatrix}>{folderShapes}</G>
  </Svg>
</Animated.View>
```

沿用原created默认，保留分类菜单、listOpen、分页、empty/网络错误和public detail目标。前后片插值、opacity和paint按源；GLASS不能因只是模糊就标支持。无真实icon时准确占位，不放设计示例Apps冒充收藏。

- [ ] **Step 4: Run GREEN。** 五宽度、五个以上产品分页、空收藏、开合中断/连续点击/resize、reducedMotion、列表完整文本与account切换。不执行seed/favorite写库来填页面。

```bash
npm --workspace frontend test -- productViewModel.test.ts mobileNavigation.test.ts
npm --workspace frontend run test:e2e:mobile -- mobile-products.spec.ts
npm --workspace frontend run typecheck
```

- [ ] **Step 5: 独立review。** source矩阵只应用一次，背景blur和clip不过度缩放；动态数真实，不把收藏空态当数据失败。
- [ ] **Step 6: Scoped commit。** 提交所列实际变动文件：`feat: animate responsive source product folders`。

### Task 10: Render community59/60 honestly when the post API is absent

**Files:**
- Modify: `frontend/screens/community/CommunityScreen.tsx`
- Modify: `frontend/features/community/DiscoveryCard.tsx`
- Modify: `frontend/features/community/FeaturedPublication.tsx`
- Modify: `frontend/features/community/CommunityBackground.tsx`
- Modify: `frontend/features/community/communityViewModel.ts`
- Modify: `frontend/features/community/extractCommunityEvidence.mjs`
- Modify: `frontend/features/community/communityEvidence.ts`
- Modify: `frontend/e2e/mobile-community.spec.ts`
- Modify: `frontend/e2e/community.spec.ts`
- Modify: `frontend/e2e/community-cross-client.spec.ts`
- Create: `frontend/app.config.js`
- Create: `frontend/e2e/component-fixture-app/_layout.tsx`
- Create: `frontend/e2e/component-fixture-app/index.tsx`
- Create: `frontend/playwright.component.config.ts`
- Create: `frontend/e2e/components/community-source.spec.ts`
- Create: `frontend/tests/componentFixtureConfig.test.ts`

**Interfaces:** Production仍只使用现有契约；新增仅为前端view的nullable作者/时间/正文props，不是Post API DTO。社区runtime无帖子API时显示真实缺内容状态。独立test root用于验证长正文/作者/拖动的纯展示组件，不新增产品页面或请求路径。

- [ ] **Step 1: 写“Publication不能冒充帖子”RED和组件测试root隔离检查。** runtime不出现四条公开应用的“帖子作者/时间/正文”；现有公开应用浏览/副本流程继续从store进入community/[id]。组件fixture仅在显式测试环境启用。

```ts
test('community states the unavailable post content instead of inventing a feed', async ({page}) => {
  await installMobileSourceFixtures(page); await page.goto('/community');
  await expect(page.getByTestId('community-content-unavailable')).toBeVisible();
  await expect(page.getByTestId(/^discovery-publication-/)).toHaveCount(0);
  await expect(page.getByText(/\d+分钟前|\d+\s*赞|TOP\s*1/)).toHaveCount(0);
});
```

- [ ] **Step 2: Run RED。** `npm --workspace frontend run test:e2e:mobile -- mobile-community.spec.ts`；当前runtimePublication发现流形成真实RED。
- [ ] **Step 3: 源卡片组件与数据能力分离，移除生产Publication→帖子映射。** nullable author/time/body使源slots和装饰可精确绘制；缺内容用既有EmptyState风格的静态提示，不显示API技术说明。源时间位置不能放creator，源正文位置不能默认“查看应用介绍”冒充帖子。

```tsx
type CommunityCardCopy = {author: string | null; time: string | null; body: string | null};
// This is a view prop type; there is no new endpoint or public DTO.
{copy.author !== null && <Text style={sourceAuthorStyle}>{copy.author}</Text>}
{copy.time !== null && <Text style={sourceTimeStyle}>{copy.time}</Text>}
{copy.body !== null && <ScrollView style={sourceBodyViewport}>
  <Text style={sourceBodyStyle}>{copy.body}</Text>
</ScrollView>}
```

59/60拖动控制源rail位移与spring/slide，仅移动现有源装饰/内容槽，不创建假帖子记录。无头像/统计/精选/代码片段就保留缺口，不把源示例Li Wei、错误字符串或+24k填到runtime。

为实际组件测试使用Expo已支持的router plugin root配置，不用不存在的web export:embed参数。新增app.config.js默认完全保留app.json配置；只有`INTELLIDEPLOY_COMPONENT_FIXTURE=1`才把Expo Router root切到`e2e/component-fixture-app`。原生产app树和所有正常启动路径不受影响。

```js
// frontend/app.config.js
const original = require('./app.json').expo;
module.exports = () => ({
  ...original,
  plugins: original.plugins.map(plugin =>
    plugin === 'expo-router' && process.env.INTELLIDEPLOY_COMPONENT_FIXTURE === '1'
      ? ['expo-router', {root: './e2e/component-fixture-app'}] : plugin),
});
```

测试root_layout注册已有字体和SafeAreaProvider；index仅导入本任务展示组件，使用明确标记为component-fixture的作者/时间/长正文，不调用API。component Playwright config只匹配`e2e/components/`，baseURL8187、workers1，启动命令`npm run web -- --port 8187`，env设置上述fixture flag。component fixture不得被生产页面import。

```ts
// playwright.component.config.ts webServer fragment.
webServer: {
  command: 'npm run web -- --port 8187',
  env: {CI:'1',INTELLIDEPLOY_COMPONENT_FIXTURE:'1'},
  url: 'http://127.0.0.1:8187', reuseExistingServer:false,
},
```

- [ ] **Step 4: Run GREEN。** 测试root验证长正文完整、作者与时间独立槽、375源位置、五宽度、59/60拖动方向/时间/取消/reducedMotion；正常root确认无fixture页，runtime准确缺内容。PUBLIC应用的旧浏览/复制检查移到store入口，不能删掉这些功能覆盖。

```bash
npm --workspace frontend test -- componentFixtureConfig.test.ts communityViewModel.test.ts
npm --workspace frontend run test:e2e:mobile -- mobile-community.spec.ts community.spec.ts
npm --workspace frontend exec -- playwright test --config playwright.component.config.ts
npm --workspace frontend run typecheck
```

以上两个Expo测试配置顺序运行，防止同项目缓存/typed-route生成互相干扰。组件fixture验证不计六条真实帖子已接入。

- [ ] **Step 5: 独立review。** 严查新app.config默认与原解析配置一致、测试root生产不可达、没有新API请求/业务对象/数据库内容进入runtime。缺帖子绑定最终仍API_UNAVAILABLE。
- [ ] **Step 6: Scoped commit。** 提交上述实际变动文件：`fix: preserve source community layout without fabricated posts`。

### Task 11: Verify and record all 26 source states without widening scope

**Files:**
- Create: `frontend/e2e/mobile-source-acceptance.spec.ts`
- Create: `frontend/scripts/summarize-mobile-source-acceptance.mjs`
- Create: `frontend/tests/sourceAcceptanceReport.test.ts`
- Create: `docs/superpowers/handoffs/2026-11-13-mobile-frontend-source-acceptance.md`
- Generated only: `frontend/artifacts/source-acceptance/records.json`及失败trace/检查数据，不加入图片开发材料。
- Modify only if needed: 前述各task对应的前端测试，不能改旧比较器/基线。

**Interfaces:** Consumes26Frame清单和运行时结果；produces每状态六个方面的准确记录。记录类型定义如下，不从页面数或单测总数推断通过。

```ts
type CheckStatus = 'PASS' | 'FAIL' | 'NOT_RUN' | 'NOT_IMPLEMENTED'
  | 'API_UNAVAILABLE' | 'BACKEND_BLOCKED';
type SourceAcceptanceRecord = {
  frameId: string;
  sourceSha256: string;
  dataEvidence: 'existing-api' | 'readonly-api-snapshot' | 'fixture' | 'unavailable';
  checks: Record<'STRUCTURE'|'RESPONSIVE_GEOMETRY'|'TEXT_STYLE'|'PAINT_EFFECT'
    |'MOTION_INTERACTION'|'DATA_BINDING', CheckStatus>;
  evidence: string[];
};
```

- [ ] **Step 1: 写汇总保守性的RED及26Frame运行时收集。** 未运行动效、缺数据或不支持效果不能计算overall PASS；缺Frame、重复Frame或source hash不一致必须拒绝报告。

```ts
test('missing effect support cannot become strict acceptance', () => {
  const record = {frameId:'119:76618',sourceSha256:'fixture-source',
    dataEvidence:'fixture',
    checks:{STRUCTURE:'PASS',RESPONSIVE_GEOMETRY:'PASS',TEXT_STYLE:'PASS',
      PAINT_EFFECT:'NOT_IMPLEMENTED',MOTION_INTERACTION:'NOT_RUN',DATA_BINDING:'PASS'},
    evidence:['component fixture only']} as const;
  expect(isStrictSourcePass(record)).toBe(false);
});
```

`summarize-mobile-source-acceptance.mjs`导出`isStrictSourcePass(record)`及`summarizeSourceAcceptance(records, expectedFrames, expectedSourceHash)`，后者返回`overall`和原始缺口，不丢字段。expectedSourceHash由实际设计消息文件哈希计算；单测可传明确fixture hash，仅测汇总，不作为真实报告hash。

- [ ] **Step 2: Run RED。** `npm --workspace frontend test -- sourceAcceptanceReport.test.ts`；预期缺汇总器；新E2E先捕获仍未满足的源断言，不直接填PASS。
- [ ] **Step 3: 实现实际状态采集及保守汇总。** 26Frame通过原已有visual fixtures创建UI状态、实际点击/hover/press/scroll进入对应状态，但不调用旧toHaveScreenshot批准基线。expected直接读取原始Kiwi；记录实际尺寸/paint/字体/动效/数据事件。广场组件fixture补59/60展示验证，其runtime数据绑定仍API_UNAVAILABLE；四个实际500为BACKEND_BLOCKED。

```js
export function isStrictSourcePass(record) {
  return Object.values(record.checks).length === 6
    && Object.values(record.checks).every(status => status === 'PASS')
    && ['existing-api','readonly-api-snapshot'].includes(record.dataEvidence);
}
export function summarizeSourceAcceptance(records, expectedFrames, expectedSourceHash) {
  const ids = records.map(record => record.frameId);
  if (ids.length !== expectedFrames.length || new Set(ids).size !== ids.length
      || expectedFrames.some(id => !ids.includes(id))) throw Error('Incomplete source states');
  if (!/^[0-9a-f]{64}$/.test(expectedSourceHash)
      || records.some(record => record.sourceSha256 !== expectedSourceHash)) throw Error('Mixed or invalid source versions');
  return {overall: records.every(isStrictSourcePass) ? 'PASS' : 'INCOMPLETE',records};
}
```

- [ ] **Step 4: 完整验证。** 在worktree按下面顺序执行，不并行清同一测试服务/缓存/DB。原生设备已有条件才做对应交互，否则NOT_RUN。测试用DB仅选择已存在的本地隔离测试库，不能把默认URL改成intellideploy_dev。

```bash
npm --workspace frontend test
npm --workspace frontend run typecheck
npm --workspace frontend run test:e2e:mobile -- --grep-invert @visual
npm --workspace frontend exec -- playwright test --config playwright.component.config.ts
npm --workspace frontend run test:e2e:mobile -- mobile-source-acceptance.spec.ts
npm --workspace frontend exec -- expo export --platform web --output-dir .expo/source-web-export
npm --workspace frontend exec -- expo export --platform ios --output-dir .expo/source-ios-export
npm --workspace frontend exec -- expo export --platform android --output-dir .expo/source-android-export
npm --workspace frontend run typecheck
git diff --check
```

标准持久/跨端功能套件只在已具备根配置所需Python/PostgreSQL/Web测试服务时运行：

```bash
npm --workspace frontend exec -- playwright test e2e/cross-client.spec.ts e2e/community-cross-client.spec.ts e2e/payment-cross-client.spec.ts
```

worktree缺`.venv`时可为测试配置使用主工作区既有解释器路径或创建忽略的本地symlink，不改后端文件，不安装替代backend库。测试库必须通过既有resolveTestDatabaseUrl校验；服务不可用就报告NOT_RUN，不借此迁移开发库。

- [ ] **Step 5: 独立全分支review及范围扫描。** 用recorded baseline检查`backend web packages/api-client infra tests/phase1`无本轮增量，复核所有26Frame/五宽度、API状态、原生缺口、reduced motion以及没有丢失功能覆盖。

```bash
git diff --name-only "$(cat .superpowers/sdd/2026-11-13-mobile-front-only/baseline.txt)" HEAD -- backend web packages/api-client infra tests/phase1
git diff --check
```

读取任务开始保存的实际commit，不使用变动中的main作为最初基线。全分支review发现重要问题回到对应task按RED/GREEN修复，不仅改报告。

- [ ] **Step 6: 提交验收记录并准备安全集成。** 文档分别列出已实现/已验证/接口阻塞/效果未实现/设备未运行；旧pixel10PASS/16FAIL保持独立历史，不更改其数值。本轮无法做到全严格通过时，明确列出剩余项，不能写“移动端全部完成”。提交`test: record mobile frontend source acceptance`，只包含新测试/汇总器/验收文档。

最终合入main前先在开发worktree合入最新main，并重跑受新提交影响的验证；查看主工作区WIP重叠，不能强制覆盖。已有明确合并授权且满足验证/用户WIP保护条件时才按该授权集成；有真实接口/设备/源效果缺口就保留准确状态和可审查分支，不把未完成状态转为PASS。

## Spec coverage and final acceptance checklist

- [ ] 26个Frame逐页有原始节点依据及实际运行时记录，不只是旧16个失败项。
- [ ] 五宽度、短长屏、安全区、长文字及键盘分别验证；字体/触控不跟整页scale。
- [ ] 源paint/effect/mask/visible/opacity/层级没有静默丢失；GLASS/NOISE未实现准确记缺口。
- [ ] hover/press/click/drag、Symbol覆盖、spring/easing、cancel/reduced motion及真实Job驱动均有验证。
- [ ] 现有API数据/鉴权/账号/草稿/key/401/402/409/收藏副本等功能不退化。
- [ ] 无新后端/API/数据库/共享契约/Web修改；无库内业务记录写入前端。
- [ ] 广场六帖API_UNAVAILABLE、四详情BACKEND_BLOCKED、原生NOT_RUN等未被fixture/export或源常量自证替代。
- [ ] 仅测试component root生产不可达，原配置默认结果不变，fixtures不计真实业务验收。
- [ ] 原Figma参考/比较器/阈值/截图基线未修改；没有使用图片推导实施参数。
- [ ] scoped commits、独立review、前端checks和最终安全集成条件明确记录。

## Execution handoff

计划编写完成后不自动执行产品代码。执行可选：

1. Subagent-driven：每任务一个新实现者，两阶段独立review，重要问题回到该任务修复，顺序执行共享文件。
2. Inline：使用executing-plans在当前会话按任务执行，在同样的RED/GREEN和review检查点交付。

无论哪种方式，先读已确认规格和本计划，再按既有worktree、仅前端范围和真实验收边界执行。
