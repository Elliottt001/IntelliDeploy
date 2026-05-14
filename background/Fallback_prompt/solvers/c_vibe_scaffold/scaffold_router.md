你现在要实现 `solvers/c_vibe_scaffold/scaffold_router.py`。

功能
- 在 C 类中判定走模板生成还是组件重组。

上游信息接口
- 输入：FallbackRequest、RepoProfile、EvaluationResult。

下游信息接口
- 输出：ScaffoldStrategy，至少包含 route、reason、complexity_score。

实现
- 判断维度包括：需求复杂度、组件数量、依赖外部系统数量、是否需要复用原仓库模块。
- 简单需求走 scaffold_generate，复杂需求走 component_reassembly。
- 判定结果要可解释，不要黑盒。

不接受的实现方式
- 不要硬编码“只要是 C 就都走某一条路”。
- 不要把复杂度判断写成纯主观描述。

验收标准
- 路由结果稳定、可追踪。
