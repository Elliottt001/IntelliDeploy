你现在要编写 `prompts/component_reassembly.md`。

功能
- 指导 LLM 根据组件列表重组出完整项目计划。

上游信息接口
- 输入：components、preferred_stack、template_constraints、runtime_constraints。

下游信息接口
- 输出：严格 JSON，包含 generated_files、modified_files、project_structure、docker_spec。

实现
- 明确组件间连接方式、路由、依赖、入口。
- 输出必须闭合成完整项目，而不是组件集合。
- 必须包含部署必需文件。
- 严禁只给高层描述。

验收标准
- 结果能直接给 `scaffold_postprocess.py` 和 workspace materialize 使用。
