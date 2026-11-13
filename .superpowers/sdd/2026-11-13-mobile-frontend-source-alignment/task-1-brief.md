### Task 1: Preserve the full source contract and resolve effective motion

**Files:**
- Create: `frontend/tests/figmaSource.ts`
- Create: `frontend/scripts/extract-source-motion.mjs`
- Create: `frontend/design/sourceMotionEvidence.ts`
- Create: `frontend/tests/sourceMotionEvidence.test.ts`
- Create: `frontend/e2e/sourceAssertions.ts`
- Read: `frontend/design/mobileEvidence.ts`（保留现有完整26状态单一manifest；生成器直接消费，不为满足file list新增无用导出或装饰性产品改动。）
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
- [ ] **Step 6: Scoped commit。** 仅上述新文件及必要的本地计划记录校正；mobileEvidence作为现有单一manifest读取并保持内容不变。提交`feat: preserve mobile source motion contracts`。

