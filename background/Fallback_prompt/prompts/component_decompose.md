你现在要编写 `prompts/component_decompose.md`。

功能
- 指导 LLM 将 C 类复杂需求拆成标准组件。

上游信息接口
- 输入：user_intent、repo_semantic_hints、preferred_stack、constraints。

下游信息接口
- 输出：严格 JSON，包含 components[]，每项有 name、purpose、inputs、outputs、dependencies、files_to_generate。

实现
- 组件拆分必须服务于后续可运行项目，不是需求罗列。
- 要体现依赖关系和文件落点。
- 禁止抽象成无法实现的概念模块。

验收标准
- `component_reassembly.py` 可直接消费。
