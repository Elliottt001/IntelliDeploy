# 可直接粘贴到新对话的启动prompt

请执行 IntelliDeploy 移动端仅前端实施计划。规格已经由我确认，实施计划已完成；这次直接进入实现，不重新brainstorm、不重复询问是否开始。

先使用superpowers:using-superpowers，按顺序完整读取主工作区的文件：

1. `/Users/bytedance/Projects/my/byte-intelli/docs/superpowers/handoffs/2026-11-13-mobile-frontend-implementation-handoff.md`
2. `/Users/bytedance/Projects/my/byte-intelli/docs/superpowers/specs/2026-11-13-mobile-figma-data-alignment-design.md`
3. `/Users/bytedance/Projects/my/byte-intelli/docs/superpowers/plans/2026-11-13-mobile-frontend-source-alignment.md`
4. `/Users/bytedance/Projects/my/byte-intelli/artifacts/audits/mobile-figma-data-2026-11-13/README.md`

然后验证并进入既有worktree：

`/Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma`

分支：`codex/intellideploy-mobile-figma`。

所有开发命令的workdir都设到这个worktree，不在主工作区git switch，不创建/删除worktree。先核对git status/worktree/HEAD，在worktree合入最新main，保留最新后端、算法、支付、字体基线，再记录baseline。

主工作区的CommunityPost模型、Alembic env、0014迁移、seed及其测试是我的已有WIP，不要提交、覆盖、stash全部或复制为本轮后端基线。交接里的HEAD和数据数量是快照，开始时自行只读复核当前状态。

使用superpowers:subagent-driven-development按Task1→Task11顺序执行：每任务新实现agent，先规格复核再代码质量复核，最后做全分支review；不要让多个实现agent同时编辑共享文件。没有subagent能力时使用executing-plans顺序执行。编码用TDD，失败用systematic-debugging，完成声明和提交前用verification-before-completion。

本轮ledger路径：

`.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/progress.md`

用当前技能sdd-workspace脚本初始化/核对归属；第一行标明本计划文件。已完成任务依ledger和实际commit判断，不重复派发。旧2026-11-11移动Figma Task4交接不代表本轮进度；本轮尚未开始实现，从Task1开始。

以下约束必须严格执行：

- **只改前端。** 不修改backend、接口路由/请求/返回结构、数据库/迁移、packages/api-client共享契约、Web客户端、部署、生成或计费。不要api:generate，不要seed/清理开发库。
- **已有正式页面逐页严格依Figma数据实现。** 源包为`/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/`。每页直接读取document.kiwi.json、移动节点、Symbol/Instance/override、变量、几何blob、paint/effect和prototype事件；不用图片、截图、PDF目测或页面裁片辅助推导实现。原始IMAGE填充仅按源hash/UV/mask使用，不能用整页图代替组件。
- **页面和内部组件自适应。** 375×812是参考，不是固定运行时画布；读取真实窗口、安全区、键盘和父容器，卡片/文件夹/轮播/输入区伸缩，文字自然换行，插画局部保持比例。验证320/360/375/390/430宽、短长屏、非零inset、大字体、键盘；不整页scale，不缩小44×44pt命中区域。
- **动效按源参数。** 核对hover/press/click/drag、duration、spring/easing、起止属性、实例事件覆盖，处理取消、后台/卸载和reduced-motion。Mibo AFTER_TIMEOUT只作原型依据，真实Job不按timer推进，不伪造进度/依赖/成功状态。
- **不能把数据库业务内容写在前端。** 用户/应用/帖子/统计/收藏/额度/实际任务等读现有API；固定UI文案、按钮、提示、静态示例、状态名称及有源依据的样式常量可以写，不需要全部配置化。
- **范围只含六类26状态。** 登录01；首页02/29–35；商店03/榜单40；Mibo46–55/58；产品56/57；广场59/60。无正式稿页面不补画或重做布局。app-gallery继续默认created，收藏/最近使用维持既有入口。
- **真实缺口准确保留。** 审计时六帖没有API、四详情500、公开资源没有url/preview；只读核对现有接口。没有数据就记API_UNAVAILABLE/BACKEND_BLOCKED，前端做好缺内容/失败/重试/返回；不复制数据库快照进JS，不拿Publication冒充帖子，不为了GREEN改后端。
- **源效果不能靠标签冒充实现。** GLASS/NOISE/blur/mask/混合模式按实际能力验证；不支持记NOT_IMPLEMENTED，缺设备记NOT_RUN。不能用普通blur代替GLASS后宣称严格一致。
- 保留认证、SecureStore、账号隔离、草稿/key、前后台轮询、401/402/409、失败保留旧交付及收藏/副本功能。测试fixture可验证结构和状态，但不计真实数据/交付/原生验收。
- 不修改原Figma参考、pixel比较器、mask/阈值，不批准缺失截图基线；旧10PASS/16FAIL不能自动变为26PASS。不push、不生产发布，不删除既有worktree或其它计划ledger。

源提取和测试使用：

`INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221`

提取输出位置按计划核对，不把本机Downloads路径作为运行时依赖。移动源坐标检查使用playwright.mobile.config.ts，不用标准390×844配置代替375参考配置。

常规可回退的实现选择、局部计划歧义、helper路径/测试细节，先查源和当前代码，自行作判断，记Ruling并继续，不在任务之间反复问“是否继续”。已知接口/设备缺口不应阻止其它独立前端任务。计划示例若与当前源码或源字段不符，按已确认规格修正最小实现和计划记录，不盲目照抄，也不放宽范围。

每任务完成后独立提交实际前端增量，记录RED/GREEN/review证据。最后交付可审查分支、commit列表、前端验证结果和26状态各项验收/缺口。是否合入main按已有授权、验证结果和我的WIP保护条件办理；未完成源效果/真实验收不要写成“移动端全部完成”。

现在从worktree状态核对、读取源设计数据和Task1开始执行。
