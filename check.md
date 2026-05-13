# API 对照检查

检查时间：2026-05-13  
检查范围：`API.md` 中与当前后端直接相关的接口、状态码、错误结构、字段命名、WebSocket 协议

审查结论标记：
- `一致`
- `部分一致`
- `不一致`
- `文档未覆盖`

---

## 1. 通用约定

### 1.1 业务错误结构

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:36)
- 代码位置：[main.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/main.py:50), [generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:24), [deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:20)
- 审查结果：`部分一致`
- 结果说明：
  - 全局 `HTTPException` 已统一包装为 `error/code/details` 结构。
  - 422 校验错误也已统一成 `code = VALIDATION_ERROR`。
  - 但并不是所有路由都已经把业务分支细化为文档中的具体错误码，仍有一部分兜底走 `INTERNAL_ERROR`。

### 1.2 422 校验错误

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:61)
- 代码位置：[main.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/main.py:69)
- 审查结果：`一致`
- 结果说明：
  - 已注册 `RequestValidationError` 处理器。
  - 当前返回中包含 `error`、`code = VALIDATION_ERROR`、`details`。

### 1.3 对外字段统一 camelCase

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:14), [API.md](C:/Users/ROG/Desktop/Deploy/API.md:1283)
- 代码位置：[fallback.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/schemas/fallback.py:131), [websocket_manager.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/websocket_manager.py:142), [generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:566)
- 审查结果：`部分一致`
- 结果说明：
  - Pydantic 对外模型已大范围切到 camelCase。
  - WebSocket 事件广播也已经改成 `taskId/sessionId/deploymentId/progressMessage/failureReason` 这类命名。
  - 仍需继续核对少量非 response_model 的手写 dict 返回，尤其是部署状态链路里下游服务返回值是否完全 camelCase。

---

## 2. `/api/generation/*`

### 2.1 `POST /api/generation/start`

- 代码位置：[generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:35)
- 审查结果：`部分一致`
- 结果说明：
  - 已接入 JWT 鉴权：[generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:38)
  - 返回模型走 `StartFallbackTaskResponse`，已支持 camelCase 输出。
  - 异常统一为 `INTERNAL_ERROR`，但还没有细化更多业务态错误码。

### 2.2 `GET /api/generation/status/{taskId}`

- 代码位置：[generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:57)
- 审查结果：`部分一致`
- 结果说明：
  - 已接 JWT。
  - 返回模型 `QueryTaskStatusResponse` 已支持 `currentStage/progressMessage/artifactReady/sessionId/iterationCount/isApproved/failureReason`。
  - 如果上游 fallback 返回更细粒度错误，目前仍可能被兜底为 500。

### 2.3 `GET /api/generation/artifact/{taskId}`

- 代码位置：[generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:76)
- 审查结果：`部分一致`
- 结果说明：
  - 已接 JWT。
  - 多智能体扩展字段已落入响应模型，包括 `artifactVersion/currentConfigs/reviewHistory/securityReports`。
  - 上游错误语义仍未完全细分。

### 2.4 `POST /api/generation/feedback`

- 代码位置：[generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:95)
- 审查结果：`部分一致`
- 结果说明：
  - 已接 JWT。
  - 已兼容主图重跑和 fallback feedback。
  - 仍缺更细的业务错误码映射。

### 2.5 Agent 事件查询

- 代码位置：[generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:169), [generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:182)
- 审查结果：`文档未覆盖`
- 结果说明：
  - 当前实现提供了 task/session 维度的 agent events 查询。
  - `API.md` 还没有把这部分写进去。

---

## 3. `/api/deployments/*`

### 3.1 `POST /api/deployments/start`

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:894)
- 代码位置：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:56)
- 审查结果：`部分一致`
- 结果说明：
  - 已接 JWT。
  - `DEPLOY_NOT_READY` 已对齐：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:88)
  - 任务不存在已返回 `RESOURCE_NOT_FOUND`：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:96)
  - 成功返回仍是 `dict`，需要继续确认返回体是否与文档完全一致。

### 3.2 `GET /api/deployments/{id}`

- 代码位置：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:119)
- 审查结果：`部分一致`
- 结果说明：
  - 已使用 `DeploymentResponse`，字段为 camelCase。
  - 不存在时已对齐为 `RESOURCE_NOT_FOUND`：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:140)

### 3.3 `GET /api/deployments/{id}/status`

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:897)
- 代码位置：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:151)
- 审查结果：`部分一致`
- 结果说明：
  - 404 已统一进 `RESOURCE_NOT_FOUND`。
  - 500 已统一进 `INTERNAL_ERROR`。
  - 但依赖的 orchestrator / sealos 返回体仍需再核对是否完全符合文档字段。

### 3.4 `GET /api/deployments/{id}/logs`

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:898)
- 代码位置：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:174)
- 审查结果：`部分一致`
- 结果说明：
  - 404 / 500 错误结构已经统一。
  - 成功返回为 `deploymentId + logs`，但日志内容形态还要继续对照上游实现。

### 3.5 `POST /api/deployments/{id}/retry`

- 代码位置：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:197)
- 审查结果：`部分一致`
- 结果说明：
  - 不存在时已统一成 `RESOURCE_NOT_FOUND`。
  - 成功响应是手写 dict，字段名已是 camelCase，但是否还需要补 response_model 取决于你们是否要求严格 OpenAPI 对齐。

### 3.6 `DELETE /api/deployments/{id}`

- 代码位置：[deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:226)
- 审查结果：`部分一致`
- 结果说明：
  - 不存在时已统一成 `RESOURCE_NOT_FOUND`。
  - 语义可用，但当前成功返回 `200 + message`，如果文档最终要求 `204`，这里还要再改。

---

## 4. `/api/user/*`

### 4.1 `POST /api/user/settings`

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:966), [API.md](C:/Users/ROG/Desktop/Deploy/API.md:1166)
- 代码位置：[user_settings.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/user_settings.py:24)
- 审查结果：`部分一致`
- 结果说明：
  - 已接 JWT。
  - `KUBECONFIG_MISSING / KUBECONFIG_INVALID / INTERNAL_ERROR` 已补上。
  - 还需要再核对成功响应字段是否与文档逐项一致。

### 4.2 `POST /api/user/github-token`

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:968)
- 代码位置：[user_settings.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/user_settings.py:47)
- 审查结果：`部分一致`
- 结果说明：
  - 成功返回结构基本合理。
  - 缺失 token 时已补 `GITHUB_TOKEN_MISSING`。
  - 仍建议后续确认这个错误码名称是否正好与 `API.md` 最终文案一致。

---

## 5. WebSocket

### 5.1 `WS /ws/deployments/{deploymentId}`

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:1103)
- 代码位置：[websocket.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/websocket.py:54), [websocket_manager.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/websocket_manager.py:130)
- 审查结果：`部分一致`
- 结果说明：
  - 已在 `accept()` 前鉴权，支持 query string token，也兼容 `Authorization: Bearer`：[websocket.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/websocket.py:18), [websocket.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/websocket.py:29)
  - 初始状态和后续状态广播已改为 `type = phase_update`。
  - 但部署通道的事件字段还需要继续和前端联调确认，例如是否需要固定 `data.phase`、`data.status` 枚举全集。

### 5.2 `WS /ws/chat/{sessionId}`

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:1124)
- 代码位置：[websocket.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/websocket.py:158)
- 审查结果：`部分一致`
- 结果说明：
  - 路由已补上，不再缺失。
  - 已支持 `type = phase_update | task_done | task_error` 这条主线，事件由多智能体广播链路输出：[generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:553)
  - `message_append` 已开始从多智能体事件流产出：[generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:602)
  - 但目前是“把结构化事件文案同步转成消息流”的最小实现，不是完整聊天大模型逐 token/逐轮回复。

### 5.3 WebSocket 心跳

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:1121)
- 代码位置：[websocket.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/websocket.py:42)
- 审查结果：`部分一致`
- 结果说明：
  - 兼容纯文本 `ping -> pong`。
  - 也兼容 JSON `{"type":"ping"}` -> `{"type":"pong"}`。
  - 比文档更宽松，不算冲突，但需要前后端约定最终只保留一种格式还是双兼容。

### 5.4 多智能体会话事件体

- 文档位置：[API.md](C:/Users/ROG/Desktop/Deploy/API.md:1129)
- 代码位置：[generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:587), [generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:617), [websocket_manager.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/websocket_manager.py:185)
- 审查结果：`部分一致`
- 结果说明：
  - 已对齐 `type/sessionId/taskId/data/timestamp` 主结构。
  - 已对齐 `progressMessage/failureReason/iterationCount/agentName` 等字段命名。
  - `task_done` 中的 `appCard` 已补最小结构，来源于任务、部署和图执行结果：[generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:704)
  - 会话首次连接时，如果任务已经结束，也会在初始 `phase_update` 里附带 `appCard`：[websocket.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/websocket.py:104)

---

## 6. 当前剩余主要差距

### 6.1 还没完全对齐的点

- [user_settings.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/user_settings.py:63)
  - `githubToken is required` 仍是裸字符串错误，未提供稳定 `code`。
- [deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:56)
  - `POST /start` 成功响应未声明 response_model，是否完全贴合 `API.md` 还不能只靠类型系统保证。
- [deployments.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/deployments.py:151)
  - 状态与日志接口依赖下游 orchestrator/sealos 输出，字段级一致性还需继续顺藤摸瓜核对。
- [generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:617)
  - `appCard` 现在只有最小可用字段；如果前端后续需要图片、按钮、仓库信息，还要继续扩展。
- [generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:681)
  - `message_append` 当前是由事件摘要转发而来，不是真正的对话消息模型。

### 6.2 本轮已确认修复的点

- [generation.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/intellideploy/generation.py:38)
  - `/api/generation/*` 已接 JWT。
- [websocket.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/websocket.py:158)
  - `/ws/chat/{sessionId}` 已补上。
- [websocket.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/routers/websocket.py:29)
  - WebSocket 鉴权已在 `accept()` 前执行。
- [main.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/main.py:69)
  - 422 统一错误格式已补上。
- [generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:553)
  - 多智能体会话流已切到 `phase_update/task_done/task_error`。
- [generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:602)
  - `message_append` 已补生产路径。
- [generation_task_service.py](C:/Users/ROG/Desktop/Deploy/Deploy11/IntelliDeploy/backend/app/services/generation_task_service.py:704)
  - `appCard` 已补最小结构。

---

## 7. 总结

当前实现已经从“明显不对齐”进入“主干协议基本对齐，但仍有尾差”的状态。

如果只看你们这次主要负责的多智能体 + WebSocket 部分：
- 鉴权已接上
- `/ws/chat/{sessionId}` 已补上
- 会话事件主结构已基本对齐
- 剩余缺口主要是 `message_append`、`appCard`、以及少量错误码和成功响应模型的收尾
