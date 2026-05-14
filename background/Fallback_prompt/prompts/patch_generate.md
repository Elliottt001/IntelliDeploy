你现在要编写 `prompts/patch_generate.md`。

功能
- 指导 LLM 为 B 类生成最小必要补丁。

上游信息接口
- 输入：missing_components、repo_context、error_context、allowed_edit_scope、relevant_source_files。

下游信息接口
- 输出：严格 JSON，包含 generated_files、modified_files、patch_rationale、need_more_code。

实现
- 明确只修当前缺口，不准无关重构。
- 若上下文不足，先输出 `need_more_code` 和 `required_files`，不要硬修。
- 每个修改都要给目标路径和修改原因。
- 禁止生成无来源环境变量和无证据启动命令。

验收标准
- 输出能直接被 `patch_apply_plan.py` 和 `patch_applier.py` 消费。
