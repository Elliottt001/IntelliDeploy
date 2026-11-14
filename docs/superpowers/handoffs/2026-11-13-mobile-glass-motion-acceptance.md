# 移动端源玻璃与动效交付

日期：2026-11-14。冻结代码 `f95cc92e5575f158dd99fd11ab6500a56116d8f4`，实现范围 `2fd2ba6..f95cc92`。本轮仅验证与文档交付，不增加产品功能。

**玻璃与有效源动效实现已完成；独立原生应用运行、长期稳定性/性能、Figma 私有光学算法一致性仍未证明。** 玻璃已有真实背景采样、折射、分色、光照、霜化和源噪声，有效源动效已有运行时消费者。不能宣称全部页面、设备或专有算法严格一致。

## 实现提交与来源

| 提交 | 变化 |
| --- | --- |
| `5d660c1` | 源光学模型、Web/native 渲染输入与真实背景玻璃 |
| `669696a` | 按源绘制顺序组合真实原生前序内容 |
| `83306e3` | 原生固定输入光学验证组件（组件代码不等于运行通过） |
| `3a19d4f` | 原生逐帧资源回收与采集测量 |
| `ebd769f` | 源控件、路由动效及三个玻璃复核修复 |
| `f2500bb` | 16 条头像、5 条云 press、6 条 Mibo 对应属性转场补齐 |
| `722687a` | 修复生产入口按当前头像/云状态选择动效、hover 反转进度、转场节点原布局与普通/独立测试配置隔离 |
| `f95cc92` | 按 Kiwi 原 `mask` 字段提取/生成遮罩，补独立原源值与真实组件遮罩回归 |

第一来源是本地 `design-data/document.kiwi.json`，SHA-256 `378b0b88b0e2a5fa420f0178c830f25186b787efc5c1b9d77064aab505ff334e`；不使用源截图或 PDF 反推参数。180 个效果节点、171 条可见 GLASS/40 条 NOISE 是源库存数量，不能当作每状态完整视觉通过数量。完整原参数、继承、顺序及可见性保留；运行时不会读取 Downloads。

Web 在源 SVG 绘制位置用 CSS 后景滤镜采样真实先前内容；原生显式采集前序 RN 内容并按源顺序组合，JS 离屏用 CPU Raster，UI Canvas 上传图像。当前玻璃不会采入自己。共享外壳的 70% 白色填充/描边、首页底栏与卡片按钮的真实前序内容、迟到采集失败的代次保护已修复并复核。私有折射曲线、反射模型和随机数算法未知；路径距离和噪声是已说明的实现模型，不能称与 Figma 算法或逐像素完全相同。

## 动作闭包：90 + 6 + 2

原 93 条跨状态动作加 5 条 Symbol 依赖动作，共 98 条记录，并非 98 个独立动画。逐条 owner、事件、原目标、曲线、现有路由与限制见[完整覆盖表](../../../.superpowers/sdd/2026-11-13-mobile-glass-motion/task-2-motion-coverage.json)。

| 源事件 | 已实现 | 界面链已实现、无点赞 API | 源目标不完整 |
| --- | ---: | ---: | ---: |
| `ON_HOVER` | 45 | 0 | 0 |
| `ON_PRESS` | 5 | 0 | 0 |
| `ON_CLICK` | 30 | 4 | 2 |
| `DRAG` | 2 | 0 | 0 |
| `AFTER_TIMEOUT` | 8 | 2 | 0 |
| 合计 | 90 | 6 | 2 |

90 条覆盖设置 hover/触摸、头像、灵感云、卡片/文件夹/轮播/拖动、Mibo 权威状态和四方向路由。对应属性转场按源名称/类型/出现次序匹配实际节点，使用当前显示状态与实测边界插值局部路径、文本、paint、matrix、effect、opacity、clip；无源整页淡入不会冒充源动画。取消、反转、后台、卸载和减少动画保留；旧显示层不接收触摸/辅助功能，也不重复 SVG ID。业务路由、鉴权、草稿和默认 created 不改变；原型计时不推进真实 Job。

6 条是 `270:26760`、`825:6884` 两个实例和 `228:19794 → 19793 → 19791 → 19792 → 19794` 的 4 条依赖。它们是主体底部“点赞特效”，原审计误标全局 BottomNav 已纠正。完整源 click/1ms timeout 界面链存在，没有点赞 API/DTO，不能产生持久化点赞、统计或成功声明。

2 条是 `280:26959`、`380:190` 的 `SCROLL_TO`，原目标为 null；保持 `SOURCE_INCOMPLETE`，未猜目标。

## 最终冻结代码验证

| 检查与版本 | 实测结果 |
| --- | --- |
| `f2500bb` 源/真实 DTO 单元、typecheck | 247 PASS / 41 文件；类型通过 |
| `f2500bb` 完整非视觉移动回归（停止） | 39 PASS / 13 FAIL / 1 interrupted / 131 NOT_RUN，exit130 |
| `722687a` 源/真实 DTO 单元、typecheck | 251 PASS / 42 文件；类型通过 |
| `722687a` 完整非视觉移动回归 | 175 PASS / 5 FAIL，30.8 分钟，exit1 |
| `f95cc92` 四项实际失败回归 | 4 PASS；原遮罩、双阴影/三个合成节点和透明度通过 |
| `f95cc92` 源状态收集（唯一一次） | 1 PASS / 26 条记录 / 零错误；严格 INCOMPLETE |
| `f95cc92` 独立动效配置 | 8 PASS |
| `f95cc92` 组件初次检查 | 14 PASS / 1 FAIL：社区拖动中点实际墙钟偏移，原差值上限 16，观察差值 19.2395 |
| `f95cc92` 社区受控时钟检查 | 单项 1 PASS（五种宽度），最终完整小组件套件 15 PASS |
| `f95cc92` Web/iOS/Android 导出 | 三个平台均 PASS，仅构建产物验证 |
| `f95cc92` 最终原源/真实 DTO 单元（maxWorkers=2） | 252 PASS / 42 文件 / 零跳过 |
| `f95cc92` 最终类型检查 | PASS |

[Web 导出入口](../../../frontend/.expo/glass-motion-web/index.html)、[iOS 导出 metadata](../../../frontend/.expo/glass-motion-ios/metadata.json)、[Android 导出 metadata](../../../frontend/.expo/glass-motion-android/metadata.json)均为真实本地 ignored 产物。最终生产版本没有重新运行完整 180 项套件；旧 175/5 结果和针对原五项失败的 4+1 回归分别保留，不能相加宣称最终完整套件 180 PASS。

`722687a` 的五个失败必须保留：原收集器触发 300 秒超时，测试报告连同关闭/trace 开销显示 19 分钟，留下的 80MB trace 不完整不可读；三项旧头像滤镜 ID 假设失配，其中一次等待旧 ID 达 45 秒。现有实际 trace 确认新 filter 仍有两个原始阴影与三个合成子节点；另一个遮罩失败是实际源提取问题：原 Kiwi 使用 `mask:true`，动效提取器误读 `isMask`，不能靠改选择器掩盖。`f95cc92` 已修复原遮罩字段提取，四项针对失败的回归通过；旧版本的五个失败结果保留。

修复前原收集器输出为初始化 `NOT_RUN / 0 records`。测试兼容修复后 `f95cc92` 的唯一一次收集已完成：1 PASS、26 条记录、零错误，1.5 分钟；严格结论仍 `INCOMPLETE`，整体效果/动作与原生边界仍 `NOT_RUN`。[运行前保留的历史摘要](../../../frontend/artifacts/glass-motion/source-acceptance-before-final.json)仍含原 26 状态结果，原历史 0/26 不改。

组件中点测试原先等待实际 150ms 再采样，等待与浏览器响应开销会改变取样时刻。测试现在触发前暂停时钟，精确推进源 150ms；原 300.0000119ms 时长、曲线、`≤16` 中点差值、progress=1 和 -94 终点断言都保留。受控时钟通过后，完整小组件套件通过，没有修改生产动画。原 14/1 失败日志保留。

最终日志位于[Task3 日志目录](../../../.superpowers/sdd/2026-11-13-mobile-glass-motion/task-3-logs/)，[检查清单与逐状态说明](../../../frontend/artifacts/glass-motion/current-evidence.json)记录当前实现和未运行项。Web/iOS/Android export 只是产物构建；不等于独立原生应用编译、安装或设备效果通过。

旧 26 状态严格验收 `0/26` 与像素比较 `10 PASS / 16 FAIL` 保留历史结果。原收集器上一轮“玻璃/动效未实现”硬编码已更新，旧标签不能代表当前实现；本轮测试兼容修复已把整体效果/动作验收保守记为 NOT_RUN，新记录说明进展，但整页六项全面核验、专有算法比较和设备验收仍 `NOT_RUN`。未批准图片基线或调整原比较器 mask/阈值。

## 真实失败与未运行项

- 旧原生运行曾出现三次 Ganesh/Metal 崩溃；改 CPU Raster 后又出现约五分钟后的 Hermes OOM。这些是实际失败，未撤销。`3a19d4f` 修复后 40 帧 CPU 单元回归验证临时资源清理和有界缓存，不等于持续 Hermes 内存、长期稳定性或帧率验证。
- 先前短窗口观察到真实采集/显示变化，也观察约 2.82 次/秒采集与延迟。最终独立原生运行、性能、无读回测量、实际固定输入零折射/分色对照、Android 运行均 `NOT_RUN`，不能声称 30/60fps。
- 用户停用 ExpoGo；独立 iOS 应用已生成在 ignored `frontend/ios`。官方 RN core 仅保留 52,409,575 / 92,489,249 字节，Hermes 未验证，依赖包 19,253,841 字节 SHA1 已验证。详见[构建准备记录](/tmp/intellideploy-own-ios-w2twfq3j/build-preparation.json)。独立编译/运行因外部官方制品下载阻塞，未继续下载或改本机配置。
- 帖子与持久化点赞缺生产 API；图标/预览等已有字段可能为空，其他源示例数据缺已验证的真实供给，不能把 null 都判成接口缺失。四条详情 500 仅保留历史只读快照，本轮未刷新真实接口，真实 Job 生成未验收。本轮不写库、迁移或用假记录补齐。旧测试库 schema `0014_community_posts` 与仓库 `0013_resource_cleanup` 不匹配，跨客户端持久化测试体仍 `NOT_RUN`。
- 物理 iOS/Android 字体、键盘、安全区、辅助功能、动画与光学严格一致性未实测；浏览器/CPU 检查不替代这些结论。

## 复核与决定记录

[Task1 三项修复复核](../../../.superpowers/sdd/2026-11-13-mobile-glass-motion/task-1-fix-review.md)已批准所审查修复；冻结全范围最终独立复核由控制器记录，不据早期批准替最终代码结论。修复前 `f2500bb` 复核发现两项重要动效问题，统一回归还发现转场节点布局与测试配置隔离问题；`722687a` 已完成单次最小修复，[最终独立复核](../../../.superpowers/sdd/2026-11-13-mobile-glass-motion/final-review.md)已批准 `722687a` 的规格和质量，两项重要动效问题及布局/隔离回归已关闭，未发现新问题。该结论取代旧 `f2500bb` 复核门槛，不撤销原生未运行项和修复前失败。[遮罩修复独立复核](../../../.superpowers/sdd/2026-11-13-mobile-glass-motion/mask-fix-review.md)已批准 `f95cc92` 的规格和质量：20 棵原树中仅 12 个 mask 从 false 恢复 true，重新生成与原源数据一致，没有新的重要问题。

[Task3 测试兼容修复及社区时钟独立复核](../../../.superpowers/sdd/2026-11-13-mobile-glass-motion/task-3-test-review.md)已批准规格和质量。三个测试文件 diff SHA-256 `e6f14ea47135754820c53cb746b8df535800810d969f4f669e27f6dbcff0d417`，新增社区时钟 hunk SHA-256 `0276dc3f061fa10faaa94b424f534e59e5d61f8572f99ed627c0debc8a19d921`；运行时证据来自冻结生产 `f95cc92` 与这些已复核测试改动。

本轮 `Ruling:` 按出现顺序保存在[新 ledger](../../../.superpowers/sdd/2026-11-13-mobile-glass-motion/progress.md)：授权内的源实现继续；Web/native 两种渲染输入分工；点赞 ancestry 纠正；原生同 Canvas/显式前序输入；group 光学与前景滤镜分离；Mibo 连续性按原曲线/实际采样间隔；用户催快时先完成已确认代码并保留原生限制。原[验收交接](2026-11-13-mobile-frontend-source-acceptance.md)中的 13 条历史决定不改。决定后果和精确原句以 ledger 为准。

Task3 只提交三份 handoff 文档和四个获准测试文件（源状态收集、效果、源渲染、社区组件时钟）；生产 source 由单一作者在 `f95cc92` 修复并已提交。Task3 不改 backend/API/shared DTO/DB/Web、原生构建配置、源设计包或比较器。未 push、迁移、改代理或删除现有工作。


## 附录：本轮九条决定原文与后果

以下按活动 ledger 中出现顺序完整保留原文；历史交接中的 13 条决定仍保留原处。

| 顺序 | 原文 | 说明及判断错误时的后果 |
| --- | --- | --- |
| 1 | Ruling: User explicitly requests implementation of already confirmed glass/motion scope; technical renderer selection proceeds without another design approval gate — same visual target and reversible frontend work — renderer integration may require rework if its real backdrop topology proves inadequate. | 继续用户已授权的源效果/动效实现，不另开设计审批。若真实背景层次不正确，需要重做相应前序采样适配及效果回归，不能仅改验收标签。 |
| 2 | Ruling: Web SVG foreignObject/CSS backdrop-filter and native Skia live-underlay are different backends sharing one source optical model; Web Skia RuntimeShader image-filter is not implemented in SDK-compatible2.4.18 — verified official source and Chromium dynamic refraction probe — unsupported browser/device execution must remain visible in acceptance. | Web 和原生采用不同后景输入，共用明确的源光学参数；此版本 Web 不具备所需 Skia 接口。若接口/能力判断错，需更换对应实现并重新验证动态背景，设备未测状态仍保留。 |
| 3 | Ruling: Prior reaction audit mislabeled Symbol228:19794 as shared BottomNav based on generic ancestry. Original parent COMPONENT_SET is explicitly 点赞特效; correct to body-footer reaction component, preserving API/data limitations rather than inventing social persistence — raw source ancestry/interaction chain — previous audit descriptions/tests need scoped correction. | 按原组件父级纠正“点赞特效”身份，不推断持久化点赞。若原 ancestry 解释错，应重查 source 与 override 并修正对应控件测试，不能因此虚构业务能力。 |
| 4 | Ruling: Native SVG roots combine paints and cannot expose a correct arbitrary sibling backdrop; root capture would feed current optics back and atmosphere-only capture misses prior real content. Permit a native-only ordered source scene adapter, retaining Web SVG and source interfaces, using native Skia BackdropFilter/RuntimeShader for preceding same-Canvas paints and an explicit external RN prefix-underlay input where needed — actual source paint order and no-feedback optics require this — extra native adapter and source-render regression cost if mapping is wrong; device performance remains unverified without execution. | 用按原绘制顺序的原生场景与明确外部前序内容，避免只采底色或采入自己。若顺序/层次映射错，需要修正适配与源渲染回归；实际设备性能仍需测量。 |
| 5 | Ruling: Native group SourceGraphic filtering must use a transparent intermediate group with explicit prior-prefix optical input rather than isolated saveLayer BackdropFilter; actual production compositor RED/GREEN pixels verify group blur leaves external stripes unchanged — prevents regression in formerly rendered group shadows/blur — native compositing and device runtime need targeted rework if wrong. | 组前景先画在透明中间层，玻璃单独取实际前序输入，再按源顺序处理组阴影/模糊。若组合语义错，需修复对应组处理并重跑原生像素与设备检查，避免重复处理背景。 |
| 6 | Ruling: The old Mibo SLIDE continuity fixed25pt bound is below the unchanged raw cubic's maximum movement in one60Hz frame: original [0.4199999869,0,0.5799999833,1], duration800.0000119ms, viewport812 gives29.1585942pt. Correct this new-E2E bound using actual sample elapsed time/source curve plus rendering quantization and forward-direction assertion, with independent math regression; do not alter motion or original pixel comparator thresholds — excludes false failures at peak velocity while retaining genuine endpoint-jump detection — if wrong, revise only sampling evidence and rerun continuity. | 原 25pt 上限低于原曲线单帧实际移动量，改用源曲线和真实采样间隔验证连续性。若推导错，只修采样证据/数学断言再跑连续性；源时长与原像素阈值不变。 |
| 7 | Ruling: latestuser says先实现/好慢; deliverremainingmotioncode first while frozen glassreview runsreadonly, nativebuild/downloads do not blockcoding. Keep onecurrentimplementationwriter; confirmedthreeglassImportantjoinmotionintegrationasonefixscope, no hidden acceptance — userpriorityandsharedsourceownership — integrationreviewmustverifybothaspectsbeforefinalclaim. | 用户要求先完成已确认代码，原生制品下载不阻塞动效实现；同一作者合并处理已知三项玻璃问题。若集成遗漏，要回到具体源实现补回归，不能以催快为由掩盖限制。 |
| 8 | Ruling: Final integration fixwave keeps source timing and business callbacks; inner animated content explicitly owns its allocated source size, and production source-state selection precedes card/base fallback. Ordinary configs exclude fixture-only routes. Fresh251 unit/4 production/8 fixture/typecheck gates pass; one parent final-HEAD review/QA follows. | 保留源时长和业务回调，内层布局占有原分配尺寸，当前源状态优先选择动作；普通配置隔离纯组件入口。若回归或映射错，要修对应布局/选择逻辑与配置测试，并以新版本复核，旧通过不能替代。 |
| 9 | Ruling: Final f95 component suite reports14PASS/1FAIL at community source150ms midpoint (19.2395 vs unchanged16pt bound). Permit the verification owner to diagnose and minimally replace wall-clock wait with paused Playwright clock at exact source150ms, retaining bound and all production motion unchanged — source-time assertions require controlled sample timing; not proof of drift until verified — if controlled sampling still fails, preserve actual failure and investigate source/runtime rather than relax tolerance. Added test hunk requires independent scoped review. | 社区中点按受控时钟精确取源 150ms，保留原时长、曲线、中点差值上限和终点。若时钟覆盖不正确，应修正测试取样和相应回归，不能调整生产动画或放宽断言；原墙钟失败仍保留。 |
