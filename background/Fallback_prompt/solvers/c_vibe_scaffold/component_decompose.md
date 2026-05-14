你现在要实现 `solvers/c_vibe_scaffold/component_decompose.py`。

功能
- 将自然语言需求拆成可实现的标准组件集合。

上游信息接口
- 输入：user_intent、RepoProfile 语义线索、preferred_stack。
- 依赖：component_decompose.md。

下游信息接口
- 输出：ComponentSpec[]。
- 供 component_reassembly 使用。

实现
- 每个组件至少包含 name、purpose、inputs、outputs、dependencies、files_to_generate。
- 组件必须能映射到实际文件和模块，而不是概念标签。
- 对 Auth、Chat UI、CRUD API、Payment、Dashboard 等通用能力可标准化。

不接受的实现方式
- 不要只输出松散需求分点。
- 不要不给依赖关系和输入输出。

验收标准
- 组件拆解能直接驱动后续重组。
