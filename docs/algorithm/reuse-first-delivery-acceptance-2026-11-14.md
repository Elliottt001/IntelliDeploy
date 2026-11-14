# 复用优先交付实施与真实验收

日期：2026-11-14。代码在main由单agent顺序实现，使用Superpowers executing-plans、TDD、systematic-debugging、verification-before-completion及finishing-a-development-branch；没有创建工作树、子代理或推送。

## 实现范围

按[8项计划](../superpowers/plans/2026-11-13-reuse-first-delivery.md)实现需求交付策略、CORE/PREFERENCE、官方来源与部署资产、证据能力评估、独立A/B/C判定和D许可、官方部署适配、外部交付持久化、Web/Expo客户端与分类统计。原LangGraph、Celery和完整fallback求解器没有恢复为运行时。

8项计划的产品代码和分类统计已实现并提交；外部验收缺口单独保留。Task 1–7代码已提交。96cb58a补齐不要求某能力与禁止能力的区别；be2e24c优先根目录官方部署材料，并以实际匿名编辑动作处理模型误判的用户操作前置。Task 8分类统计代码已提交；本轮真实验收驱动补齐需求审阅职责、有界补全、源码工具检查点接线、完整引用校验以及独立浏览器用途验证。真实验收结果须逐项核对，不能据此宣布全部外部验收通过。

## 真正修复的接线缺口

| 缺口 | 本轮修正 | 证据边界 |
| --- | --- | --- |
| 尚未检索就要求需求草稿提供软件名称、链接及实测 | 限定为REQUIREMENT_ONLY，不在需求审阅要求交付证据 | 原失败14.092秒；最新样本能进入retrieving |
| 所有检索命中都做源码补全 | 新入口每轮只补全5个唯一候选；所有命中仍保留 | 未读候选为UNKNOWN/PARTIAL，不能等同无解 |
| 新候选存在algorithm.retrieval，源码工具只查旧顶层retrieval | 读新检查点、兼容旧记录；工具搜索结果同步检查点 | 真实旧B来源取源码误拒绝已用回归复现修复；其他commit仍拒绝 |
| 模型返回完整repo@commit:path引用，被文件名校验误拒绝 | 接受同仓库、同commit、已读文件的等价引用，显式提供可用引用 | 其他仓库/commit/文件或虚构摘录仍拒绝 |
| 原始HTML无法验证JavaScript编辑器实际编辑/预览 | 独立浏览器渲染，复用BrowserCheck编译和真实动作执行 | 浏览器专项会实际输入并核对预览；预览失效为NOT_RUN |

浏览器所有HTTP资源通过固定公网TCP目的地的受控客户端加载，屏蔽私网、WebSocket、Service Worker、下载和写请求；不提供平台账号凭据。实际动作仅匿名页面导航、输入、点击、断言及刷新；账号/付费/服务重启验证不伪造。截图/DOM证据私有保存到ARTIFACTS_ROOT/external-validation；核心检查状态通过原归属报告接口读取，未将私有路径直接暴露给客户端。

官方候选已有编辑业务证据但匿名访问UNKNOWN时，3c9bdec允许先做实际外部验证；不把UNKNOWN改成源码SUPPORTED，不把选择意图当SUCCEEDED。托管A和D仍维持原门槛。

## 真实API结果

原测试输入保持如下，未强制路线、未授权自动D：

- 官方路径：找一个在线 Markdown 编辑器，能直接编辑和预览 Markdown。优先给官方服务链接，不需要自己部署。
- 独立路径：我要独立部署一个现成 Markdown 编辑器，可以编辑并实时预览 Markdown。外观不同可以接受，优先用仓库自带的部署方式，不要从头生成。

| 样本 | 状态/耗时 | 真实选择与阻塞 |
| --- | --- | --- |
| 075adda2-5af6-43cc-a8ab-24da7ce27405 | FAILED，API记录422718ms | B选中leanote/markdown-editor-v2；取源码工具读错检查点位置 |
| 3212b0bd-e146-4494-9b31-81892a97d83e | WAITING_USER，观察155.504秒 | 完整引用格式被误拒绝；全部保留未确认，不进入D |
| fd13a0a2-4573-48bb-8ec4-29604bd4c6cd | WAITING_USER，观察68.647秒 | 选中nico-martin/markdown-editor，发现https://md.nico.dev/；HTML观测不足以证明实际编辑预览 |
| c6415182-655e-4e74-b4cc-8b92d3eaabad | FAILED，观察105.152秒 | A选中ThisIs-Developer/Markdown-Viewer；Compose的desktop-build选项不受支持，执行前明确拒绝 |
| 2d4fd93c-8038-4a02-80fc-04cd44040515 | WAITING_USER，观察62.576秒 | B选中pottekkat/markdown-editor；官方服务核心证据不足，询问是否独立部署，未擅自部署 |
| 462a6eb9-b674-4dad-9d82-e4f5a7b024f4 | WAITING_USER，观察12.121秒 | 询问文档保存和实例访问权限，尚未冻结/检索 |

这些是失败或等待时间，不是成功完成时间。两句需求不同、交付类型不同，不构成Baseline/Hybrid耗时配对。普通任务仍默认Baseline；Hybrid默认切换仍缺真实配对证据。

额外普通API案例使用POST /api/apps，不传算法模式、路线或目标：明确只需当次编辑预览、不要求跨会话保存、优先免注册官方链接。它是assistant编写的验收用例，不冒称原句的无追问成功。首个普通样本da07ff41-862e-46a6-8d01-68ee995d2176在121.272秒WAITING_USER：不要求保存被误加为负向核心能力；96cb58a修正后，9c4ab0e4-2726-4b2f-8cdc-f10c4309bf0b在72.606秒找到官方服务，但观测模型把创建文件按钮误当注册前置。be2e24c修正后588214ca-681e-446b-a062-7fdb2bc2257c在129.331秒WAITING_USER：编辑/预览源码SUPPORTED，匿名访问仍UNKNOWN，未调用实际服务验证。3c9bdec把这类UNKNOWN交给官方服务实际检查，核心最终门禁不放宽。

结构化脱敏证据：[真实运行记录](evidence/2026-11-14-reuse-first-api-runs.json)。完整响应与截图在私有测试目录保留，密钥不入仓库。19个旧候选的逐项核对是assistant audit，不属于人工签署验收。

## 两个历史判断的纠正

- leanote/markdown-editor-v2的4b72a7679c5853f21d83271e5fadbdccf4ea5b38经GitHub commits/master接口现场核实是commit SHA；其tree SHA是b8b659c90a993c13ddab2fff90d118ec9a0e0535。本轮旧B任务的失败来自检查点位置，不能把这个有效commit说成tree SHA。读取器先解析commit并按同一commit取文件的修正保留。
- 原plan path must be relative已确认是write_file使用../tmp或/workspace路径被拒绝；不是已确认的PackagingPlan或Dockerfile故障。RT-09错误路径的可纠正工具反馈属于独立运行时缺口，本方案未放宽路径边界。

## 本地验证及未完成验收

全量在2a54fff上601 passed / 4 skipped（167.13秒）；随后d6a6e8d浏览器收尾清理专项12 passed（6.83秒），范围Ruff及git diff --check通过。共享API客户端9项、Web27项、Expo116项通过/9项跳过；两端TypeScript检查通过。OpenAPI重复生成哈希稳定；Web生产构建通过；外部链接打开Playwright专项1项通过，不申请平台login code。独立浏览器用途/分类专项12项通过，其中编辑预览为真实本地Chromium动作，页面与模型为受控fixture，不能冒充第三方服务实测。

官方服务真实交付已有SUCCEEDED；仍需单独确认：受支持官方镜像/Compose经项目API完整部署和业务验证；Compose真实卷写入及重启保留；明确核心缺口的B/C完整改造交付；19候选人工验收；同需求成功配对和普通用户Hybrid默认切换。未知供应商费用继续UNKNOWN，不记零费用、不重放。release_ready=false、hybrid_default_ready=false。

外层phase显示仍有长尾：6e9bada3-56b3-4a3e-8c32-566ab5c1d848已真实选中leanote主体并进入implementation工具，仍显示retrieving。因此RT-12只改善了选择耗时记录，显示分段未完全收口。

最终追加官方链接用例642f17c0-ded6-4515-8bb8-64e807de3eea使用独立3c9bdec代码快照测试最新UNKNOWN实测接线，与be2e24c独立部署任务时间有重叠。因此这两个耗时仅作各自运行记录，不作性能配对；两个测试Worker是产品测试进程，代码实施仍为本agent在main顺序完成，没有subagent。

独立部署最终样本6e9bada3-56b3-4a3e-8c32-566ab5c1d848在875.821秒FAILED：已取回leanote主体、执行原工程工具并进入生成结束阶段，但没有形成可验证运行清单。未启动可信业务验收与最终发布，不能算部署成功。该闭环缺口属于RT-10；本方案没有放宽manifest、业务或发布门禁。

9988075进一步统一需求审阅：不要求项保留到原文/facts并映射已有功能，不强制新增验收；此前642f17c0-ded6-4515-8bb8-64e807de3eea的REQUIREMENT_INVALID因此继续复验。eecc9983-fcd6-4501-b464-fdbdc811deba在92.761秒选中官方入口但浏览器导航未完成，业务检查未执行。e4370f1c按文档加载完成后执行检查，并保留BROWSER_TIMEOUT/BROWSER_UNAVAILABLE原因码；不跳过实际业务断言。

## 试跑版本隔离纠正

部署试跑结束后，旧be2e24c Worker仍在同一队列，抢到部分后续任务。原进程stdout确认：588214ca、6e9bada3、cbdaa749、18da001b、f5b649b2这些任务由旧Worker执行（完整ID见JSON）。这些记录保留为旧版本失败样本，不能归因于脚本标记的较新提交。该测试进程隔离疏漏由本agent纠正。

2026-11-14已停止旧Worker，仅保留一个最新Worker，启动时记录worker_id和SNAPSHOT_REVISION。干净8c2f6d0复验cb628cb8-6696-4839-8468-8ef4aa424b24真实暴露冻结需求时的另一处事实映射校验：交付约束可通过草稿，但保存仍拒绝空acceptance_ids。2a54fff把两处校验统一到同一函数，真实功能/保存/权限仍须映射，不能仅靠交付事实替代软件业务覆盖。当前713d0041-7baa-4516-b61f-0f3339aff719为明确单一2a54fff Worker复验。

## 最终交付结论

普通POST /api/apps真实任务713d0041-7baa-4516-b61f-0f3339aff719由唯一2a54fff Worker（f4d68040-f347-4948-bee3-5a386a0f8299）完成：观察72.685秒SUCCEEDED，服务https://md.doocs.org/，来源https://github.com/doocs/md，固定commit ef72ea2d9d1581a4db383bf3f1a848fd60bc2f57。

真实浏览器的进入、当次输入、实时预览三项CORE均PASS；API结果kind=EXTERNAL_LINK，没有instance_id/version_id/artifact_url。微信文章样式优化和可选云同步披露为差异，未为此改写业务代码。源码选择49305ms；完整API时间71920ms，观察时间72.685秒。source_mode=real；托管发布门禁仍为NOT_RUN/EXTERNAL_LINK_NOT_HOSTED_RELEASE，不能填补平台部署或Hybrid默认切换证据。

这条用例显式限定匿名、当次使用，是assistant编写的验收案例；不冒称原句无追问成功或人类review。独立部署875.821秒FAILED的记录仍保留，它运行于旧be2e24c快照；最新独立部署、真实Compose卷重启、B/C核心缺口完整交付及人工验收仍未通过/NOT_RUN。

d6a6e8d随后关闭浏览器前注销在途路由，避免页面关闭后的回调噪声；清理专项12项通过。8项产品代码已落地，Task8真实验收只关闭了官方服务交付，其他未勾选项保留。release_ready=false、hybrid_default_ready=false；普通用户继续默认Baseline。
