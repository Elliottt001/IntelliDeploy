你现在要为 IntelliDeploy 的 fallback 模块实现 `schemas/workspace.py`。

功能
- 定义真实工作区与制品化阶段的数据结构。
- 明确 source、workspace、artifacts 三层对象及其状态。
- 为 materialize、validate、package 阶段提供统一类型。

上游信息接口
- 输入来源：FallbackPlan、EvaluationResult、RepoProfile、ValidationResult。
- 任务目录结构固定为 `workspaces/{task_id}/source`、`workspaces/{task_id}/workspace`、`artifacts/{task_id}`。

下游信息接口
- 供 `services/workspace_manager.py`、`services/artifact_builder.py`、`validators/workspace_validator.py` 使用。
- 输出对象至少包括：WorkspacePaths、WorkspaceContext、MaterializeResult、ArtifactManifest、DeployArtifact。

实现
- 使用 Pydantic 或 dataclass，字段必须明确、可序列化。
- `WorkspacePaths` 必须包含 source_path、workspace_path、logs_path、artifact_path、metadata_path。
- `ArtifactManifest` 必须包含 source_type、decision、source_repo_url、commit_sha、generated_files、modified_files、dockerfile_path、start_command、exposed_port、required_envs、validation_summary。
- `DeployArtifact` 必须包含 artifact_path、artifact_type、ready_for_deploy、warnings、manifest_path。
- 所有路径字段使用 Path 或标准化字符串，不允许自由散落。

不接受的实现方式
- 不要把运行态临时变量和持久化元数据混在一个对象里。
- 不要只有 dict，不要缺少类型边界。

验收标准
- 数据结构能完整承载 A/B/C 物化与打包结果。
- 能直接被其他服务导入，不需要二次补字段。
