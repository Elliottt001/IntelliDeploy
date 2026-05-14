你现在要实现 `solvers/c_vibe_scaffold/scaffold_postprocess.py`。

功能
- 对 C 类生成计划做统一后处理，补齐部署必需文件。

上游信息接口
- 输入：FallbackPlan 或 GeneratedFile[]、project_structure、runtime spec。

下游信息接口
- 输出：更新后的 FallbackPlan。

实现
- 统一文件路径。
- 补 README、Dockerfile、.env.example、healthcheck、start script。
- 规范 artifact_type、docker_spec.start_command、docker_spec.exposed_port、env_vars。
- 确保后处理后的 plan 可直接进入 materialize 和 validate。

不接受的实现方式
- 不要在这里再做大规模需求重写。
- 不要遗漏部署关键文件。

验收标准
- C 类 plan 经后处理后可直接落地和打包。
