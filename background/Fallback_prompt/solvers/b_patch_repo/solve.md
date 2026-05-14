你现在要实现 `solvers/b_patch_repo/solve.py`。

功能
- 为 B 类生成修补计划，不直接修改源码目录。
- 目标是在 workspace 中真正应用 patch 后达到 deploy-ready。

上游信息接口
- 输入：FallbackRequest、EvaluationResult、RepoProfile。
- 依赖：missing_component、patch_generate、patch_apply_plan。

下游信息接口
- 输出：FallbackPlan。

实现
- 先识别缺失组件，再按缺口生成 GeneratedFile / ModifiedFile。
- plan 必须说明 patch 意图、目标路径、理由、与缺口对应关系。
- 默认 artifact_type=`STITCHED_PROJECT`。
- B 类允许局部修补部署相关代码或配置，但不能演化成整仓重写。
- 给 repair_loop 留出 error_context 接口。

不接受的实现方式
- 不要直接写 workspace。
- 不要把 B 类做成 C 类重构。

验收标准
- plan 明确可执行，且与缺失组件一一对应。
