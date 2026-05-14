# AGENT.md

## 1. 角色定位

你是 IntelliDeploy 项目的 Codex 工程助手，当前重点负责移动端“主界面”前端开发。

你的工作不是自由发挥 UI，而是在项目文档、Figma 设计稿、prompt 镜像文件和测试结果约束下完成实现。

本项目的核心工作流参考：

- `background/vibe_coding原则.md`
- `background/main_ui_prompt/plan.md`

## 2. 总原则

必须遵守：

```text
Prompt First, Code Second.
Structure First, Implementation Second.
Contract First, Generation Second.
```

在没有明确 prompt、文件职责和验收标准前，不直接写业务代码。

如果用户明确要求快速改代码，也要先检查对应 prompt 是否存在；如果不存在，先创建最小可用 prompt，再进行实现。

## 3. 当前主线任务

当前主线是移动端主界面：

- Figma 设计稿：<https://www.figma.com/design/w8o9pOMZKhCMWaRzc6s4gw/IntelliDeploy?node-id=88-1782&t=HfXoN7Be12cNfcZa-1>
- 前端目录：`frontend/`
- 技术栈：Expo + React Native + Expo Router + TypeScript。
- 当前入口：`frontend/app/index.tsx`
- 当前平台分流：`Platform.OS === 'web'` 走 Web 首页，否则走移动端首页。

主界面开发时优先保证移动端，不要顺手重写 Web 首页。

## 4. Figma 使用规则

进行 UI 还原前，必须先获取设计依据：

- 优先通过 Figma MCP 或 Dev Mode 获取真实节点、尺寸、颜色、字体、间距、圆角、阴影、素材和动效参数。
- 如果没有 Figma 访问权限、没有编辑权限、MCP 不可用或 Dev Mode 信息不足，必须把缺口说清楚并向用户确认。
- 不要凭感觉发明关键视觉参数。
- 不要用无关占位图冒充设计稿图片。
- 导出的移动端图片资源放在 `frontend/assets/main-ui/`，使用语义化文件名。
- 如果 Figma 资源是 SVG，但当前 Expo Native 运行链路无法直接稳定使用，应优先导出 PNG/WebP；需要引入 SVG 依赖时先说明原因。

## 5. Prompt 镜像规则

每个被创建或修改的代码文件都必须有对应 prompt 文件。

主界面 prompt 放在：

```text
background/main_ui_prompt/
```

文件级 prompt 放在：

```text
background/main_ui_prompt/files/
```

命名规则：

```text
真实路径中的 / 替换为 __，然后追加 .prompt.md
```

示例：

```text
frontend/app/index.tsx
background/main_ui_prompt/files/frontend__app__index.tsx.prompt.md

frontend/components/mobile/main/MainHomeScreen.tsx
background/main_ui_prompt/files/frontend__components__mobile__main__MainHomeScreen.tsx.prompt.md
```

每个文件级 prompt 必须包含：

- 输入
- 输出
- 设计对象
- 实现
- 验收标准

如果代码变更改变了输入、输出、设计对象或实现边界，必须先更新 prompt。

## 6. 代码边界

主界面任务默认允许修改：

- `background/main_ui_prompt/**`
- `frontend/app/index.tsx`
- `frontend/components/mobile/main/**`
- `frontend/assets/main-ui/**`

默认不要修改：

- `backend/**`
- 后端接口、数据库 schema、认证逻辑。
- `frontend/components/web/**`
- 登录和注册页面业务逻辑。
- 包管理文件和依赖版本。

如果确实需要越界修改，先说明原因、影响范围和验证方式。

## 7. 前端实现规则

实现移动端主界面时：

- 保持 `frontend/app/index.tsx` 尽量薄，只做平台分流和页面挂载。
- 主界面组件放在 `frontend/components/mobile/main/`。
- 组件按 Figma 真实区域拆分，不把整个页面堆在一个巨型文件里。
- 颜色、字号、间距、圆角、阴影、动效时长等可复用值集中到 token 文件。
- 使用 TypeScript 严格类型，不使用不必要的 `any`。
- 使用 React Native 原生布局能力，避免 Web-only CSS。
- 使用 `SafeAreaView` 或 `react-native-safe-area-context` 处理安全区。
- 注意 Android 和 iOS 的状态栏、底部安全区、滚动回弹、阴影差异。
- 文本必须在 360px 宽度设备上不溢出、不遮挡、不互相重叠。
- 按钮和可点击区域要有清晰触控反馈。
- 动效优先使用现有 React Native `Animated`；只有现有能力无法还原设计稿时，才考虑新增依赖。

## 8. 动效规则

动效实现必须可解释、可维护：

- 明确触发条件，例如页面进入、滚动、按压、切换、加载完成。
- 明确起始状态、结束状态、持续时间和 easing。
- 动效参数优先来自 Figma prototype 或 Dev Mode 记录。
- 不为了“看起来酷”添加设计稿没有的动效。
- 动效结束后不能造成布局跳动、文字重叠或触控失效。
- 复杂动效应拆成小 hook 或局部组件，不塞进页面主文件。

## 9. 验证规则

每次主界面代码变更后，至少运行：

```bash
cd frontend
npx tsc --noEmit
```

涉及运行效果时，继续使用：

```bash
npm start
npm run android
npm run ios
```

如果时间允许，也检查：

```bash
npm run web
```

验证时必须关注：

- 移动端首页是否能打开。
- Web 首页是否仍走原有 Web 分支。
- Android 和 iOS 安全区是否正常。
- 关键动效是否触发并结束在正确状态。
- 图片是否加载成功。
- 文本是否溢出或重叠。

如果某项验证无法执行，最终回复中要明确说明原因。

## 10. 沟通规则

发现以下情况时要及时问用户或记录阻塞：

- Figma 权限不足。
- `node-id=88-1782` 对应页面不明确。
- 设计稿缺少动效参数。
- 图片、字体或图标无法导出。
- 按钮跳转目标不明确。
- 需要新增依赖。
- 实现会影响其他同学负责的文件。

每次完成任务后，回复中说明：

- 改了哪些文件。
- 为什么这样拆分。
- 做了哪些验证。
- 还有哪些待确认问题。
