你现在要实现 `validators/validation_pipeline.py`。

功能
- 统一执行 plan 校验和 workspace 校验。
- 为 A/B/C 输出单一 ValidationResult。

上游信息接口
- 输入：FallbackPlan、WorkspaceContext、RepoProfile。
- 依赖：dockerfile_validator、package_manager_validator、env_validator、port_validator、entrypoint_validator、output_validator、workspace_validator。

下游信息接口
- 输出：ValidationResult。
- 供 fallback_service、artifact_builder 使用。

实现
- 执行顺序固定：output_validator -> 细项 plan 校验 -> workspace_validator。
- 对 A/B/C 自动按 decision 选择必要校验项。
- 聚合所有 check，不要首错即停。
- 生成 final_status、blocking_error_count、warning_count、summary。
- 允许注入 repair loop 所需的 error_context。

不接受的实现方式
- 不要把具体校验逻辑写回 pipeline。
- 不要遗漏 workspace 维度。

验收标准
- 单个入口能给出完整校验报告。
- 报告既可给 repair loop，也可给 artifact_builder。
