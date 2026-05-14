# IntelliDeploy Fallback Schema Glossary

这份文档用于冻结 `fallback` 模块的统一 schema 词表。  
目标是解决上下游接口、当前代码、以及后续 `solve(plan) -> materialize(workspace) -> validate(workspace) -> package(artifact)` 规划之间的字段漂移问题。

本词表的原则：

1. 上下游接口字段名优先兼容，不随意改接口。
2. 内部对象边界必须清晰：`request -> classify -> plan -> workspace -> validation -> artifact`
3. 一个语义只保留一个主字段名，其他同义词全部视为废弃别名。
4. 运行命令和端口统一挂在 `docker_spec` / `runtime` 下，不再多处平铺。

---

## 1. 对象层级

统一采用以下对象层级：

1. `FallbackRequest`
   - 上游输入
   - 描述用户意图、候选仓库摘要、文件树、关键文件

2. `ClassifyResponse`
   - 分类输出
   - 描述单仓库事实提取结果和 A/B/C/D 决策

3. `FallbackPlan`
   - `solve` 阶段输出
   - 只描述“准备怎么做”
   - 不代表真实源码目录已经存在

4. `WorkspaceContext` / `MaterializeResult`
   - `materialize` 阶段输出
   - 描述真实 `source/`、`workspace/`、`logs/` 目录和落盘结果

5. `ValidationResult`
   - `validate` 阶段输出
   - 描述 plan 校验 + workspace 校验的聚合结果

6. `ArtifactManifest`
   - artifact 内部元数据
   - 描述最终部署产物的来源、变更、运行信息、校验摘要

7. `DeployArtifact`
   - `package` 阶段输出
   - 交给部署侧消费

---

## 2. 顶层对象统一定义

### 2.1 FallbackRequest

`FallbackRequest` 是唯一的上游输入对象。

统一字段：

- `raw_query`
- `user_intent`
- `repo_info`
- `file_tree`
- `key_files`
- `project_id`
- `deployment_id`
- `request_id`
- `force_fallback`
- `repair_exhausted`

说明：

- 不新增“上游直接传完整源码包”字段。
- A/B 真实源码获取通过 `repo_info.repo_url` 和 `repo_info.default_branch` 在内部完成。

---

### 2.2 ClassifyResponse

`ClassifyResponse` 是分类阶段统一输出。

统一字段：

- `user_intent_summary`
- `repo_fact_summary`
- `evaluation_result`
- `hu_generation_request`

说明：

- `hu_generation_request` 只在需要转 C 或强制 fallback 时出现。

---

### 2.3 FallbackPlan

`FallbackPlan` 是 `solve` 阶段统一输出。

统一字段：

- `decision`
- `generated_files`
- `modified_files`
- `docker_spec`
- `env_vars`
- `artifact_type`
- `warnings`
- `summary`
- `deploy_ready`
- `next_action`
- `missing_information`
- `request_id`
- `project_id`
- `deployment_id`
- `source_repo_url`
- `task_id`

补充约束：

- A/B/C 必须有明确执行计划，才能进入 `materialize`
- D 必须有 `missing_information`
- D 不允许带可执行 artifact 字段

---

## 3. Repo 相关对象词表

### 3.1 RepoInfo

`RepoInfo` 表示上游传入的原始仓库元信息。

统一字段：

- `rank`
- `retrieval_score`
- `repo_url`
- `default_branch`
- `description`
- `topics`
- `stars`
- `is_archived`
- `last_commit_at`

说明：

- `repo_url` 是原始字段名，只用于上游输入和原始仓库描述。

---

### 3.2 RepoFactSummary

`RepoFactSummary` 表示分类阶段提取出的完整事实对象。

统一用途：

- 供评分、规则、solver 输入使用
- 作为最完整的仓库事实来源

说明：

- 这是“富对象”
- 不直接暴露给部署侧

---

### 3.3 RepoProfile

`RepoProfile` 表示供求解/生成/部署环节使用的压缩版仓库画像。

统一字段：

- `source_repo_url`
- `detected_languages`
- `detected_frameworks`
- `package_manager`
- `entrypoints`
- `dependency_files`
- `has_valid_dockerfile`
- `readme_summary`

说明：

- `RepoProfile` 是“窄对象”
- 优先服务 solver、workspace、artifact、下游生成任务

---

## 4. 运行信息统一词表

### 4.1 DockerSpec

`DockerSpec` 是内部唯一的运行时主对象。

统一字段：

- `dockerfile_content`
- `start_command`
- `exposed_port`
- `base_image`
- `package_manager`
- `install_command`
- `healthcheck_path`

### 4.2 统一规则

后续实现中：

- **不再把 `run_command` 作为 `FallbackPlan` 的顶层主字段**
- **不再把 `container_port` 作为 `FallbackPlan` 的顶层主字段**

统一改为：

- `docker_spec.start_command`
- `docker_spec.exposed_port`

如果某模块出于兼容需要读取：

- `run_command` => 映射为 `docker_spec.start_command`
- `container_port` => 映射为 `docker_spec.exposed_port`

但这两个名字视为：

- **兼容别名**
- **非主词**

---

## 5. 环境变量统一词表

### 5.1 内部统一字段

内部统一使用：

- `env_vars: list[EnvVarSpec]`

`EnvVarSpec` 统一字段：

- `name`
- `required`
- `example_value`
- `description`
- `source`

### 5.2 对下游接口映射

下游接口 C 中使用：

- `required_envs`

映射规则：

- `FallbackPlan.env_vars` -> `ArtifactResponse.required_envs`

也就是说：

- 内部统一叫 `env_vars`
- 对下游响应统一叫 `required_envs`

不要在内部 plan/workspace/schema 中混用 `required_envs`。

---

## 6. Workspace 统一词表

### 6.1 WorkspacePaths

`WorkspacePaths` 是路径主对象，统一字段：

- `source_path`
- `workspace_path`
- `logs_path`
- `artifact_path`
- `metadata_path`

### 6.2 路径语义

- `source_path`
  - 原始仓库拉取目录
  - 只读基线

- `workspace_path`
  - 实际修改目录
  - A/B/C 全部在这里落盘

- `logs_path`
  - 拉取、patch、validate、package 日志

- `artifact_path`
  - 最终交部署侧的完整项目目录

- `metadata_path`
  - `workspaces/{task_id}/metadata.json`

### 6.3 WorkspaceContext

`WorkspaceContext` 统一承载：

- `task_id`
- `decision`
- `paths`
- `source_repo_url`
- `default_branch`
- `commit_sha`
- `artifact_type`
- `status`
- `timestamps`

---

## 7. Materialize 统一词表

### 7.1 MaterializeResult

`MaterializeResult` 表示真实工作区已落盘。

建议统一字段：

- `task_id`
- `decision`
- `workspace_context`
- `created_files`
- `updated_files`
- `skipped_files`
- `conflicts`
- `warnings`
- `logs`
- `success`

### 7.2 PatchApplyResult

`PatchApplyResult` 用于 patch_applier 的细粒度结果。

建议统一字段：

- `created_files`
- `updated_files`
- `skipped_files`
- `conflicts`
- `logs`

---

## 8. Validation 统一词表

### 8.1 ValidationResult

`ValidationResult` 是统一校验输出对象。

为兼容现有代码，保留：

- `passed`
- `checks`
- `errors`

同时统一增加以下主字段：

- `final_status`
- `blocking_error_count`
- `warning_count`
- `summary`

说明：

- `passed` 是兼容字段，表示是否可继续
- `final_status` 才是后续日志、repair loop、artifact manifest 的主状态字段

建议枚举：

- `PASS`
- `WARN`
- `FAIL`

### 8.2 ValidationCheck

`ValidationCheck` 统一字段建议为：

- `name`
- `passed`
- `severity`
- `details`
- `file_path`
- `code`

其中：

- `severity` 统一使用：
  - `blocking`
  - `warning`
  - `info`

### 8.3 ValidationError

`ValidationError` 统一字段建议为：

- `code`
- `message`
- `file_path`
- `severity`

---

## 9. Artifact 统一词表

### 9.1 ArtifactManifest

`ArtifactManifest` 是 artifact 内部元数据对象。

统一字段：

- `source_type`
- `decision`
- `source_repo_url`
- `commit_sha`
- `generated_files`
- `modified_files`
- `dockerfile_path`
- `start_command`
- `exposed_port`
- `required_envs`
- `validation_summary`

建议补充字段：

- `artifact_type`
- `project_root`
- `warnings`
- `created_at`

### 9.2 DeployArtifact

`DeployArtifact` 是 package 阶段统一输出对象。

主字段冻结为：

- `artifact_path`
- `artifact_type`
- `ready_for_deploy`
- `warnings`
- `manifest_path`
- `project_root`
- `dockerfile_path`
- `start_command`
- `exposed_port`

说明：

- 这里直接把部署侧最常用的运行字段平铺返回
- 不要求部署侧再去解析 manifest 才能拿到启动信息

### 9.3 artifact_type 统一枚举

统一只允许：

- `TEMPLATE_PROJECT`
- `STITCHED_PROJECT`

约束：

- A => `STITCHED_PROJECT`
- B => `STITCHED_PROJECT`
- C 简单模板 => `TEMPLATE_PROJECT`
- C 复杂重组 => `STITCHED_PROJECT`
- D => 不得产生 `artifact_type`

---

## 10. 命名冲突与废弃词

以下名字统一视为废弃或仅兼容保留：

### 10.1 selected_repo

废弃原因：

- 语义不稳定
- 有时表示 URL，有时表示候选对象

统一替换为：

- `source_repo_url`

### 10.2 run_command

废弃原因：

- 与 `docker_spec.start_command` 语义重复

统一替换为：

- `docker_spec.start_command`

兼容场景：

- 外部 prompt 或旧代码提到 `run_command` 时，解释为 `docker_spec.start_command`

### 10.3 container_port

废弃原因：

- 与 `docker_spec.exposed_port` 重复

统一替换为：

- `docker_spec.exposed_port`

### 10.4 repo_url vs source_repo_url

统一规则：

- `repo_url`
  - 只用于 `RepoInfo` / 原始仓库输入

- `source_repo_url`
  - 用于 plan / workspace / artifact / profile 等后续阶段

### 10.5 required_envs

统一规则：

- 内部对象用 `env_vars`
- 对下游 artifact 响应用 `required_envs`

---

## 11. 上下游接口映射

### 11.1 上游 -> FallbackRequest

上游接口字段映射：

- `raw_query` -> `FallbackRequest.raw_query`
- `target_*` / `expected_features` / `preferred_*` / `constraints` -> `FallbackRequest.user_intent.*`
- `rank` / `retrieval_score` / `repo_url` / `default_branch` / `description` / `topics` / `stars` / `is_archived` / `last_commit_at` -> `FallbackRequest.repo_info.*`
- `file_tree` -> `FallbackRequest.file_tree`
- `key_files` -> `FallbackRequest.key_files`

### 11.2 FallbackPlan -> 下游 artifact 响应

内部到下游的统一映射：

- `plan.artifact_type` -> `artifact_type`
- `deploy_artifact.artifact_path` -> `artifact_path`
- `plan.docker_spec.dockerfile_content` -> `dockerfile_content`
- `plan.docker_spec.base_image` -> `runtime.base_image`
- `plan.docker_spec.package_manager` -> `runtime.package_manager`
- `plan.docker_spec.install_command` -> `runtime.install_command`
- `plan.docker_spec.start_command` -> `runtime.start_command`
- `plan.docker_spec.exposed_port` -> `runtime.exposed_port`
- `plan.docker_spec.healthcheck_path` -> `runtime.healthcheck_path`
- `plan.env_vars` -> `required_envs`
- `plan.warnings` -> `warnings`
- `plan.summary` -> `summary`
- `deploy_artifact.ready_for_deploy` -> `deploy_ready`
- `plan.next_action` -> `next_action`

---

## 12. 当前代码对齐建议

为了让后续实现不返工，建议按这份词表优先对齐以下三处：

1. `FallbackPlan`
   - 统一以 `docker_spec.start_command` / `docker_spec.exposed_port` 为主词
   - 不再扩散 `run_command` / `container_port`

2. `DeployArtifact`
   - 直接包含：
     - `project_root`
     - `dockerfile_path`
     - `start_command`
     - `exposed_port`
   - 不把这些运行字段只藏在 manifest 里

3. `ValidationResult`
   - 保留现有 `passed/checks/errors`
   - 增补：
     - `final_status`
     - `blocking_error_count`
     - `warning_count`
     - `summary`

---

## 13. 一句话版本

后续所有实现统一按下面这条主线理解：

- 上游输入看 `FallbackRequest`
- 分类输出看 `ClassifyResponse`
- 求解输出看 `FallbackPlan`
- 真实落地看 `WorkspaceContext / MaterializeResult`
- 校验结果看 `ValidationResult`
- 最终交付看 `DeployArtifact`

而运行时主字段永远优先使用：

- `source_repo_url`
- `docker_spec.start_command`
- `docker_spec.exposed_port`
- `env_vars`
- `artifact_type`
- `artifact_path`
