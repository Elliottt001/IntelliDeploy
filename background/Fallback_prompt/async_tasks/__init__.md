你现在要补齐 `async_tasks/` 目录下的异步任务提示词。

目标

- 让 Celery / Redis 异步封装与当前 fallback 主闭环完全对齐
- 不再停留在旧的 `evaluate -> solve -> validate`
- 必须完整覆盖：
  - `classify -> solve_plan -> materialize -> validate -> package`

边界

- `async_tasks` 只做任务提交、状态记录、结果缓存、任务查询
- 不在这里实现 classifier / solver / workspace / validator / artifact 业务细节
- 业务编排必须复用 `services/fallback_service.py`

异步主线

```text
submit_fallback_task
  -> 创建 task_id
  -> 保存初始 TaskState
  -> 可选保存规范化请求快照
  -> 投递 Celery 任务

run_fallback_task
  -> classifying
  -> solving
  -> materializing
  -> validating
  -> packaging
  -> save ArtifactResponse
  -> update TaskState
```

统一约束

1. `status` 是任务主状态：
   - `QUEUED`
   - `RUNNING`
   - `SUCCEEDED`
   - `FAILED`

2. `current_stage` 是细阶段：
   - `queued`
   - `classifying`
   - `solving`
   - `materializing`
   - `validating`
   - `packaging`
   - `completed`
   - `failed`
   - `manual_required`

3. D 类行为：
   - `status` 可为 `SUCCEEDED`
   - `current_stage=manual_required`
   - 不保存 artifact
   - `artifact_ready=false`

4. 对外 artifact 响应必须兼容下游接口 C
   - 内部从 `DeployArtifact + FallbackPlan + DockerSpec` 组装
   - `env_vars` 在这里映射为 `required_envs`
   - `artifact_path / artifact_type / deploy_ready` 固定来自 `DeployArtifact`
   - `runtime.start_command / runtime.exposed_port` 固定来自 `FallbackPlan.docker_spec`
   - `runtime.base_image / runtime.package_manager / runtime.install_command / runtime.healthcheck_path` 固定来自 `DockerSpec`

5. 异步能力判断必须显式化
   - 不要把“Celery 不可用”仅编码成裸 `None`
   - 应提供类似 `is_async_enabled()` 的显式判断接口
   - `get_celery_app()` 失败时应抛结构化异常，便于调用方明确降级

6. 状态存储按单任务串行更新假设实现
   - 第一版不要默认支持多个 worker 同时改同一个 task
   - `update_task()` 只做增量合并，不负责多 writer 冲突解决

7. `task_id` 语义
   - `task_id` 表示 fallback 异步任务 ID
   - 不要求对外暴露 Celery worker 原生 task id
   - 如后续需要保留 Celery 原生 id，应作为附加字段单独暴露，不替代这里的 `task_id`

你接下来要分别编写：

- `async_tasks/celery_app.md`
- `async_tasks/task_schema.md`
- `async_tasks/redis_state.md`
- `async_tasks/tasks.md`

验收标准

- 文档之间字段名一致
- 状态流和当前 `FallbackService` 五段主链路一致
- 不再扩散旧词：
  - `selected_repo`
  - `run_command`
  - `container_port`
  - `PATCH_PLAN`
  - `GENERATING/STITCHING` 作为主状态
