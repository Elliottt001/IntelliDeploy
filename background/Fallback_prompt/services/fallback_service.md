你现在要为 IntelliDeploy 的 fallback 模块实现 `services/fallback_service.py`。

功能
- 作为后处理总编排入口。
- 串联 `classify -> solve_plan -> materialize -> validate -> package`。
- 屏蔽内部 solver、workspace、validator、artifact 细节。

上游信息接口
- 输入：FallbackRequest。
- 依赖：classifier、solvers/router、workspace_manager、validation_pipeline、artifact_builder。

下游信息接口
- 输出：ClassifyResponse、FallbackPlan、MaterializeResult、ValidationResult、DeployArtifact。
- 对外暴露方法：evaluate()、solve_plan()、materialize()、validate()、package()、run_pipeline()。

实现
- 不要在这里写具体业务规则；这里只做流程编排和错误传递。
- `run_pipeline()` 对 A/B/C 正常走完整链路，对 D 只返回 missing_information，不进入 materialize/package。
- 统一记录 task_id、decision、source_repo_url、status。
- 每一步失败都返回结构化错误，不允许 silent fail。
- 校验顺序固定：先 plan 校验，再 workspace 校验。

不接受的实现方式
- 不要把源码拉取、patch 落盘、artifact 打包写进这里。
- 不要跨层直接操作文件系统。

验收标准
- A/B/C 能完整返回 DeployArtifact。
- D 不生成 workspace 和 artifact。
- 流程边界清晰，可单测。
