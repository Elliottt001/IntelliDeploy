你现在要实现 `solvers/router.py`。

功能
- 根据 EvaluationResult.decision 路由到 A/B/C/D solver。
- 统一对外提供 `solve_by_decision()`。

上游信息接口
- 输入：EvaluationResult、FallbackRequest、RepoProfile。
- 依赖：a_direct_deploy.solve、b_patch_repo.solve、c_vibe_scaffold.solve、d_manual_required.solve。

下游信息接口
- 输出：FallbackPlan。

实现
- 路由逻辑必须清晰、纯粹。
- 不在 router 中加入业务修补逻辑。
- 对未知 decision 返回结构化异常。
- 保留 decision、source_repo_url、risk/conflict 信息传递给下游 solver。

不接受的实现方式
- 不要把 A/B/C/D 代码写进一个超长 if 大函数里。
- 不要在 router 直接调用文件系统。

验收标准
- 输入 decision 后能稳定返回对应 plan。
