你现在要实现 `async_tasks/tasks.py`。

功能

- 提供异步任务提交、执行、状态查询、artifact 查询主入口。
- 把同步 `FallbackService` 闭环包装成可追踪的后台任务。

上游信息接口

- 输入：`FallbackRequest`
- 依赖：
  - `FallbackService`
  - `task_schema`
  - `redis_state`
  - `celery_app`

下游信息接口

- 输出函数至少包括：
  - `submit_fallback_task()`
  - `run_fallback_task()`
  - `get_task_status()`
  - `get_task_artifact()`

实现

一、`submit_fallback_task()`

职责：

- 规范化输入为 `FallbackRequest`
- 生成 `task_id`
- 保存初始 `TaskState`
- 可选保存规范化后的 `FallbackRequest` 快照，供 repair / regenerate 场景复用
- 返回 `TaskCreateResponse`
- 如果异步已启用，则投递后台任务
- 如果异步未启用，必须让调用方显式知道当前仅支持同步或本地执行，不允许 silent fail

初始状态：

- `status=QUEUED`
- `current_stage=queued`
- `artifact_ready=false`

补充约束：

- `task_id` 表示 fallback 异步任务 ID，不要求与 Celery worker 原生 id 相同

二、`run_fallback_task()`

必须按当前 fallback 主链路逐步执行，而不是只调用一个黑盒函数后一次性回写状态。

建议顺序：

1. `classifying`
   - 调 `service.evaluate()`
2. `solving`
   - 调 `service.solve_plan()`
3. 若 decision in `A/B/C`
   - `materializing`
   - 调 `service.materialize()`
4. `validating`
   - 调 `service.validate()`
5. 若 decision in `A/B/C`
   - `packaging`
   - 调 `service.package()`
6. 保存最终 `TaskState`
7. 如有 artifact，保存 `ArtifactResponse`

三、状态更新规则

主状态建议：

- 入队：`QUEUED`
- 执行中：`RUNNING`
- 成功：`SUCCEEDED`
- 失败：`FAILED`

细阶段建议：

- `queued`
- `classifying`
- `solving`
- `materializing`
- `validating`
- `packaging`
- `completed`
- `failed`
- `manual_required`

四、D 类规则

如果最终 decision = `D`：

- 不进入 `materialize`
- 不进入 `package`
- `artifact_ready=false`
- 最终：
  - `status=SUCCEEDED`
  - `current_stage=manual_required`
  - `progress_message` 应说明需要补充信息

五、artifact 保存规则

如果拿到 `DeployArtifact`：

- 组装 `ArtifactResponse`
- `artifact_type` 直接取 `DeployArtifact.artifact_type`
- `artifact_path` 直接取 `DeployArtifact.artifact_path`
- `deploy_ready` 直接取 `DeployArtifact.ready_for_deploy`
- `required_envs` 从 `FallbackPlan.env_vars` 映射
- `runtime.base_image` 从 `DockerSpec.base_image` 映射
- `runtime.package_manager` 从 `DockerSpec.package_manager` 映射
- `runtime.install_command` 从 `DockerSpec.install_command` 映射
- `runtime.healthcheck_path` 从 `DockerSpec.healthcheck_path` 映射
- `runtime.start_command` 从 `FallbackPlan.docker_spec.start_command` 映射
- `runtime.exposed_port` 从 `FallbackPlan.docker_spec.exposed_port` 映射

额外约束：

- 不要让 `start_command` 在这里有多个候选来源
- 不要让 `exposed_port` 在这里有多个候选来源
- `run_command` / `container_port` 仅作为兼容别名理解，不作为新实现主字段
- 如果 `FallbackPlan.docker_spec.start_command` 或 `FallbackPlan.docker_spec.exposed_port` 缺失，按缺失处理，不要回退到 artifact manifest
- 不要在异步层重新解释或重组 artifact manifest 来覆盖上述字段来源

六、失败规则

任一阶段失败时：

- `status=FAILED`
- `current_stage=failed`
- 写入：
  - `error_code`
  - `error_message`
  - `recoverable`

其中：

- schema/输入不合法：通常 `recoverable=false`
- 网络拉取失败、LLM 超时、临时存储失败：通常 `recoverable=true`
- validation fail：根据业务策略决定，默认可重试或人工介入

七、查询函数

- `get_task_status(task_id)`：
  - 返回 `TaskState`
- `get_task_artifact(task_id)`：
  - 返回 `ArtifactResponse`
  - 未就绪时返回 `None`

八、异步投递约束

- `tasks.py` 不要通过 `celery_app is None` 这种裸值判断异步能力
- 应基于显式能力判断接口，例如 `is_async_enabled()`
- 如调用 `get_celery_app()` 失败，应接收结构化异常并走明确降级路径

不接受的实现方式

- 不要只调用 `run_pipeline()` 然后最后一次性更新状态。
- 不要让 `tasks.py` 自己重写 solver / validator / package 逻辑。
- 不要把 D 类当失败处理。
- 不要生成与 `artifact_type`、`required_envs` 规则冲突的异步响应。

验收标准

- 前端能看到逐阶段状态推进。
- A/B/C 最终能查询到 artifact。
- D 最终能查询到明确的 manual_required 状态。
- 状态机和同步执行链完全对齐。
