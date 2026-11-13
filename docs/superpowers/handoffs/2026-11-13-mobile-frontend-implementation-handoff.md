# 移动端仅前端实施交接

日期：2026-11-13。状态：规格已由用户确认，实施计划已完成；本轮Task1–11尚未开始产品代码实施。

本交接用于新对话直接执行既有计划，不重新做需求探索，不恢复旧Task4现场，也不重开后端/API设计。

执行范围为从Task1开始连续实施到Task11；当前没有完成其中任何一个实施任务。

## 1. 新对话先读这些文件

在主工作区读取，使用绝对路径，避免既有worktree尚未合入新文档：

1. `/Users/bytedance/Projects/my/byte-intelli/docs/superpowers/handoffs/2026-11-13-mobile-frontend-implementation-handoff.md`
2. `/Users/bytedance/Projects/my/byte-intelli/docs/superpowers/specs/2026-11-13-mobile-figma-data-alignment-design.md`
3. `/Users/bytedance/Projects/my/byte-intelli/docs/superpowers/plans/2026-11-13-mobile-frontend-source-alignment.md`
4. `/Users/bytedance/Projects/my/byte-intelli/artifacts/audits/mobile-figma-data-2026-11-13/README.md`

第2、3项是执行依据；第4项保留审计快照及旧建议，涉及后端修改的部分已经撤出本轮范围。若旧交接、旧follow-up计划、审计建议与本交接/已确认规格冲突，以最新用户要求和仅前端规格为准。

可直接粘贴的完整启动prompt另存：

`docs/superpowers/handoffs/2026-11-13-mobile-frontend-execution-prompt.md`

## 2. 用户已确认的约束

**只改前端。** 不改后端代码、API路由/请求/返回契约、数据库/迁移、共享api-client契约、Web客户端、部署、生成、计费规则。不要运行api:generate，不为了让界面有内容而seed开发库或扩大后端DTO。

**每个已有正式页面严格依Figma数据开发。** 第一来源是完整Kiwi节点、Symbol/Instance、组件覆盖、变量、几何blob、paint/effect和原型事件；不是页面PNG、PDF、截图或目测。图片不能用于推导大小、布局、样式、动效，也不能以页面裁片代替组件。原始IMAGE填充节点可依hash、UV和mask使用对应原始素材，这不允许把整页图片当UI。

**页面及里面的组件都自适应。** 375×812只是设计参考。真实布局读取窗口、SafeAreaInsets、键盘、父容器和文字长度。卡片/文件夹/轮播/输入区按源约束伸缩，文字自然换行，插画保持局部比例；不整体scale整页，不缩小字号或44×44pt点击目标。覆盖320/360/375/390/430pt、短/长屏、非零inset、大字体和键盘。

**不硬编码数据库业务内容。** 用户明确允许固定UI标题、按钮、提示、空态/错误文案、明确的静态示例、状态名称、路由和有源依据的样式常量。禁止把实际用户/应用/帖子/统计/收藏/额度/任务结果等业务记录写死在前端。不要把这个要求扩展为“全部样式和文案必须动态配置”。

**动效也依源数据。** 按event、target、duration、easing/spring、实例覆盖和起止属性实现，验证触发、取消、恢复和reduced-motion。Mibo的AFTER_TIMEOUT是设计演示，不能按计时推进真实Job、伪造依赖/百分比或自动转成SUCCEEDED。

**只做已有正式设计范围。** 26状态：登录01；首页02/29–35；商店03/榜单40；Mibo46–55/58；产品56/57；广场59/60。其它34个PDF索引不自动升格为正式页；无稿注册、额度、独立详情/个人页不补画或重做布局。

**业务语义保持已确认版本。** `/app-gallery`继续默认created，收藏/最近使用走已有入口。此前建议改默认收藏已撤回。保留认证、账号隔离、SecureStore、草稿/key、轮询、401/402/409、失败保留旧交付和现有收藏/副本能力。

## 3. 工作区与Git快照

主工作区：`/Users/bytedance/Projects/my/byte-intelli`。

开发worktree：`/Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma`。

分支：`codex/intellideploy-mobile-figma`。

写交接前实际检查结果：

- main HEAD=`bd11a1d`，之后会包含本次交接提交，后续也可能继续变化；不要把该快照当永久最新版本。
- worktree HEAD=`73eb4de`，工作树干净。
- 当时main有54个worktree尚未包含的提交；新对话必须重新查询。
- 本轮规格及计划提交：`570b109`初稿；`82a5a7a`仅前端/自适应/动效修订；`687db27`完整实施计划及规格确认状态。本次交接另统一了ledger路径，不改变实施内容或产品代码。

主工作区已有用户WIP，不能纳入本轮、覆盖或移走：

```text
M backend/alembic/env.py
M backend/app/community/models.py
?? backend/alembic/versions/0014_community_posts.py
?? scripts/seed_development_content.py
?? tests/phase1/test_development_content_seed.py
```

这不是工作树必须clean才能处理的障碍：开发在既有worktree，主工作区WIP保留。其它对话可能继续改main，进入执行时和最终集成时都需重新检查。

不得在主工作区git switch，不创建/删除worktree，不stash全部，不reset或checkout覆盖。旧交接中的“Task4三文件未提交”“main只有一个字体提交”等已过时；按新对话实际git状态判断。

## 4. 启动及本轮ledger

先读取主工作区文档，接着把工具workdir设为既有开发worktree。若当前平台有切换工作区工具，只验证/进入该既有worktree，不创建新的。

```bash
git status --short --branch
git log -1 --oneline
git worktree list
git merge main
```

这些命令必须在开发worktree执行。merge冲突依实际差异解决，保留最新main后端/算法/支付/字体，不把基线同步误报成自己修改后端。

本轮专属workspace统一为当前subagent-driven技能的plan-basename路径：

```text
.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/
  progress.md
  baseline.txt
  task briefs / implementation reports / review packages
```

执行技能`scripts/sdd-workspace PLAN_FILE`后使用其实际输出。ledger第一行必须标明本计划身份：

完整ledger路径：`.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/progress.md`。

```text
# SDD ledger — plan: docs/superpowers/plans/2026-11-13-mobile-frontend-source-alignment.md
```

本次整理已将计划中的旧临时别名`2026-11-13-mobile-front-only`统一到上述路径，避免并行维护两份进度。不要读取或写入2026-11-11旧移动Figma计划的ledger来判定本轮完成状态。

如果本轮ledger已存在，核对身份和Git提交，再从首个未完成任务继续；不得重复派发已经有`Task N: complete`及对应提交的任务。若没有，初始化后保存合入main后的实际baseline：

```bash
mkdir -p .superpowers/sdd/2026-11-13-mobile-frontend-source-alignment
git rev-parse HEAD > .superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/baseline.txt
```

当前技能脚本实际可见`sdd-workspace`、`task-brief`、`review-package`；不要依赖不存在的task-start/task-done。

## 5. Figma第一手资料

完整设计包：`/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/`。

优先读取：

- `design-data/document.kiwi.json`，完整20,567个节点和blobs。
- `design-data/移动端UI.nodes.json`，移动页6,995个节点。
- `original/IntelliDeploy.fig`，原始669条ZIP记录、665个图片资源。
- `frames.csv`、`text.csv`、`fonts.csv`、`colors.csv`、`raw-assets.json`，只作源索引和校验。

已核查hash：

```text
document.kiwi.json:
378b0b88b0e2a5fa420f0178c830f25186b787efc5c1b9d77064aab505ff334e
original/IntelliDeploy.fig:
5951997a694f1da0a343029dfec889b81ea377e098eb94f0e4b9d61f589e949a
```

```bash
export INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221
```

测试和提取脚本可以使用这个env；运行时不依赖Downloads路径。源提取从frontend正确目录/脚本输出位置执行，不能误写repo根的design目录或覆盖原设计包。

## 6. 审计产物和真实验收边界

产物在主工作区：`artifacts/audits/mobile-figma-data-2026-11-13/`，为git忽略的本地证据，不保证在开发worktree存在。可以按绝对路径读取，实施不依赖复制它们成runtime数据。

| 文件 | 用途 |
| --- | --- |
| README.md | 逐页差异、数据库内容归属、硬编码澄清和仅前端范围更新 |
| figma-node-evidence.json | 26状态、4,070个去重节点、1,335个几何blob的审计副本 |
| motion-source-evidence.json | 源prototype、Symbol主定义和实例覆盖的完整原始记录 |
| database-api-evidence.json | READ ONLY数据库及31次真实FastAPI GET的审计快照 |
| frontend-dom-evidence.json | 当前DOM读取既有DTO快照的10个场景，没有截图 |
| manifest.json | 本地检查产物hash |

动效原始记录跨状态包含44 hover、34 click、5 press、8 timeout、2 drag；包含重复实例，不是93个独立动画。示例：文件夹spring1.277617s；Mibo1.250123s或0.8s；源timeout0.3s。正式登录01无prototypeInteractions，当前0.58s入场是自定义，不可说来自该正式Frame。

审计时开发库有10个应用、4个公开外部资源、6个PUBLIC帖子；收藏/最近使用为空。四详情500根因是stop_reason不符合DTO；现有公开响应available=false、url/preview_url=null。六帖没有可调用帖子API。

这些是审计时结果，不假设永远不变。新对话只读核对当前已有接口能力；如果既有接口已经提供数据就正常使用，但仍不能修改后端/API来补齐。保持以下边界：

- 缺帖子API→API_UNAVAILABLE，原广场结构/动效可做，真实六帖不能复制到JS或用Publication冒充。
- 四个500详情→BACKEND_BLOCKED，前端失败/重试/返回可做，后端根因不在本轮修复。
- 缺评分/互动/热度/资料完善度/依赖进度→准确缺字段，不填0、随机数或源示例值。
- 不支持GLASS/NOISE等→经实际能力验证后记NOT_IMPLEMENTED，不能只写支持表替代实现，也不能用普通blur冒充源光学效果。
- 缺原生设备/未实际执行→NOT_RUN，三平台export不替代设备/字体/键盘/动画实测。

旧pixel报告10PASS/16FAIL、整体FAIL、基线未批准是独立历史记录；不改reference/mask/阈值、不更新缺失基线，不能因新源属性检查通过就把它改成26PASS。

## 7. 执行方式和停止边界

推荐使用subagent-driven：每任务新实现agent，提供本任务完整规格、依赖签名、源node ID、文件归属和验收条件；任务结束先复核规格，再复核代码质量，最后全分支review。共享文件顺序编辑，不派多个实现agent同时写。

根据当前superpowers执行规则：先using-superpowers和using-git-worktrees验证既有工作区，使用subagent-driven-development；若平台无subagent能力，使用executing-plans顺序执行，并保留同等检查点。编码遵循test-driven-development，失败按systematic-debugging找根因；完成声明和提交使用verification-before-completion，任务/分支结束做requesting-code-review。

规格已经确认，不重新brainstorm或重复询问是否可以开始。对常规实现选择、局部计划歧义、helper路径/测试细节，先查源/源码，再作可回退的决定，记入ledger继续。计划例子不是盲目照抄的成品：发现源tuple、属性、当前类型或方法签名不符时，以真实源码和已确认规格修正最小实现及计划记录，不自行放宽范围。

遇到已知API_UNAVAILABLE/BACKEND_BLOCKED/设备缺口时，记录状态并继续不依赖该条件的前端工作，不把整个11任务停成等待后端。遇到破坏性/安全敏感/未授权外部副作用或无法在当前范围内正确处理的关键矛盾，按技能和用户授权边界处理；不能用猜测数据或越界修改换取GREEN。

本计划完成条件是前端任务及对应证据真实交付。重要未解决源属性问题不得写成“移动端全部完成”。最终集成按已有合并授权及验证/用户WIP保护条件办理；不push、不生产发布、不删除既有worktree或其它计划workspace。交付至少包含可审查分支、实际commit、测试结果和剩余缺口。

## 8. 任务顺序与验证

从Task1开始，不从旧Task4开始：

```text
1 源清单/有效动效/独立断言
2 自适应空间计算
3 动效取消/reduced-motion/真实状态门禁
4 paint/effect/mask保留及能力验证
5 登录01
6 首页02/29–35
7 商店03/榜单40
8 Mibo46–55/58
9 产品56/57、收藏/最近使用
10 广场59/60、缺API状态、仅测试组件root
11 26状态汇总、完整回归、全分支复核
```

完整操作、代码示例和RED/GREEN命令在实施计划，不另写相互矛盾的简化任务。

移动E2E使用`playwright.mobile.config.ts`：375×812，Expo8086+loopback fixture9199。不要拿标准390×844配置验证375源坐标。组件测试root只在显式`INTELLIDEPLOY_COMPONENT_FIXTURE=1`启用，生产root不变；该root待Task10创建，当前不存在。

标准跨端E2E只使用已有本地隔离测试库/服务，不能指向intellideploy_dev。worktree缺Python环境时用主工作区已有解释器或忽略的本地symlink，不改backend测试文件/迁移/依赖来绕过。新对话应先核对依赖与当前CLI帮助，而不是假设所有命令在旧worktree直接可运行。

最终报告对26状态逐项列STRUCTURE、RESPONSIVE_GEOMETRY、TEXT_STYLE、PAINT_EFFECT、MOTION_INTERACTION、DATA_BINDING。fixture、readonly snapshot和现有API证据分别标识；API/设备/效果缺口不计PASS。

本交接仅准备新对话实施，当前会话没有执行Task1–11、修改产品代码或数据库。
