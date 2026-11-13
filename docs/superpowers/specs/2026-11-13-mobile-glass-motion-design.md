# 移动端源玻璃与完整动效实施规格

用户要求：按已有 Figma 设计稿实现玻璃效果和完整动效。此规格补齐已确认移动前端规格中的效果/交互缺项，不新增视觉设计、业务接口或无稿页面。

## 范围和来源

- 既有 worktree `codex/intellideploy-mobile-figma`，起点 `0dc0ded`；保留用户所有已提交/未提交内容与主工作区五个 WIP 指纹。
- 仅前端与实施记录；允许确有必要的前端绘图库与对应 lockfile，不改 backend/API/shared-client/DB/Web 客户端/部署。不 seed、迁移、api:generate、push 或删除 worktree。
- 第一来源 `/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/design-data/document.kiwi.json`，SHA `378b0b88b0e2a5fa420f0178c830f25186b787efc5c1b9d77064aab505ff334e`。继续使用现有 26 状态 manifest；读取 Symbol、override、变量、完整几何/paint/effect/prototype。
- 不用 Figma 截图、页面裁片或 PDF 推导参数。程序由源几何计算的位移/噪声场、运行时真实背景 framebuffer 是渲染输入，不是设计参考图或固定页面图片。

## 玻璃与纹理

消费完整 raw GLASS/NOISE，包括 visibility、order、blend、color/alpha、radius、refractionRadius/intensity、specularAngle/intensity、bevelSize、chromaticAberration、reflectionDistance、noiseSize/type/density/opacity/seed、clipToShape。单位、色彩空间、坐标转换明确记录；零值必须产生真实对应的零作用。几何/matrix/mask/clip/继承透明度不能丢失或重复应用。

Web 使用源节点绘制位置的 SVG foreignObject + CSS backdrop-filter URL；光学滤镜真实采样后景。原生 SVG displacement/turbulence 不实现，采用 Expo 55 对应 Skia 2.4.18 的 ImageShader/Shader 与实际持续更新的 underlay 输入。Web 不使用 Skia RuntimeShader image filter（该 API 在此版本 Web 未实现）。

原生背景采集根 `collapsable=false`。采集与光学层/前景分离，single-flight、generation、防迟到结果、layout/DPR/scroll 对齐、旧图释放、AppState/卸载清理齐全。一个共享输入供同一真实 z 层的多个形状使用；多层交错玻璃需要按源绘制顺序分层或在受控局部 Canvas 中组合前序内容，不能只取页面底色，也不能采入自己造成递归反馈。文本、输入和按钮保持正常可访问前景；真实动态内容位于玻璃之前时必须进入相应采样输入。

现有 FigmaGeometry/FigmaTree、自定义文件夹/轮播/输入胶囊/控制表面均接入，覆盖全部实际可见 GLASS/NOISE 源节点。不能只做示例组件、只加参数标签或把模糊重命名为 GLASS。

Figma 的内部折射曲线、BRDF 和随机数算法不公开。实施需明确光学模型、原值映射和真实作用证据；源参数正确且实际渲染不代表已经证明与 Figma 专有算法逐像素相同。浏览器/原生设备未执行的验收保持 NOT_RUN，不凭构建宣称“完美”。

## 动效

原始 93 条记录是跨状态重复记录，不是 93 个独立动画。对实际控制与 route 建立源事件到 runtime 的完整清单，补齐 Symbol 目标依赖闭包及其 AFTER_TIMEOUT 状态链；只读目标数据，不把无稿/旧目标页重新开发为产品页面。

- 现有 Home/Mibo/Product/Community 动效保持真实 snapshot/数据权威与已验证连续性，补缺失的 hover/press/click/drag、起止 property、route/swap-state。
- `248:20538 -> 248:20537` 是设置/箭头 hover 状态，38 到约45pt、源 CUSTOM_SPRING；按有效实例 override 保留导航 action。
- `270:26760`/`825:6884` 是主体底部“点赞特效”，Symbol `228:19794`，并非全局 BottomNav。两组 click 与 timeout state chain 直接读取源。视觉状态不能假装真实点赞成功；业务动作只由现有 API/能力决定，无对应 API 则保持缺口而提供可测试纯展示组件。
- 页面 SLIDE_* 使用实时 viewport、源 duration/easing、进入方向与退出层，无额外淡入淡出；SMART_ANIMATE 插值实际对应的源属性，不加无源全页面 fade。
- 既有业务路由语义/默认 created 不改变；保留 auth、草稿/key、401/402/409、失败旧交付、favorite/copy 与功能入口。
- 源两条 SCROLL_TO 缺少有效 target；记录为源动作不完整，不猜一个滚动目标或计作完整实现。
- Mibo 原型 timeout 不推进 Job。组件纯视觉 timeout 可以按源运行，不写 Job、数据库或成功状态。
- completion/cancel/reversal/rapid replacement/AppState/unmount/reduced-motion 全部保持；旧层视觉保留不交互/不重复 ID，结束后卸载。

## 验证与交付

先 TDD RED 再实现。独立 Kiwi raw 对照、源参数数学作用、实际 shader 编译/渲染、实时条纹/文本/颜色/scroll、零值对照、seed 可重复、四形状/matrix/DPR、所有源事件起点/中点/终点/中断都验证。测试自己的渲染输出可以数据采样，不使用 Figma 图片作为期望或设计推导。

覆盖320/360/375/390/430、短长屏/安全区；字体和44pt触控不缩小。前端 source+DTO unit、typecheck、相关 E2E、最终非视觉回归、组件 root 与三平台 export 顺序执行。真实原生光学/性能与字体/键盘只在可用设备上验收；无设备不捏造。

更新当前逐页差异、效果/动效能力记录和验收，不改旧截图基线。每任务独立复核，最终全分支复核；无已实现/未验证混淆。
