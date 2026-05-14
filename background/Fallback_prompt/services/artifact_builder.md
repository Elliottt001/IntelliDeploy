你现在要实现 `services/artifact_builder.py`。

功能
- 将最终 workspace 导出为 artifact。
- 生成最终部署目录与 artifact_manifest.json。

上游信息接口
- 输入：WorkspaceContext、ValidationResult、FallbackPlan。
- 来源：package(artifact) 阶段。

下游信息接口
- 输出：DeployArtifact。
- 给部署侧提供 artifact_path、manifest_path、dockerfile_path、project_root、start_command、exposed_port。

实现
- 支持目录型 artifact 为主，预留 zip/远端存储扩展点。
- package 时从 workspace 复制到 `artifacts/{task_id}`。
- 生成 `artifact_manifest.json`，记录来源仓库、decision、artifact_type、应用 patch、最终 Dockerfile、env、校验结果。
- artifact 内必须是完整可部署项目，不允许只写元数据。
- A/B 产物类型默认 `STITCHED_PROJECT`；C 依 plan 标记 `TEMPLATE_PROJECT` 或 `STITCHED_PROJECT`。

不接受的实现方式
- 不要直接把 workspace 当成 artifact 返回。
- 不要只返回 dockerfile_content 和 start_command 这类摘要。

验收标准
- artifact_path 下能看到完整项目目录和 artifact_manifest.json。
- 部署侧可以直接消费。
