你现在要实现 `async_tasks/task_schema.py`。

功能

- 定义异步任务层的输入输出结构。
- 作为 HTTP API、Redis 状态存储、Celery worker 之间的统一契约。

上游信息接口

- 输入来源：`FallbackRequest`、`ValidationResult`、`DeployArtifact`、下游接口文档。

下游信息接口

- 输出对象至少包括：
  - `TaskStatus`
  - `TaskCreateResponse`
  - `TaskState`
  - `ArtifactRuntime`
  - `ArtifactResponse`

实现

一、`TaskStatus`

主状态统一只保留：

- `QUEUED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`

说明：

- `GENERATING` / `STITCHING` / `PACKAGING` 不再作为主状态扩散
- 这些细分阶段统一进入 `TaskState.current_stage`

二、`TaskCreateResponse`

建议字段：

- `accepted`
- `task_id`
- `status`
- `queued_at`
- `message`

约束：

- `status` 初始固定 `QUEUED`

三、`TaskState`

建议字段：

- `task_id`
- `project_id`
- `deployment_id`
- `status`
- `current_stage`
- `progress_message`
- `artifact_ready`
- `updated_at`
- `error_code`
- `error_message`
- `recoverable`

其中 `current_stage` 统一建议值：

- `queued`
- `classifying`
- `solving`
- `materializing`
- `validating`
- `packaging`
- `completed`
- `failed`
- `manual_required`

四、`ArtifactRuntime`

建议字段：

- `base_image`
- `package_manager`
- `install_command`
- `start_command`
- `exposed_port`
- `healthcheck_path`

来源冻结：

- `base_image` ← `DockerSpec.base_image`
- `package_manager` ← `DockerSpec.package_manager`
- `install_command` ← `DockerSpec.install_command`
- `healthcheck_path` ← `DockerSpec.healthcheck_path`
- `start_command` ← `FallbackPlan.docker_spec.start_command`
- `exposed_port` ← `FallbackPlan.docker_spec.exposed_port`

约束：

- `run_command` / `container_port` 只允许作为兼容别名解释，不再作为异步层主字段来源
- 不允许在异步层把 `start_command` / `exposed_port` 改为从 artifact manifest 回填
- 上述来源缺失时，允许显式置空，但不要切换到别的来源兜底

五、`ArtifactResponse`

建议字段：

- `task_id`
- `artifact_type`
- `artifact_path`
- `artifact_uri`
- `artifact_key`
- `dockerfile_content`
- `runtime`
- `required_envs`
- `warnings`
- `summary`
- `deploy_ready`
- `next_action`

映射约束：

- 内部主字段是 `env_vars`
- 对外异步接口层映射为 `required_envs`
- `artifact_path` ← `DeployArtifact.artifact_path`
- `artifact_type` ← `DeployArtifact.artifact_type`
- `deploy_ready` ← `DeployArtifact.ready_for_deploy`
- `runtime` 内部字段来源必须遵循上面的 `ArtifactRuntime` 冻结规则
- `required_envs` ← `FallbackPlan.env_vars`
- `artifact_type` 只允许：
  - `TEMPLATE_PROJECT`
  - `STITCHED_PROJECT`

补充说明：

- `dockerfile_content` 如需返回，优先来自打包产物中的确定结果，不在异步层二次拼装
- `artifact_uri` / `artifact_key` 属于存储层补充字段，不参与 runtime 来源判定

六、D 类特殊约束

- D 类通常不会生成 `ArtifactResponse`
- D 类成功结束时：
  - `status=SUCCEEDED`
  - `current_stage=manual_required`
  - `artifact_ready=false`

不接受的实现方式

- 不要把内部 `FallbackPlan` 直接当作 Task API schema 暴露。
- 不要继续让 `status` 膨胀成业务阶段枚举。
- 不要在异步 schema 里重新命名运行时主字段。

验收标准

- Task 层 schema 能完整表达提交、执行中、完成、失败四类状态。
- 能稳定承接 `DeployArtifact` 向下游接口 C 的映射。
- 与 `schema_glossary.md` 中的 `artifact_type`、`required_envs` 规则一致。
