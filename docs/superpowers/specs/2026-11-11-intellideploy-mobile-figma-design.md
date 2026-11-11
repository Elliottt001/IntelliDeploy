# IntelliDeploy 移动端 Figma 渐进重构设计

日期：2026-11-11

状态：设计已逐段确认，等待书面规格复核

设计来源：`/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/`

## 1. 目标

在现有 `frontend/` Expo + React Native 客户端中，按 Figma 正式移动端设计渐进重构六类页面，同时保留已经接通的认证、应用、任务、社区、额度和实例业务链路。

本次设计遵循以下原则：

- Figma 是正式页面的视觉、布局和动效基准，不是业务事实来源。
- 保留共享 API Client、SecureStore、草稿、幂等键、前后台轮询和错误语义，不另写第二套业务链路。
- 正式页面使用原生 React Native 布局和本地资源，不使用整页截图、临时 Figma URL 或整张 `375x812` 画布缩放。
- UI 只显示真实 API 可证明的数据；缺少评分、点赞、评论、下载量或在线人数时隐藏字段或显示中性文案。
- 四类缺少正式稿的页面不阻塞功能开发，但在补稿前不得通过最终视觉验收。
- 原生设备行为、安全区、键盘、返回导航和任务恢复与静态截图同等重要。

## 2. 范围

### 2.1 六类正式页面

本规格实现以下页面家族：

1. 登录：以移动 PDF `page-01` 为正式视觉基准。
2. 首页：以 `page-02` 为正式视觉基准，并参考 `page-29` 至 `page-35` 的卡片展开状态。
3. 应用商店：以 `page-03` 为应用详情轮播基准，以 `page-40` 为热门榜单基准。
4. Mibo Chatbot：以 `page-46` 至 `page-55` 和 `page-58` 为初始、分析、构建及完成状态基准。
5. 我的产品：以 `page-56` 和 `page-57` 为收藏文件夹关闭与展开状态基准。
6. 社区广场：以 `page-59` 和 `page-60` 为横向发现流与精选话题基准。

上述页码对应 `mobile/移动端UI.pdf` 和 `mobile/pages/page-XX.png`。`产出区域`中的登录、首页和 App Gallery 用于确认主要方向；`浅色模式`中的高保真变体用于补齐完整页面状态。

### 2.2 功能继续、视觉待补

以下页面继续保持真实功能、共享视觉基础和可访问性，但标记为 `VISUAL_PENDING`，不阻塞六类正式页面开发：

- `/register`：注册。
- `/billing`：额度、套餐和用量。
- `/app-detail/[id]`：应用交付详情、继续调整、实例操作和发布设置。
- `/community/[id]`：公开应用详情、收藏和创建副本。

补充正式稿后，这四类页面进入独立视觉验收，不回滚或伪装当前功能状态。

### 2.3 不包含

- 新增社交帖子、评论或点赞后端协议。
- 接入 Google、GitHub 或 Apple 原生登录协议。
- 修改 Job、App、Publication、Quota 或 Instance 后端契约。
- 为整个产品补齐暗色主题。
- 修改生成、构建、发布或计费业务规则。
- 将 Figma 示例数据写入真实 API 或数据库。

## 3. 已确认的产品决策

- 使用“渐进式页面重构 + 共享移动设计系统”。
- 继续使用 Expo Router，不建立 `v2` 路由树或第二套客户端。
- 新增 `/store` 作为公共应用商店。
- `/app-gallery` 保留“我的应用/我的产品”语义。
- `/community` 使用广场视觉；在独立社交 Feed 协议出现前，用公开应用、作者和摘要构成真实可操作的发现卡片。
- `/library/favorites` 作为我的收藏列表，从“我的产品”进入。
- 首页四个主要入口分别进入 `/store`、`/app-gallery`、`/community` 和个人/设置入口。
- 正式页面以浅色稿为准。深色登录和应用商店仅作为设计参考，不构成全应用暗色要求。
- 任务画面由真实 Job 状态驱动，禁止按固定计时动画伪造阶段或进度。
- 缺失字体不阻塞功能开发，但必须在最终视觉验收前解决授权字体或由设计方确认替代方案。

## 4. 设计依据与门禁

主要设计材料：

- `original/IntelliDeploy.fig`
- `mobile/移动端UI.pdf`
- `mobile/pages/page-01.png` 至 `page-60.png`
- `design-data/移动端UI.nodes.json`
- `design-data/document.kiwi.json`
- `design-data/frames.csv`
- `design-data/text.csv`
- `design-data/fonts.csv`
- `design-data/colors.csv`
- `design-data/raw-assets.json`
- `raw-assets/`

Figma 基准画板为 `375x812pt`。外层约 `40pt` 圆角用于设计稿展示，不作为原生根视图圆角；原生页面由设备屏幕自然裁切。

每个正式页面实施前必须完成以下核对：

1. 定位正式画板及关键节点 ID，记录使用的版本，不混入参考、历史稿或线框样式。
2. 从 Kiwi 节点读取实际坐标、尺寸、字体、字号、字重、行高、颜色、圆角、渐变、描边、阴影和图片引用。
3. 将图片填充的哈希映射到 `raw-assets/` 原始文件，禁止从 512 高的整页导出图中裁切正式素材。
4. 核对对应 PDF 页的最终渲染，解决节点数据与导出结果的差异。
5. 将页面关键节点、素材和基准截图写入仓库内的移动设计证据文件，供视觉测试定位。

## 5. 视觉系统

### 5.1 核心令牌

- 背景：`#EFF3FF` 到 `#FFFFFF` 的浅灰蓝渐变。
- 主色：`#7C62FF`。
- 主要文字：`#494A64`。
- 次要文字：`#7F80A1`。
- 蓝色：`#94ACF6`。
- 粉色：`#FFAFDC`。
- 兰花紫：`#EDAFF6`。
- 浅薰衣草：`#D0C7FE`。
- 表面：白色或低透明度白色玻璃层。
- 常用卡片圆角：`20pt` 至 `30pt`；胶囊和圆形操作使用完整圆角。

令牌必须以正式节点复核后的值为准。以上值是共享主题入口，不代表所有节点只能使用这些颜色。

### 5.2 字体

正式稿主要使用：

- PingFang SC。
- Alibaba PuHuiTi 3.0。
- 字体圈伟君黑 W3。
- Inter。

仓库已有对应 PingFang、Alibaba PuHuiTi、伟君黑和 Inter 文件。设计内零散出现的 Alimama ShuHeiTi、Manrope、Chelsea Market 等字体需先确认正式页面是否实际使用，再补充授权文件或取得设计替代确认。

不得用 emoji 代替正式图标。导航、返回、分享、搜索、通知、麦克风和发送图标使用 Figma 矢量或与节点一致的 Lucide 图标。

### 5.3 适配

- 以 `375pt` 为测量基准，但按安全区内的实际宽度进行响应式布局。
- 不整体缩放字号、触控区域和输入框。
- 小屏允许纵向滚动；大屏限制内容最大宽度并保持插画比例。
- iOS 和 Android 分别处理状态栏、安全区、键盘和返回手势。
- 最小触控区域不小于 `44x44pt`。
- Chatbot 输入栏随键盘上移，并在后台/前台切换时保留草稿和当前任务。

## 6. 路由与页面映射

```text
frontend/app/
  index.tsx                 -> 首页
  login.tsx                 -> 登录
  store.tsx                 -> 公共应用商店
  store/ranking.tsx         -> 热门榜单
  app-gallery.tsx           -> 我的产品
  chatbot.tsx               -> Mibo 创建入口
  app-detail/[id].tsx       -> Mibo 任务与应用详情，VISUAL_PENDING 部分继续可用
  community/index.tsx       -> 社区广场
  community/[id].tsx        -> 公开应用详情，VISUAL_PENDING
  library/[kind].tsx        -> favorites / recent
  register.tsx              -> VISUAL_PENDING
  billing.tsx               -> VISUAL_PENDING
```

首页底部导航：

- 首页：`/`。
- 应用：`/store`。
- 广场：`/community`。
- 我的：`/app-gallery`。

页面内返回、分享和入口跳转统一通过 Expo Router。受保护页面继续遵循根布局鉴权；公开商店和广场可以匿名读取，收藏、副本、我的产品和额度操作按需登录。

## 7. 组件边界

### 7.1 目录设计

```text
frontend/
  design/
    mobileEvidence.ts
  theme/
    tokens.ts
    typography.ts
    responsive.ts
  components/mobile/
    AppBackground.tsx
    BrandHeader.tsx
    CircleAction.tsx
    GlassCard.tsx
    BottomNav.tsx
    MiboStage.tsx
    ChatComposer.tsx
    JobProgress.tsx
    EmptyState.tsx
    ErrorState.tsx
  features/
    auth/
    home/
    store/
    chatbot/
    products/
    community/
```

### 7.2 职责

- `theme/` 只定义设计令牌、字体和尺寸换算，不访问路由或 API。
- `components/mobile/` 是纯视觉或通用交互组件，通过 props 接收状态，不直接请求远程数据。
- `features/` 负责页面结构、数据转换和用户操作。
- `screens/` 或路由入口负责调用现有 services、订阅 Job、处理鉴权跳转和把数据传给 feature 组件。
- `services/` 保持当前传输、鉴权、草稿和轮询职责，不吸收布局逻辑。

避免建立一个通过大量布尔参数渲染六类页面的通用巨型组件。共享发生在令牌、基础表面、导航和状态组件层，不强迫页面结构一致。

## 8. 页面设计

### 8.1 登录

- 使用品牌栏、Mibo 猫形角色、主标题、用户名/邮箱输入、密码输入、协议确认、记住我、登录按钮和注册链接。
- 当前用户名密码接口保持不变。
- Google、GitHub、Apple 按钮完成正式视觉和可访问性；在认证协议未接入前保持禁用或明确提示“暂未开放”，禁止模拟成功。
- 登录失败保留输入并显示后端公开错误；登录中使用设计稿过渡视觉，但以真实请求生命周期结束。
- 设置按钮只打开真实存在的偏好、语言或联系入口；未实现项不生成空页面。

### 8.2 首页

- 顶部展示品牌、用户问候和 Mibo 入口。
- 灵感池使用前端可维护的安全提示词建议，不伪装成实时榜单。
- App Gallery、我的产品、广场和个人/设置卡片使用真实路由。
- 卡片展开状态保留 Figma 的层叠与玻璃质感，展开后只展示可操作的真实入口。
- 底部导航固定在安全区上方。

### 8.3 应用商店

- `/store` 使用公开 Publication 数据。
- 搜索在已有接口未支持服务端搜索时，先对当前已加载页面做本地过滤并明确分页边界，不声称完成全库检索。
- 分类和筛选只提供真实可计算的选项；无字段支持的筛选不展示。
- 卡片显示名称、摘要、作者和可用状态。评分、下载量、评论量和奖项没有真实来源时隐藏。
- 点赞、收藏和评论入口只在对应 API 存在时可操作；当前已支持收藏时复用真实收藏 API。
- `/store/ranking` 的排序只使用可证明字段并明确排序口径，不能把 Figma 示例名次写成实时榜单。

### 8.4 Mibo Chatbot

Chatbot 继续使用现有创建、消息、Job 读取、取消、恢复和草稿逻辑。视觉状态映射为：

| Job 状态/阶段 | 移动视觉 |
| --- | --- |
| 无任务 | Mibo 问候和快捷需求建议 |
| `QUEUED` | Mibo 思考，文案为“任务已提交” |
| `RUNNING/clarifying` | 正在理解需求 |
| `RUNNING/retrieving` | 正在准备应用 |
| `RUNNING/implementing` | 需求分析步骤，按真实阶段点亮 |
| `RUNNING/building` | 正在构建应用，不显示伪造依赖列表 |
| `RUNNING/validating` | 正在验证功能 |
| `RUNNING/deploying` | 正在发布应用 |
| `RUNNING/verifying_live` | 正在验证使用入口 |
| `WAITING_USER` | 展示后端问题并开放输入 |
| `PAUSED_QUOTA` | 显示额度暂停和恢复操作 |
| `SUCCEEDED` | `page-58` 完成视觉和真实应用入口 |
| `FAILED` | 明确失败原因和可执行下一步 |
| `CANCELLED` | 明确取消状态和重新开始入口 |

后端 `phase` 不认识时使用“正在处理需求”，不得推断完成。客户端不生成虚构百分比、依赖包、验收通过项或发布地址。

### 8.5 我的产品

- `/app-gallery` 读取当前用户真实 Apps。
- 默认文件夹视觉对应 `page-56`；有内容时对应 `page-57`，应用图标来自真实应用或统一占位图。
- 点击文件夹进入应用列表；点击应用进入 `/app-detail/[id]`。
- 收藏文件夹进入 `/library/favorites`，最近使用进入 `/library/recent`。
- 空列表使用同一视觉体系的真实空状态，不在文件夹中塞入示例应用。

### 8.6 社区广场

- `/community` 继续读取公开 Publication。
- Publication 映射为发现卡片：应用名、作者、摘要、可用状态和真实缩略图。
- 横向滑动和精选大卡片保持 Figma 布局，但不展示无来源的点赞、评论、阅读人数和发布时间。
- 卡片进入 `/community/[id]`；匿名用户可浏览，收藏和副本操作按既有规则要求登录。
- 后续如果新增社交帖子协议，应另写规格，不在当前前端中预埋不可验证的帖子模型。

## 9. 数据与安全边界

- 认证 token 继续由原生 SecureStore 保存；浏览器预览使用现有独立适配。
- 401 清理失效 token、保留草稿并进入登录。
- 402 显示额度暂停，不在客户端自行增加额度或重算费用。
- 409 回读最新 App/Job/Instance 状态，不重复创建任务。
- 网络失败显示重试状态，不改变后端 Job 终态。
- 创建、消息、副本和实例操作继续使用幂等键。
- 页面不得记录 token、凭据、私有对话、内部路径或完整错误响应到日志。
- 分享只使用后端公开且允许分享的 URL；私有应用不得构造公开链接。

## 10. 错误和降级

- 加载中使用与页面匹配的骨架或 Mibo 状态，不使用无限空白页。
- 空数据使用真实空态和明确行动入口。
- API 暂时失败显示重试按钮和简明错误，不将 fixture 当远程结果。
- 图片失败使用本地中性占位图并保持布局稳定。
- 缺少可选字段时隐藏对应 UI，不以 `0` 冒充真实统计。
- 四类 `VISUAL_PENDING` 页面沿用共享背景、顶部操作和基础表面，但不声称达到 Figma 像素验收。

## 11. 测试与验收

### 11.1 TDD

每个实施切片遵循 RED-GREEN-REFACTOR：

1. 先写设计令牌、路由、状态映射或组件行为测试。
2. 运行测试并确认因目标能力缺失而失败。
3. 实现最小代码使测试通过。
4. 重构并运行完整移动端测试套件。

### 11.2 自动化

- Vitest：令牌、尺寸换算、Job 视觉状态、数据缺项、路由目标和交互状态。
- Playwright Expo Web：六类页面的关键导航、匿名/登录边界和 `375x812` 基准截图。
- 现有跨端 E2E：保留真实 app/job/conversation/publication/copy/instance ID 共享检查。
- Maestro 或实机记录：登录、键盘、返回、前后台恢复、创建、追问、完成、商店、产品和广场。
- TypeScript：`npm --workspace frontend run typecheck`。
- 打包：Expo iOS、Android 和 Web export。

### 11.3 视觉门禁

六类正式页面：

- 固定设计基准页和目标设备尺寸。
- 保存稳定截图并与 Figma 渲染进行叠图或像素差异检查。
- 检查字体、文字基线、间距、圆角、阴影、渐变、素材裁切、安全区和键盘状态。
- iOS 与 Android 都进行原生检查，Expo Web 截图不能代替原生通过。

四类 `VISUAL_PENDING` 页面：

- 功能测试、类型检查、可访问性和共享样式必须通过。
- 视觉报告明确为 `NOT_RUN` 或 `VISUAL_PENDING`。
- 补稿后再建立正式基准，不将当前共享样式截图追认为设计验收。

## 12. 实施顺序

1. 固化设计证据、本地素材和共享令牌。
2. 建立基础移动组件和响应式工具。
3. 重构根导航、公开/受保护路由和底部导航。
4. 实现登录与首页。
5. 新增应用商店和热门榜单。
6. 实现 Mibo Chatbot 全状态。
7. 实现我的产品和收藏入口。
8. 实现社区广场。
9. 给 `VISUAL_PENDING` 页面接入共享视觉基础。
10. 运行完整单元、跨端、视觉、原生和打包验收。

每个阶段必须保持现有业务链路可运行，不以一次性大爆炸替换全部页面。

## 13. 成功标准

- 六类正式页面使用本地资源和原生布局，与指定 Figma 基准在目标设备上视觉一致。
- 页面宽度变化、安全区和键盘不会破坏布局或遮挡操作。
- 登录、创建、任务恢复、业务追问、完成交付、公开浏览、收藏和我的应用继续使用真实 API。
- Job 状态、失败、额度暂停和未知阶段均诚实呈现。
- `/store`、`/app-gallery` 和 `/community` 业务语义清晰，不再混用同一路由。
- 自动化测试、类型检查和 Expo 打包通过。
- 四类缺稿页面功能不退化，并明确保持 `VISUAL_PENDING`，直到补充正式设计并完成独立视觉验收。
