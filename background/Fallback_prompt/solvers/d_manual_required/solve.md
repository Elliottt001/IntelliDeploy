你现在要实现 `solvers/d_manual_required/solve.py`。

功能
- 为 D 类输出缺失信息与人工补充建议。
- D 类不进入 materialize 和 package。

上游信息接口
- 输入：FallbackRequest、EvaluationResult、RepoProfile。
- 依赖：missing_info_builder。

下游信息接口
- 输出：FallbackPlan，包含 missing_information、manual_review_reason。

实现
- 明确列出缺失字段、缺失证据、为什么不能进入自动处理。
- plan 中不得包含 artifact、workspace、generated_files 等执行性字段。
- 建议补充项要结构化，可直接返回上游。

不接受的实现方式
- 不要调用 AI 乱生成项目。
- 不要让 D 类偷偷进入后续流程。

验收标准
- 输出足够让上游重新补齐并重走主链路。
