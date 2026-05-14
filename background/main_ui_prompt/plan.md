# IntelliDeploy 移动端主界面实现计划

## 0. 任务边界

本轮负责 IntelliDeploy 前端里的移动端主界面。项目不是从零搭建，当前技术栈已经是 Expo + React Native + Expo Router，本轮工作是在现有工程里按 Figma 还原移动端主界面、浅色和深色视觉、首屏交互入口和 prototype 动效。

明确不做：

- 不改后端接口、数据库或认证流程。
- 不重构登录、注册、Chatbot、App Gallery 的业务逻辑。
- 不改 Web 首页视觉和路由结构。
- 不新增全局设计系统。

## 1. Figma 目标节点

Figma 文件：

```text
https://www.figma.com/design/w8o9pOMZKhCMWaRzc6s4gw/IntelliDeploy?node-id=88-1782
```

已确认的页面结构：

- `88:1782`：Page，移动端 UI。
- `129:1390`：Section，浅色模式。
- `119:100718`：Section，深色模式。

浅色移动端主界面：

- `266:21147`：默认首屏，375 x 812，名称 `主界面`。
- `268:22904`：App Gallery 展开态。
- `268:23238`：我的产品展开态。
- `268:23572`：广场展开态。
- `268:23906`：个人主页展开态。
- `188:16287`：头像 hover / 参考态。
- `188:16759`：词云 press / 参考态。

深色移动端主界面：

- `95:1783`：`深色：应用商店参考2`，375 x 2088，是深色 AppMarket 长页主设计。
- `98:2203`：`深色：应用商店参考1`，864 x 1821，整屏视觉参考。
- `103:75409`：`深色全局参考`，1024 x 1536，整屏视觉参考。

结论：浅色和深色不是简单换肤。浅色是 `Hi Oasis + 灵感池 + 功能广场` 的主界面；深色是 `AppMarket / 应用商店` 长页主界面。本轮实现要在同一个移动端入口里提供浅色和深色两套主界面体验。

## 2. 当前项目基线

前端路径：`frontend/`

当前技术栈：

- Expo `~55.0.23`
- React `19.2.0`
- React Native `0.83.6`
- Expo Router `~55.0.14`
- TypeScript strict
- `react-native-safe-area-context`

当前路由：

- `frontend/app/index.tsx`
- `frontend/app/login.tsx`
- `frontend/app/register.tsx`
- `frontend/app/app-gallery.tsx`
- `frontend/app/chatbot.tsx`

当前 `frontend/app/index.tsx` 已经通过 `Platform.OS === 'web'` 保留 Web 首页并进入移动端分支。移动端分支已有一版主界面雏形，但仍然把页面、组件、token、动效和资源写在同一个文件里。本轮需要拆出独立组件目录，保留 Web 分支不动。

## 3. 文件结构规划

代码文件：

```text
frontend/app/
  index.tsx

frontend/components/mobile/main/
  MainHomeScreen.tsx
  MainHomeBackground.tsx
  MainHomeHeader.tsx
  MainHomeHero.tsx
  MainHomeInspirationCloud.tsx
  MainHomeFeatureCards.tsx
  MainHomeFeatureCard.tsx
  MainHomeDarkMarket.tsx
  MainHomeBottomNav.tsx
  mainHomeAssets.ts
  mainHomeMotion.ts
  mainHomeTokens.ts
  mainHomeTypes.ts
```

Prompt 镜像：

```text
background/main_ui_prompt/
  plan.md
  global/
    00_main_ui_context.md
    01_figma_nodes.md
    02_design_tokens.md
    03_motion_and_interactions.md
    04_forbidden_changes.md
  files/
    frontend__app__index.tsx.prompt.md
    frontend__components__mobile__main__MainHomeScreen.tsx.prompt.md
    frontend__components__mobile__main__MainHomeBackground.tsx.prompt.md
    frontend__components__mobile__main__MainHomeHeader.tsx.prompt.md
    frontend__components__mobile__main__MainHomeHero.tsx.prompt.md
    frontend__components__mobile__main__MainHomeInspirationCloud.tsx.prompt.md
    frontend__components__mobile__main__MainHomeFeatureCards.tsx.prompt.md
    frontend__components__mobile__main__MainHomeFeatureCard.tsx.prompt.md
    frontend__components__mobile__main__MainHomeDarkMarket.tsx.prompt.md
    frontend__components__mobile__main__MainHomeBottomNav.tsx.prompt.md
    frontend__components__mobile__main__mainHomeAssets.ts.prompt.md
    frontend__components__mobile__main__mainHomeMotion.ts.prompt.md
    frontend__components__mobile__main__mainHomeTokens.ts.prompt.md
    frontend__components__mobile__main__mainHomeTypes.ts.prompt.md
```

## 4. 组件职责

- `index.tsx`：只负责 Web/Mobile 平台分流。Web 仍渲染现有 `WebHome`；移动端渲染 `MainHomeScreen`。
- `MainHomeScreen.tsx`：移动端主界面组合层，负责主题状态、首屏进入动画、卡片展开状态、导航动作。
- `MainHomeBackground.tsx`：浅色主界面的背景渐变、氛围弥散和暗色背景壳。
- `MainHomeHeader.tsx`：品牌区、设置按钮、浅色/深色切换入口。
- `MainHomeHero.tsx`：头像、问候语、Mibo 对话入口。
- `MainHomeInspirationCloud.tsx`：灵感池标题、词云、换一批状态、词云 press 反馈。
- `MainHomeFeatureCards.tsx`：四张功能卡的列表、展开状态协调、跳转入口。
- `MainHomeFeatureCard.tsx`：单张卡片的标题、副标题、图标区、展开细节和按压态。
- `MainHomeDarkMarket.tsx`：深色 AppMarket 长页，还原 `95:1783` 的顶部、hero、统计、分类、排行、精选、最新推荐和底部导航。
- `MainHomeBottomNav.tsx`：浅色底部玻璃导航和深色底部导航。
- `mainHomeTokens.ts`：浅色和深色 token、字体、间距、圆角、阴影、卡片尺寸。
- `mainHomeMotion.ts`：Figma prototype 动效参数和 React Native Animated 映射。
- `mainHomeAssets.ts`：语义化图片、图标资源引用。
- `mainHomeTypes.ts`：主题、卡片、导航、动画状态类型。

## 5. Figma 关键参数

浅色默认首屏 `266:21147`：

- 画板：375 x 812，圆角 40，白色描边 5。
- 背景：`#EFF3FF` 到 `#FFFFFF`，角度约 199.43deg。
- 导航栏：x 14, y 47, w 347, h 38。
- 头像：x 36, y 107, w 83.81, h 84。
- 顶部提示：`Hi！Oasis✨`，20px，`#404040`；副文案 11px，`#7F80A1`。
- Mibo 入口：x 194.25, y 171.94, w 147.5, h 12。
- 灵感池标题：x 35, y 249, w 307, h 15。
- 词云：x 39, y 277, w 303, h 111，圆角 30，白色边框。
- 功能广场标题：x 35, y 419, w 307, h 15。
- 功能卡：x 28, w 321，折叠高度 68-70，展开视觉高度 195。
- 底部导航：x 20, y 729, w 335, h 54，圆角 44.653。

深色 AppMarket `95:1783`：

- 画板：375 x 2088。
- 背景：`#0D0F1C`。
- 顶部状态栏：h 44。
- 顶部 AppMarket 区：y 44-159。
- Hero banner：x 16, y 159, w 343, h 155.5，圆角 24。
- 统计卡：x 16, y 330.5, w 343, h 134，背景 `#161928`，边框 `#2A2D45`。
- 热门分类：y 484.5，横向卡片 82 x 113。
- 热门排行、编辑精选、最新推荐为纵向内容区。
- 底部导航：y 2025, h 63，背景 `#0D0F1C`，上边框 `#2A2D45`。

## 6. Prototype 交互

浅色默认主界面 `266:21147`：

- Mibo 入口：ON_CLICK -> `164:6118`，SLIDE_IN LEFT，0.6s，EASE_IN。项目内映射为 `router.push('/chatbot')`。
- 头像：ON_HOVER -> `188:16287`，SMART_ANIMATE，1.022s，GENTLE。移动端映射为 press/long press 的头像强调态。
- 词云：ON_PRESS -> `188:16759`，SMART_ANIMATE，1.022s，GENTLE。移动端映射为 press 切换词云状态。
- App Gallery 卡：ON_HOVER -> `268:22904`，SMART_ANIMATE，0.6388s，GENTLE。移动端映射为 press 展开，再次 press 或卡片 CTA 进入 `/app-gallery`。
- 我的产品卡：ON_HOVER -> `268:23238`，SMART_ANIMATE，0.6388s，GENTLE。移动端映射为 press 展开；目标页未在当前路由注册时不新增业务页。
- 广场卡：ON_HOVER -> `268:23572`，SMART_ANIMATE，0.6388s，GENTLE。移动端映射为 press 展开；目标页未在当前路由注册时不新增业务页。
- 个人主页卡：ON_HOVER -> `268:23906`，SMART_ANIMATE，0.6388s，GENTLE。移动端映射为 press 展开；目标页未在当前路由注册时不新增业务页。
- 展开态 App Gallery 内部点击 -> `168:6258`，SLIDE_IN TOP，0.3s，EASE_IN_AND_OUT。项目内映射为 `/app-gallery`。
- 若干箭头/设置实例：ON_HOVER CHANGE_TO `248:20537`，CUSTOM_SPRING mass 1, stiffness 145, damping 11.4。移动端映射为 press scale/spring。

## 7. 依赖策略

本轮先不新增依赖，优先使用：

- React Native `Animated`
- React Native `Pressable`
- React Native `Image`
- `react-native-safe-area-context`

如果后续为了更接近 Figma 的真实渐变、玻璃模糊或 SVG 图标必须新增依赖，优先候选：

- `expo-linear-gradient`：真实渐变。
- `expo-blur`：玻璃拟态模糊。
- `react-native-svg`：SVG 图标。

新增依赖前必须说明用途、替代方案和影响范围。

## 8. 实现步骤

1. 更新 `background/main_ui_prompt/**`，完成 prompt-first 约束。
2. 创建移动端主界面组件目录和 token/motion/types/assets 文件。
3. 从 `index.tsx` 拆出移动端主界面，保留 Web 端逻辑。
4. 实现浅色默认首屏静态布局。
5. 实现浅色卡片展开、词云切换、Mibo 跳转和底部导航入口。
6. 实现深色 AppMarket 长页，提供浅色/深色切换入口。
7. 跑 TypeScript 检查。
8. 如环境允许，启动 Expo 并用移动端环境验收；Web 预览仅作辅助。

## 9. 验证标准

- `cd frontend && npx tsc --noEmit` 通过。
- Web 分支仍然渲染现有 Web 首页。
- 移动端 `index` 渲染主界面，不再把所有 UI 堆在 `index.tsx`。
- 浅色首屏与 `266:21147` 匹配主要区域、尺寸、颜色、文字、卡片层级。
- 浅色卡片交互覆盖 `268:22904/23238/23572/23906` 的展开逻辑。
- 深色模式覆盖 `95:1783` 的 AppMarket 长页核心区域。
- 未确认的跳转不擅自新增业务页面。

## 10. 待确认问题

- 深色模式是否需要默认进入，还是由用户切换进入。本轮先提供顶部切换入口，默认跟随系统色彩。
- 我的产品、广场、个人主页是否需要新增真实路由。本轮只做主界面入口和展开态，不新增业务页。
- 是否允许后续新增 `expo-linear-gradient` / `expo-blur` / `react-native-svg` 追求更高还原度。本轮先不新增。
