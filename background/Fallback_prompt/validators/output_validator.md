你现在要实现 `validators/output_validator.py`。

功能
- 校验 FallbackPlan 作为 solve 产物是否完整、自洽。

上游信息接口
- 输入：FallbackPlan。

下游信息接口
- 输出：ValidationCheck 列表。

实现
- 检查 generated_files、modified_files、docker_spec.start_command、docker_spec.exposed_port、docker_spec、artifact_type 等字段完整性。
- A/B/C/D 分 decision 做不同必填约束。
- D 类必须有 missing_information，且不得包含 artifact 相关字段。
- A/B/C 若要进入 materialize，必须至少有明确执行计划。

不接受的实现方式
- 不要只检查是否为非空 dict。
- 不要把业务校验写到这里。

验收标准
- plan 不合格时能在 materialize 前拦住。
