你现在要编写 `prompts/output_format.md`。

功能
- 为所有运行时 prompt 提供统一输出格式约束。

上游信息接口
- 输入：无固定业务输入，作为通用附加约束被其他 prompt 引用。

下游信息接口
- 输出：统一 JSON 格式要求。

实现
- 明确禁止 markdown code fence、解释性散文、额外字段、尾逗号。
- 明确要求字段名与 schema 完全一致。
- 明确遇到上下文不足时应返回 `need_more_code`、`required_files` 或结构化错误，而不是编造内容。
- 明确空数组、空对象、null 的使用规则。

验收标准
- 所有运行时 prompt 都能复用该约束。
