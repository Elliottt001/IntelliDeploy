你现在要实现 `services/source_fetcher.py`。

功能
- 拉取原仓库源码到 `workspaces/{task_id}/source`。
- 提供统一的源码获取入口。

上游信息接口
- 输入：source_repo_url、default_branch、commit_sha（可选）、task_id。
- 来源：A/B 类 materialize 阶段。

下游信息接口
- 输出：SourceFetchResult，至少包含 source_path、resolved_commit_sha、default_branch、logs。
- 供 `workspace_manager.py` 使用。

实现
- 支持 clone 和 archive download 两种策略，优先使用仓库地址已有能力。
- 拉取后的 source 目录视为只读基线。
- 需要记录拉取命令、分支、commit、失败原因。
- 对已有目录要支持覆盖前清理或安全重建。
- 明确异常类型，如 RepoFetchError、RepoNotFoundError、RepoAuthError。

不接受的实现方式
- 不要把源码直接拉到 workspace。
- 不要把 git 命令散落到别的模块。

验收标准
- 给定 source_repo_url 后能稳定得到 source_path。
- 失败时错误结构化、可追溯。
