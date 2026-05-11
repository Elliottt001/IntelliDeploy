# IntelliDeploy 接口文档 (API Specification)

> 版本: v1.0  
> 最后更新: 2026-05-06  
> 维护者: IntelliDeploy 后端团队  
> 适配对象: IntelliDeploy 移动端 / Web 前端 (Expo + React Native)

---

## 0. 总览 (Overview)

### 0.1 基础信息

| 项 | 值 |
| --- | --- |
| Base URL (开发) | `http://<host>:8000` |
| Base URL (生产) | `https://api.intellideploy.com` |
| 协议 | HTTPS / WSS |
| 认证方式 | Bearer Token (JWT, OAuth2 Password Bearer) |
| 数据格式 | `application/json; charset=utf-8` |
| 时间格式 | ISO-8601 (UTC),  例如 `2026-05-06T03:14:25Z` |
| 字段命名 | 后端模型用 snake_case，对外 JSON 统一使用 **camelCase**（与现有 `routers/intellideploy/projects.py` 输出风格一致） |
| 文档自动生成 | FastAPI 自动 OpenAPI: `/docs`, `/redoc`, `/openapi.json` |

### 0.2 鉴权约定

- 除登录、注册、隐私协议、APP Gallery 公共浏览类接口外，**所有接口均需要在 HTTP Header 中携带 JWT**：
  ```
  Authorization: Bearer <access_token>
  ```
- Token 通过 `POST /auth/login` 或 `POST /auth/oauth/google` 等登录接口获取。
- Token 失效时返回 `401 Unauthorized`，前端应跳转登录页。

### 0.3 通用响应结构

成功响应：返回业务数据对象（顶层为对象/数组，不强制 wrap）。
失败响应（统一）：

```json
{
  "error": "Human-readable message",
  "code": "OPTIONAL_MACHINE_CODE",
  "details": { }
}
```

> 已存在的 `auth` 接口走 FastAPI 默认 `{"detail": "..."}`，业务接口（`/api/...` 前缀）走 `{"error": "..."}`，由 `app/main.py:50` 的全局异常处理器决定。

### 0.4 HTTP 状态码约定

| Code | 含义 |
| --- | --- |
| 200 | 成功 |
| 201 | 资源创建成功 |
| 204 | 成功无内容 (用于删除/操作类) |
| 400 | 业务参数校验失败 |
| 401 | 未登录或 Token 失效 |
| 403 | 已登录但无权访问该资源 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复点赞、重复上架） |
| 422 | Pydantic 校验失败 |
| 429 | 限流（验证码/登录） |
| 500 | 服务器内部错误 |

### 0.5 分页约定

所有列表接口默认支持游标分页：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `cursor` | string | 否 | 上一页返回的 `nextCursor`，首页不传 |
| `limit` | int | 否 | 默认 20，最大 100 |
| `order` | enum | 否 | `latest`/`hot`/`top`，默认 `latest` |

返回结构：
```json
{
  "items": [...],
  "nextCursor": "eyJpZCI6MTAwMH0=",
  "hasMore": true
}
```

### 0.6 模块划分

| 模块 | Prefix | 对应 PRD 页面 |
| --- | --- | --- |
| Auth | `/auth` | 1. 登录页 |
| Home | `/api/home` | 2. 首页 |
| Chatbot / Generation | `/api/chat`, `/api/generation`, `/api/projects` | 3. AI Chatbot 页 |
| Gallery | `/api/gallery`, `/api/apps` | 4. APP Gallery |
| AppDetail | `/api/apps/{appId}` | 5. APP 介绍页 |
| MyProducts | `/api/me/products` | 6. 我的产品 |
| Profile | `/api/me`, `/api/users/{userId}` | 7. 个人主页 |
| Plaza (广场) | `/api/plaza` | 8. 广场页 |
| Common | `/api/uploads`, `/api/notifications`, `/api/policy` | 通用 |
| Realtime | `/ws/...` | 多页面 |

---

## 1. 登录页 (Auth)

### 1.1 隐私协议获取
仅用于点击「《隐私协议》」蓝色文字弹窗内容。

`GET /api/policy/privacy`

| Query | 说明 |
| --- | --- |
| `version` (可选) | 默认返回 latest |

Response 200:
```json
{
  "version": "2026-05-01",
  "title": "IntelliDeploy 隐私协议",
  "contentMarkdown": "# ...",
  "effectiveAt": "2026-05-01T00:00:00Z"
}
```

### 1.2 发送手机验证码
`POST /auth/sms/send-code`

Request:
```json
{
  "phone": "+8613800001111",
  "scene": "login"   // login | register | bind
}
```

Response 200:
```json
{
  "success": true,
  "expiresIn": 300,        // 验证码 5 分钟有效
  "resendAfter": 60        // 60s 后才允许重新获取
}
```

错误：
- `400 INVALID_PHONE`
- `429 RATE_LIMITED`：未到 60s 倒计时

### 1.3 手机号 + 验证码登录
`POST /auth/sms/login`

Request:
```json
{
  "phone": "+8613800001111",
  "code": "874201",
  "agreedPrivacyVersion": "2026-05-01"   // 必填，未勾选则前端阻断
}
```

Response 200:
```json
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "bearer",
  "expiresIn": 3600,
  "user": {
    "id": "1",
    "username": "u_8801f3",
    "nickname": "新用户",
    "avatarUrl": "https://cdn.../default.png",
    "isNewUser": true
  }
}
```

错误：
- `400 INVALID_CODE` / `400 CODE_EXPIRED`
- `400 PRIVACY_NOT_AGREED`

### 1.4 Google OAuth 登录

#### 1.4.1 取授权 URL（前端无法直接使用 SDK 时）
`GET /auth/oauth/google/url`

Query: `redirectUri=intellideploy://oauth/google`

Response 200:
```json
{ "authorizeUrl": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```

#### 1.4.2 用 Google Authorization Code 换取应用 Token
`POST /auth/oauth/google`

Request:
```json
{
  "code": "4/0AY0e-g6...",           // Google 返回的 authorization code
  "redirectUri": "intellideploy://oauth/google",
  "agreedPrivacyVersion": "2026-05-01"
}
```

Response 200: 与 1.3 相同。

错误：
- `400 OAUTH_EXCHANGE_FAILED`
- `403 EMAIL_NOT_VERIFIED`

### 1.5 用户名/邮箱注册（保留现有接口）
`POST /auth/register`

> 来源：[backend/app/routers/auth.py:17](../backend/app/routers/auth.py#L17)

Request:
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "P@ssw0rd"
}
```

Response 201:
```json
{
  "id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "isActive": true,
  "createdAt": "2026-05-06T03:14:25Z"
}
```

### 1.6 用户名密码登录（保留）
`POST /auth/login`

> 来源：[backend/app/routers/auth.py:48](../backend/app/routers/auth.py#L48)

Request:
```json
{ "username": "alice", "password": "P@ssw0rd" }
```

Response 200:
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

### 1.7 当前用户信息
`GET /auth/me`

> 来源：[backend/app/routers/auth.py:62](../backend/app/routers/auth.py#L62)

Response 200:
```json
{
  "id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "isActive": true,
  "createdAt": "2026-05-06T03:14:25Z"
}
```

### 1.8 退出登录
`POST /auth/logout`

Header: `Authorization: Bearer <token>`

Response 204 (无 Body)

> 服务端将 Token 加入 Redis 黑名单直到过期。

---

## 2. 首页 (Home)

### 2.1 首页聚合数据
**单接口聚合返回首页所有动态内容**，减少首屏请求次数。

`GET /api/home/feed`

Response 200:
```json
{
  "greeting": {
    "userId": "1",
    "nickname": "alice",
    "avatarUrl": "https://cdn.../avatar.png",
    "mascotUrl": "https://cdn.../mascot.png",
    "bubbleText": "今天又有什么新想法？",  // 由后端按 dailyTip 池随机
    "dailyTipId": "tip_2026_05_06_03"
  },
  "inspirationPool": {
    "title": "今日灵感",
    "keywords": [
      { "keyword": "AI 翻译", "rank": 1, "rankingId": "ranking_translate" },
      { "keyword": "周报生成器", "rank": 2, "rankingId": "ranking_weekly" }
    ]
  },
  "navCards": [
    { "key": "gallery", "title": "APP Gallery", "iconUrl": "...", "route": "/gallery" },
    { "key": "myProducts", "title": "我的产品", "iconUrl": "...", "route": "/me/products" },
    { "key": "plaza", "title": "广场", "iconUrl": "...", "route": "/plaza" },
    { "key": "profile", "title": "个人主页", "iconUrl": "...", "route": "/me" }
  ]
}
```

### 2.2 灵感池关键词详情（榜单）
`GET /api/home/rankings/{rankingId}`

Response 200:
```json
{
  "rankingId": "ranking_translate",
  "keyword": "AI 翻译",
  "updatedAt": "2026-05-06T00:00:00Z",
  "apps": [
    {
      "appId": "app_001",
      "name": "TranslatePro",
      "coverUrl": "...",
      "rank": 1,
      "score": 4.8,
      "deployCount": 1240
    }
  ]
}
```

### 2.3 提示气泡换一句
`POST /api/home/daily-tip/refresh`

Response 200:
```json
{ "dailyTipId": "tip_2026_05_06_07", "bubbleText": "试试用一句话生成你的工具吧～" }
```

---

## 3. AI Chatbot 页 (核心工作流)

> Chatbot 内部依次触发：
> 1. 创建 / 复用 Chat Session  
> 2. 发送用户消息（或粘贴 GitHub URL）  
> 3. 后端调度生成任务（沿用 [backend/app/routers/intellideploy/generation.py](../backend/app/routers/intellideploy/generation.py)）  
> 4. 通过 WebSocket 推送分步进度  
> 5. 完成后返回 APP 卡片（绑定到具体 deployment / app）

### 3.1 创建会话
`POST /api/chat/sessions`

Request:
```json
{ "title": "新的会话" }
```

Response 201:
```json
{
  "sessionId": "sess_abc123",
  "title": "新的会话",
  "createdAt": "2026-05-06T03:14:25Z"
}
```

### 3.2 会话消息列表（分页，含历史回放）
`GET /api/chat/sessions/{sessionId}/messages?cursor=&limit=`

Response 200:
```json
{
  "items": [
    {
      "messageId": "msg_001",
      "role": "user",          // user | assistant | system
      "type": "text",          // text | github_link | status_card | app_card | error
      "content": { "text": "帮我做一个 todo list 应用" },
      "createdAt": "2026-05-06T03:14:25Z"
    },
    {
      "messageId": "msg_002",
      "role": "assistant",
      "type": "status_card",
      "content": {
        "taskId": "task_xx",
        "phases": [
          { "key": "MATCH_REPO",  "label": "🔍匹配开源仓库中", "status": "succeeded" },
          { "key": "BUILD_ENV",   "label": "⚙️构建云端环境中", "status": "running" },
          { "key": "LAUNCH",      "label": "🚀拉起服务实例",   "status": "pending" }
        ]
      },
      "createdAt": "2026-05-06T03:14:30Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

### 3.3 发送消息（自然语言或 GitHub 链接）
`POST /api/chat/sessions/{sessionId}/messages`

Request：
```json
{
  "type": "text",                          // text | github_link | voice
  "content": { "text": "帮我搭一个个人博客" },
  "voiceUrl": null,                        // type=voice 时传，由 3.6 上传得到
  "githubUrl": null,                       // type=github_link 时传
  "preferredStack": {                      // 可选，提示偏好（沿用 fallback schema）
    "frontend": "next.js",
    "backend": null,
    "database": null,
    "runtime": "node20"
  }
}
```

Response 202 Accepted：
```json
{
  "messageId": "msg_003",
  "taskId": "task_xx",
  "deploymentId": null,
  "intent": "NL_GENERATE",                 // NL_GENERATE | GITHUB_DEPLOY
  "phases": [
    { "key": "MATCH_REPO", "label": "🔍匹配开源仓库中", "status": "running" },
    { "key": "BUILD_ENV",  "label": "⚙️构建云端环境中", "status": "pending" },
    { "key": "LAUNCH",     "label": "🚀拉起服务实例",   "status": "pending" }
  ],
  "wsTopic": "/ws/chat/sess_abc123"
}
```

> 当 `type = github_link` 时，phases 第 1 步标签自动改为 `检索GitHub仓库中`。

### 3.4 取消任务
`POST /api/chat/sessions/{sessionId}/tasks/{taskId}/cancel`

Response 200:
```json
{ "taskId": "task_xx", "status": "FAILED", "message": "已取消" }
```

### 3.5 任务状态轮询（WebSocket 不可用时降级）
`GET /api/generation/status/{taskId}`

> 已存在：[backend/app/routers/intellideploy/generation.py:45](../backend/app/routers/intellideploy/generation.py#L45)

Response 200 (`QueryTaskStatusResponse`)：
```json
{
  "task_id": "task_xx",
  "project_id": "12",
  "deployment_id": "33",
  "status": "RUNNING",
  "current_stage": "BUILD_ENV",
  "progress_message": "构建镜像中…",
  "artifact_ready": false,
  "updated_at": "2026-05-06T03:15:00Z",
  "error_code": null,
  "error_message": null,
  "recoverable": null
}
```

### 3.6 上传语音（麦克风消息）
`POST /api/uploads/voice`  (`multipart/form-data`)

| Field | 类型 |
| --- | --- |
| `file` | binary (m4a / wav, ≤ 60s, ≤ 5MB) |

Response 200:
```json
{ "voiceUrl": "https://cdn.../voice/xxx.m4a", "transcript": "帮我做一个待办..." }
```

### 3.7 任务结束后的 APP 卡片获取
当 status `SUCCEEDED` 时，前端用以下接口拿最终卡片：

`GET /api/generation/artifact/{taskId}`

> 已存在：[backend/app/routers/intellideploy/generation.py:66](../backend/app/routers/intellideploy/generation.py#L66)

Response 200 (`GetArtifactResultResponse`)，详见 [backend/app/schemas/fallback.py:179](../backend/app/schemas/fallback.py#L179)。

### 3.8 一键将聊天结果上架到 Gallery
`POST /api/apps`

Request:
```json
{
  "deploymentId": 33,
  "title": "我的极简博客",
  "description": "支持 Markdown 与暗色模式",
  "category": "blog",
  "tags": ["nextjs", "blog"],
  "coverUrl": "https://cdn.../cover.png",
  "screenshots": ["https://cdn.../1.png"],
  "visibility": "public"        // public | unlisted | private
}
```

Response 201:
```json
{
  "appId": "app_001",
  "shareUrl": "https://intellideploy.app/a/app_001"
}
```

### 3.9 一键分享
`GET /api/apps/{appId}/share`

Response 200:
```json
{
  "shareUrl": "https://intellideploy.app/a/app_001",
  "qrCodeUrl": "https://cdn.../qr/app_001.png",
  "shareTitle": "看看我用 IntelliDeploy 30 秒做的应用！"
}
```

### 3.10 项目-部署关系（已有）
- `POST /api/projects` → 通过 GitHub URL 创建项目（已实现）
- `POST /api/projects/{id}/analyze` / `auto-docker` / `auto-yaml` / `deploy` → 已实现
- 详见 [backend/app/routers/intellideploy/projects.py](../backend/app/routers/intellideploy/projects.py)

---

## 4. APP Gallery (云原生应用集市)

### 4.1 应用集市瀑布流
`GET /api/gallery/apps`

| Query | 类型 | 说明 |
| --- | --- | --- |
| `category` | string | 分类 key（见 4.4） |
| `tag` | string | 标签 |
| `keyword` | string | 关键词搜索 |
| `order` | enum | `latest`/`hot`/`top` |
| `cursor`,`limit` | | 分页 |

Response 200:
```json
{
  "items": [
    {
      "appId": "app_001",
      "name": "TranslatePro",
      "summary": "60 种语言互译",
      "coverUrl": "https://cdn.../cover.png",
      "category": "ai_tool",
      "tags": ["ai", "translate"],
      "author": {
        "userId": "12",
        "nickname": "alice",
        "avatarUrl": "..."
      },
      "stats": {
        "likeCount": 320,
        "favoriteCount": 88,
        "commentCount": 17,
        "deployCount": 1240,
        "rating": 4.8
      },
      "viewerInteraction": {
        "liked": false,
        "favorited": false
      },
      "createdAt": "2026-05-04T10:00:00Z"
    }
  ],
  "nextCursor": "eyJpZCI6MTAwMH0=",
  "hasMore": true
}
```

### 4.2 榜单入口
`GET /api/gallery/rankings`

Response 200:
```json
{
  "items": [
    { "rankingId": "weekly_hot",  "name": "本周热门",  "coverUrl": "..." },
    { "rankingId": "daily_new",   "name": "今日新品",  "coverUrl": "..." },
    { "rankingId": "ai_top",      "name": "AI 工具榜", "coverUrl": "..." }
  ]
}
```

### 4.3 榜单详情
`GET /api/gallery/rankings/{rankingId}/apps?cursor=&limit=`

Response 200: 与 4.1 items 同结构，外加 `rank` 字段。

### 4.4 分类树
`GET /api/gallery/categories`

Response 200:
```json
{
  "categories": [
    { "key": "ai_tool",   "name": "AI 工具", "iconUrl": "..." },
    { "key": "blog",      "name": "博客",    "iconUrl": "..." },
    { "key": "dev_tool",  "name": "开发者工具", "iconUrl": "..." }
  ]
}
```

### 4.5 互动 - 点赞 / 取消点赞
`POST /api/apps/{appId}/like`  /  `DELETE /api/apps/{appId}/like`

Response 200:
```json
{ "liked": true, "likeCount": 321 }
```

### 4.6 互动 - 收藏 / 取消收藏
`POST /api/apps/{appId}/favorite`  /  `DELETE /api/apps/{appId}/favorite`

Response 200:
```json
{ "favorited": true, "favoriteCount": 89 }
```

### 4.7 评论列表（半屏弹窗用）
`GET /api/apps/{appId}/comments?cursor=&limit=20&order=latest|hot`

Response 200:
```json
{
  "items": [
    {
      "commentId": "cmt_01",
      "user": { "userId": "12", "nickname": "bob", "avatarUrl": "..." },
      "content": "好用！",
      "rating": 5,                  // 0~5；非评分评论为 0
      "likeCount": 12,
      "viewerInteraction": { "liked": false },
      "replyCount": 2,
      "createdAt": "2026-05-04T10:00:00Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false,
  "totalCount": 17
}
```

### 4.8 发表评论
`POST /api/apps/{appId}/comments`

Request:
```json
{
  "content": "非常棒",
  "rating": 5,                          // 评分评论时填，否则可省略
  "parentCommentId": null               // 二级回复时填
}
```

Response 201:
```json
{ "commentId": "cmt_05", "createdAt": "2026-05-06T03:18:00Z" }
```

### 4.9 评论点赞 / 删除
- `POST /api/comments/{commentId}/like`
- `DELETE /api/comments/{commentId}/like`
- `DELETE /api/comments/{commentId}` （仅作者本人或管理员）

---

## 5. APP 介绍页 (详情)

### 5.1 应用详情
`GET /api/apps/{appId}`

Response 200:
```json
{
  "appId": "app_001",
  "name": "TranslatePro",
  "logoUrl": "https://cdn.../logo.png",
  "summary": "60 种语言互译",
  "description": "## 功能介绍\n...",
  "category": "ai_tool",
  "tags": ["ai", "translate"],
  "rating": 4.8,
  "ratingCount": 132,
  "deployCount": 1240,
  "screenshots": [
    { "url": "https://cdn.../1.png", "order": 1 },
    { "url": "https://cdn.../2.png", "order": 2 }
  ],
  "githubRepo": {
    "owner": "octocat",
    "name": "translate-pro",
    "url": "https://github.com/octocat/translate-pro",
    "stars": 12000,
    "license": "MIT",
    "primaryLanguage": "TypeScript",
    "description": "Open source translator..."
  },
  "versions": [
    {
      "versionId": "v_3",
      "versionNumber": "1.2.0",
      "releaseNotes": "- 修复 zh-Hant\n- 新增暗色模式",
      "releasedAt": "2026-05-01T08:00:00Z",
      "isCurrent": true
    }
  ],
  "currentVersionId": "v_3",
  "deployment": {
    "deploymentId": 33,
    "status": "running",
    "accessUrl": "https://app-001.cloud.sealos.io",
    "ingressDomain": "app-001.cloud.sealos.io"
  },
  "stats": {
    "likeCount": 320,
    "favoriteCount": 88,
    "commentCount": 17
  },
  "viewerInteraction": {
    "liked": false,
    "favorited": false,
    "myRating": null
  },
  "author": { "userId": "12", "nickname": "alice", "avatarUrl": "..." },
  "createdAt": "2026-05-04T10:00:00Z",
  "updatedAt": "2026-05-05T11:00:00Z"
}
```

### 5.2 启动 / 试用 (一键部署副本)
`POST /api/apps/{appId}/launch`

Request (可选):
```json
{ "envOverrides": { "MODEL": "gpt-4o" } }
```

Response 202:
```json
{
  "deploymentId": 99,
  "status": "pending",
  "wsTopic": "/ws/deployments/99"
}
```

### 5.3 版本列表
`GET /api/apps/{appId}/versions`

Response 200:
```json
{
  "items": [
    { "versionId": "v_3", "versionNumber": "1.2.0", "releasedAt": "2026-05-01T08:00:00Z", "isCurrent": true },
    { "versionId": "v_2", "versionNumber": "1.1.0", "releasedAt": "2026-04-20T08:00:00Z", "isCurrent": false }
  ]
}
```

### 5.4 我的评分（轻触滑动评分条）
`PUT /api/apps/{appId}/rating`

Request:
```json
{ "rating": 4.5 }   // 0.5 步进，0~5
```

Response 200:
```json
{ "myRating": 4.5, "rating": 4.81, "ratingCount": 133 }
```

`DELETE /api/apps/{appId}/rating` 撤销我的评分。

### 5.5 GitHub 仓库元数据（可选直查）
`GET /api/apps/{appId}/github`

Response 200: 同 5.1 的 `githubRepo` 字段。

---

## 6. 我的产品 (My Products)

### 6.1 我的项目列表（已有）
`GET /api/projects`

> 来源：[backend/app/routers/intellideploy/projects.py:40](../backend/app/routers/intellideploy/projects.py#L40)

Response 200:
```json
{
  "projects": [
    {
      "id": "12",
      "name": "blog",
      "repoUrl": "https://github.com/alice/blog",
      "repoOwner": "alice",
      "repoName": "blog",
      "visibility": "public",
      "defaultBranch": "main",
      "userId": "1",
      "createdAt": "2026-04-30T10:00:00Z",
      "updatedAt": "2026-05-01T10:00:00Z",
      "analysis": { "...": "见 _analysis_json" },
      "deployments": [ "..." ]
    }
  ]
}
```

### 6.2 我的应用 (已上架) 列表
`GET /api/me/apps?status=published|draft|archived&cursor=&limit=`

Response 200:
```json
{
  "items": [
    {
      "appId": "app_001",
      "name": "TranslatePro",
      "coverUrl": "...",
      "status": "published",
      "deployment": {
        "deploymentId": 33,
        "status": "running",
        "accessUrl": "https://..."
      },
      "stats": { "likeCount": 320, "deployCount": 1240, "commentCount": 17 },
      "updatedAt": "2026-05-05T10:00:00Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

### 6.3 我的部署列表
`GET /api/me/deployments?status=&cursor=&limit=`

Response 200: 复用现有 deployment 结构，详见 [backend/app/routers/intellideploy/deployments.py:248](../backend/app/routers/intellideploy/deployments.py#L248)。

### 6.4 修改应用元数据
`PATCH /api/apps/{appId}`

Request (任意子集):
```json
{
  "title": "新标题",
  "description": "...",
  "category": "blog",
  "tags": ["a","b"],
  "coverUrl": "https://...",
  "screenshots": ["https://..."],
  "visibility": "public"
}
```

Response 200: 返回更新后的 `appId` + 完整对象（同 5.1）。

### 6.5 发布新版本
`POST /api/apps/{appId}/versions`

Request:
```json
{
  "versionNumber": "1.3.0",
  "releaseNotes": "- 修复一些 bug",
  "deploymentId": 101         // 关联的新部署
}
```

Response 201:
```json
{ "versionId": "v_4", "versionNumber": "1.3.0", "releasedAt": "2026-05-06T03:14:25Z" }
```

### 6.6 下架 / 删除应用
- `POST /api/apps/{appId}/unpublish` → 改 `status = unlisted`，保留数据
- `DELETE /api/apps/{appId}` → 软删除

### 6.7 重新部署 / 停止 / 重启 / 删除部署
全部沿用已有：
- `POST /api/deployments/start`，详见 [backend/app/routers/intellideploy/deployments.py:40](../backend/app/routers/intellideploy/deployments.py#L40)
- `POST /api/deployments/{id}/retry`
- `DELETE /api/deployments/{id}`
- `GET /api/deployments/{id}/status`
- `GET /api/deployments/{id}/logs?tail_lines=200`

---

## 7. 个人主页 (Profile)

### 7.1 我的主页（自己看）
`GET /api/me`

Response 200:
```json
{
  "userId": "1",
  "nickname": "alice",
  "username": "alice",
  "email": "alice@example.com",
  "avatarUrl": "...",
  "bio": "全栈萌新",
  "phone": "+8613800001111",
  "googleEmail": null,
  "stats": {
    "publishedAppCount": 5,
    "followerCount": 10,
    "followingCount": 3,
    "totalLikeCount": 1023
  },
  "settings": {
    "kubeconfigConfigured": true,
    "githubTokenConfigured": true
  },
  "createdAt": "2026-04-01T03:14:25Z"
}
```

### 7.2 编辑个人资料
`PATCH /api/me`

Request:
```json
{
  "nickname": "Alice2",
  "bio": "...",
  "avatarUrl": "https://cdn.../new.png"
}
```

Response 200: 同 7.1。

### 7.3 上传头像
`POST /api/uploads/avatar`  (multipart `file`)

Response 200: `{ "url": "https://cdn.../avatar/xxx.png" }`

### 7.4 他人主页
`GET /api/users/{userId}`

Response 200: 7.1 子集（移除手机号/邮箱/settings）+ `viewerInteraction.followed`。

### 7.5 关注 / 取消关注
- `POST /api/users/{userId}/follow`
- `DELETE /api/users/{userId}/follow`

Response 200: `{ "followed": true, "followerCount": 11 }`

### 7.6 用户已发布应用 / 动态
- `GET /api/users/{userId}/apps?cursor=&limit=`
- `GET /api/users/{userId}/posts?cursor=&limit=` （广场动态）

### 7.7 设置 - kubeconfig / GitHub Token (已有)
- `POST /api/user/settings`，详见 [backend/app/routers/intellideploy/user_settings.py:24](../backend/app/routers/intellideploy/user_settings.py#L24)
- `POST /api/user/github-token`，详见 [backend/app/routers/intellideploy/user_settings.py:47](../backend/app/routers/intellideploy/user_settings.py#L47)

### 7.8 修改密码 / 解绑
- `POST /api/me/password/change`
  ```json
  { "oldPassword": "...", "newPassword": "..." }
  ```
- `POST /api/me/bind/google` / `DELETE /api/me/bind/google`
- `POST /api/me/bind/phone`  / `DELETE /api/me/bind/phone`

---

## 8. 广场页 (Plaza)

> 类似动态 Feed，用户可以分享自己的应用、看法、灵感。

### 8.1 动态流
`GET /api/plaza/posts?type=all|following|hot&cursor=&limit=`

Response 200:
```json
{
  "items": [
    {
      "postId": "post_001",
      "author": { "userId": "12", "nickname": "alice", "avatarUrl": "..." },
      "type": "app_share",          // app_share | text | image | repost
      "content": {
        "text": "刚做了个翻译工具",
        "imageUrls": [],
        "linkedApp": {              // type=app_share 时存在
          "appId": "app_001",
          "name": "TranslatePro",
          "coverUrl": "..."
        },
        "repost": null
      },
      "stats": { "likeCount": 12, "commentCount": 4, "repostCount": 1 },
      "viewerInteraction": { "liked": false },
      "createdAt": "2026-05-06T03:14:25Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

### 8.2 发动态
`POST /api/plaza/posts`

Request:
```json
{
  "type": "app_share",
  "text": "刚做了个翻译工具",
  "imageUrls": [],
  "linkedAppId": "app_001",
  "repostOfPostId": null
}
```

Response 201: `{ "postId": "post_005", "createdAt": "..." }`

### 8.3 动态详情
`GET /api/plaza/posts/{postId}` → 同 8.1 单条结构。

### 8.4 动态点赞 / 转发 / 删除
- `POST /api/plaza/posts/{postId}/like`
- `DELETE /api/plaza/posts/{postId}/like`
- `POST /api/plaza/posts/{postId}/repost`
- `DELETE /api/plaza/posts/{postId}` （仅作者）

### 8.5 动态评论（与 4.7/4.8 同结构，仅 path 不同）
- `GET /api/plaza/posts/{postId}/comments`
- `POST /api/plaza/posts/{postId}/comments`

### 8.6 上传图片（动态附图）
`POST /api/uploads/image`

| Field | 说明 |
| --- | --- |
| `file` | binary (jpg/png/webp ≤ 10MB) |
| `purpose` | `post` / `cover` / `screenshot` |

Response 200: `{ "url": "https://cdn.../xxx.png", "width": 1080, "height": 1920 }`

---

## 9. 通用接口

### 9.1 通知
- `GET /api/notifications?cursor=&limit=` → 站内消息列表
- `POST /api/notifications/{id}/read`
- `POST /api/notifications/read-all`

返回结构示例：
```json
{
  "items": [
    {
      "id": "n_001",
      "type": "comment",            // comment | like | follow | deploy_status | system
      "title": "alice 评论了你的应用",
      "body": "好用！",
      "data": { "appId": "app_001", "commentId": "cmt_01" },
      "isRead": false,
      "createdAt": "2026-05-06T03:14:25Z"
    }
  ],
  "unreadCount": 3,
  "nextCursor": null,
  "hasMore": false
}
```

### 9.2 上传通用入口
| 路径 | 用途 |
| --- | --- |
| `POST /api/uploads/avatar` | 头像 |
| `POST /api/uploads/image` | 通用图片 |
| `POST /api/uploads/voice` | Chatbot 语音 |
| `POST /api/uploads/cover` | App 封面 |

### 9.3 反馈 / 举报
- `POST /api/feedback`：`{ "category":"bug", "content":"..." }`
- `POST /api/reports`：`{ "targetType":"app|comment|post|user", "targetId":"...", "reason":"..." }`

### 9.4 健康检查
- `GET /` → `{ "message": "IntelliDeploy API is running" }` (已有，[backend/app/main.py:57](../backend/app/main.py#L57))
- `GET /health` → `{ "status":"ok", "version":"1.0.0", "time":"..." }`

---

## 10. 实时通信 (WebSocket)

### 10.1 部署实时进度（已有）
`WS /ws/deployments/{deployment_id}`  
> 来源：[backend/app/routers/websocket.py:15](../backend/app/routers/websocket.py#L15)

服务端推送格式：
```json
{
  "type": "status",                  // status | log | event | error
  "deployment_id": 33,
  "data": {
    "status": "running",
    "runtime_name": "app-12",
    "access_url": "https://...",
    "phase": "BUILD_ENV"
  },
  "timestamp": "2026-05-06T03:15:00Z"
}
```
客户端可发送 `ping` 心跳，服务端回 `pong`。

### 10.2 Chatbot 会话流（新增）
`WS /ws/chat/{sessionId}`

服务端推送：
```json
{
  "type": "phase_update",            // phase_update | message_append | task_done | task_error
  "sessionId": "sess_abc123",
  "taskId": "task_xx",
  "data": {
    "phase": "BUILD_ENV",
    "status": "succeeded",
    "progressMessage": "依赖安装完成",
    "appCard": null                  // task_done 时携带
  },
  "timestamp": "2026-05-06T03:15:30Z"
}
```

客户端心跳：发送 `{"type":"ping"}` → 服务端 `{"type":"pong"}`。

### 10.3 通知推送（可选）
`WS /ws/notifications`

服务端推送：
```json
{ "type": "notification", "data": { "id":"n_001", "title":"...", "createdAt":"..." } }
```

---

## 11. 错误码表 (Machine-readable)

| code | HTTP | 含义 |
| --- | --- | --- |
| `AUTH_TOKEN_INVALID` | 401 | Token 无效或过期 |
| `AUTH_PRIVACY_NOT_AGREED` | 400 | 未勾选隐私协议 |
| `SMS_RATE_LIMITED` | 429 | 短信验证码 60s 内重复发送 |
| `SMS_CODE_INVALID` | 400 | 验证码错误或过期 |
| `OAUTH_EXCHANGE_FAILED` | 400 | Google code 交换失败 |
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在 |
| `FORBIDDEN` | 403 | 无权操作 |
| `CONFLICT_DUPLICATE` | 409 | 重复点赞 / 重复关注 |
| `KUBECONFIG_INVALID` | 400 | kubeconfig 格式无效 |
| `KUBECONFIG_MISSING` | 400 | 用户未配置 kubeconfig |
| `GITHUB_TOKEN_MISSING` | 401 | 用户未绑定 GitHub Token |
| `DEPLOY_NOT_READY` | 400 | 生成产物未就绪即触发部署 |
| `GENERATION_TIMEOUT` | 500 | 生成任务超时 |
| `UPLOAD_TOO_LARGE` | 413 | 上传文件超过限制 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 12. 数据模型字典 (Schema Glossary)

### 12.1 User
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int → string | 主键 |
| username | string | 登录名（唯一） |
| nickname | string | 昵称（首页问候语用） |
| email | string | 邮箱 |
| phone | string? | E.164 手机号 |
| avatarUrl | string? | 头像 |
| bio | string? | 个人签名 |
| isActive | bool | |
| createdAt | datetime | |

### 12.2 Project
对齐 [backend/app/models/intellideploy/project.py](../backend/app/models/intellideploy/project.py)，对外字段使用 camelCase（`repoUrl`、`repoOwner` 等）。

### 12.3 Deployment
对齐 [backend/app/models/intellideploy/deployment.py](../backend/app/models/intellideploy/deployment.py)：
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int | |
| projectId | int | |
| status | enum | `pending` `building` `running` `failed` `success` |
| sealosAppId | string? | |
| runtimeName | string | |
| namespace | string? | |
| ingressDomain | string? | |
| accessUrl | string? | |
| databaseName | string? | |
| dockerfileContent | string? | |
| envVars | object? | |
| retryCount | int | |
| errorMessage | string? | |
| errorType | string? | |
| log | string? | |
| createdAt / startedAt / finishedAt / updatedAt | datetime | |

### 12.4 GenerationTask（沿用 fallback schema）
见 [backend/app/schemas/fallback.py](../backend/app/schemas/fallback.py)。

### 12.5 App
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| appId | string | 应用唯一标识（不同于 project / deployment） |
| projectId | int? | 来源项目 |
| deploymentId | int? | 当前活跃部署 |
| name | string | |
| logoUrl | string? | |
| coverUrl | string? | Gallery 卡片图 |
| summary / description | string | |
| category | string | |
| tags | string[] | |
| visibility | enum | public / unlisted / private |
| status | enum | published / draft / archived |
| rating | float | 0~5 |
| ratingCount | int | |
| deployCount | int | 一键部署累计次数 |
| stats | object | likeCount/favoriteCount/commentCount |
| screenshots | object[] | `{url, order}` |
| versions | object[] | `AppVersion` |
| currentVersionId | string | |
| githubRepo | object | owner/name/url/stars/license/primaryLanguage |
| author | User 简化版 | |
| createdAt / updatedAt | datetime | |

### 12.6 AppVersion
| 字段 | 类型 |
| --- | --- |
| versionId | string |
| versionNumber | string (semver) |
| releaseNotes | string (markdown) |
| deploymentId | int |
| isCurrent | bool |
| releasedAt | datetime |

### 12.7 Comment
| 字段 | 类型 |
| --- | --- |
| commentId | string |
| user | User 简化 |
| content | string |
| rating | float (0~5, 0 表示非评分) |
| parentCommentId | string? |
| likeCount / replyCount | int |
| viewerInteraction.liked | bool |
| createdAt | datetime |

### 12.8 Post (广场动态)
| 字段 | 类型 |
| --- | --- |
| postId | string |
| author | User 简化 |
| type | enum (app_share / text / image / repost) |
| content.text | string |
| content.imageUrls | string[] |
| content.linkedApp | App 简化 |
| content.repost | Post? |
| stats | likeCount/commentCount/repostCount |
| viewerInteraction | liked |
| createdAt | datetime |

---

## 13. 实施 / 兼容性约定

1. **前后端字段命名**：所有新接口对外统一 camelCase；旧 `auth/*` 接口保持现状（兼容已有前端）。
2. **接口前缀**：业务接口统一 `/api/...`；全局异常处理器会根据前缀切换 `error` / `detail` 字段（[backend/app/main.py:50](../backend/app/main.py#L50)）。
3. **OpenAPI**：所有新接口需在 FastAPI 中注册，自动生成文档暴露在 `/docs`。
4. **WebSocket 鉴权**：Token 通过 query string 传递：`/ws/chat/{sessionId}?token=...`；服务端在 `accept()` 之前完成校验。
5. **幂等**：点赞、收藏、关注、评分采用 `PUT/DELETE` 语义保证幂等；重复 `POST` 不报错而返回当前状态。
6. **限流**：登录、验证码、评论、发动态由 Redis 限流，超限 `429`。
7. **隐私**：`agreedPrivacyVersion` 必须保存到 `user_privacy_consents` 表，包含 `version` 与 `agreedAt`。
8. **金丝雀**：所有 v1 接口路径不携带版本号（与现有保持一致）；未来重大不兼容改动通过 `/api/v2/...` 切版。

---

## 14. 后续待补 (TODO)

- [ ] 短信网关接入（阿里云 / 腾讯云）
- [ ] Google OAuth `client_id` / `client_secret` 注入到 settings
- [ ] App Gallery 推荐算法（目前按 `order=hot` 直接走 like+deploy 的简单加权）
- [ ] 评论 / 评分的反垃圾策略（频率、敏感词、机审）
- [ ] WebSocket 鉴权与重连协议（断线重传 last event id）
- [ ] OpenAPI 模板补充每个接口的 Pydantic Schema 与示例
