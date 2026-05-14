你现在要实现 `solvers/c_vibe_scaffold/solve.py`。

功能
- 为 C 类生成完整脚手架计划。
- C 类部署对象不是原仓库，而是将在 workspace 中新生成的项目。

上游信息接口
- 输入：FallbackRequest、EvaluationResult、RepoProfile。
- 依赖：scaffold_router、scaffold_generate、component_reassembly、scaffold_postprocess。

下游信息接口
- 输出：FallbackPlan。
- plan 中必须包含生成文件、项目结构、artifact_type。

实现
- 先确定走简单模板还是复杂重组。
- C 类 plan 必须能直接在空 workspace 中落成完整项目。
- 补 README、Dockerfile、.env.example、healthcheck 属于 plan 一部分。
- 简单模板产物类型为 `TEMPLATE_PROJECT`，复杂重组为 `STITCHED_PROJECT`。

不接受的实现方式
- 不要再把原仓库当部署对象。
- 不要只给“建议怎么做”，必须给完整生成计划。

验收标准
- plan 足以直接生成项目目录。
