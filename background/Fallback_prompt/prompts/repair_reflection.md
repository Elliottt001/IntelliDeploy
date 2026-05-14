你现在要编写 `prompts/repair_reflection.md`。

功能
- 指导 LLM 在 B 类修复失败后进行下一轮补丁反思。

上游信息接口
- 输入：last_patch、validation_errors、workspace_error_summary、retry_count、allowed_scope。

下游信息接口
- 输出：严格 JSON，包含 revised_patch、failure_analysis、should_escalate_to_c。

实现
- 强制分析上轮失败原因，不允许重复生成同类补丁。
- 如果错误超出局部修补边界，要明确建议转 C。
- 反思必须围绕具体错误和文件，不输出空泛文字。

验收标准
- repair_loop 可直接消费输出。
