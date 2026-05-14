你现在要实现 `solvers/c_vibe_scaffold/scaffold_generate.py`。

功能
- 基于模板直接生成完整项目骨架计划。

上游信息接口
- 输入：user_intent、preferred_stack、templates、RepoProfile 语义摘要。
- 依赖：scaffold_generate.md、template_loader。

下游信息接口
- 输出：GeneratedFile[]、project_structure、runtime spec。

实现
- 从 templates 中选择基础模板，让 AI 只填业务文件。
- 必须输出完整 GeneratedFile 列表，而不是抽象说明。
- 要生成最小可运行项目，不要扩展无关功能。
- README、Dockerfile、env.example、healthcheck 必须纳入计划。

不接受的实现方式
- 不要从零自由拼整个项目而不依赖模板。
- 不要遗漏入口文件与依赖文件。

验收标准
- 输出的计划能在空 workspace 中直接落地。
