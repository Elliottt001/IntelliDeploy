你现在要实现 `solvers/a_direct_deploy/solve.py`。

功能
- 为 A 类生成最小补充计划，不修改真实源码目录。
- 目标是让后续 materialize 能在 workspace 中补齐部署文件。

上游信息接口
- 输入：FallbackRequest、EvaluationResult、RepoProfile。
- 可使用：dockerfile_reuse、dockerfile_generate、command_resolver。

下游信息接口
- 输出：FallbackPlan。
- plan 中可包含 GeneratedFile、DockerSpec、EnvVarSpec、artifact_type。

实现
- A 类只允许补 Dockerfile、.env.example、启动脚本、轻量部署配置。
- 不改业务代码。
- 若已有 Dockerfile，优先复用并标记需要 lint；若缺失且信息足够，再生成模板化 Dockerfile。
- 明确 artifact_type=`STITCHED_PROJECT`。
- plan 必须足以支撑后续 workspace materialize。

不接受的实现方式
- 不要直接拉源码或写文件。
- 不要把 A 类做成大规模修补。

验收标准
- 产出的 plan 简洁、闭合、可 materialize。
