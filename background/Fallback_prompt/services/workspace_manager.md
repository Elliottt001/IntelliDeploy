你现在要实现 `services/workspace_manager.py`。

功能
- 管理 `workspaces/{task_id}` 生命周期。
- 创建 source/workspace/logs/metadata 目录。
- 承担 materialize 阶段的主入口。

上游信息接口
- 输入：task_id、decision、FallbackPlan、RepoProfile、SourceFetchResult。
- 依赖：source_fetcher、patch_applier。

下游信息接口
- 输出：WorkspaceContext、MaterializeResult。
- 供 validation_pipeline、artifact_builder 使用。

实现
- 提供 `create_task_workspace()`、`materialize_a()`、`materialize_b()`、`materialize_c()`、`write_metadata()`、`clone_source_to_workspace()`。
- A/B：source 拉取后复制到 workspace，所有修改只发生在 workspace。
- C：直接创建空 workspace，再根据 plan 落成完整项目。
- metadata.json 必须记录 decision、source_repo_url、commit_sha、artifact_type、status、timestamps。
- 路径处理必须安全，禁止越界写入。
- 必须保留 source 基线，不可污染。

不接受的实现方式
- 不要把 artifact 打包放在这里。
- 不要在这里做业务规则判断替代 solver。

验收标准
- 能创建完整工作区结构。
- A/B/C 的 workspace 都能正确落地。
