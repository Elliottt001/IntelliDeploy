你现在要实现 `solvers/b_patch_repo/patch_apply_plan.py`。

功能
- 将 patch 生成结果整理成可落盘的结构化计划。

上游信息接口
- 输入：GeneratedFile[]、ModifiedFile[]、MissingComponentReport。

下游信息接口
- 输出：PatchApplyPlan。
- 供 services/patch_applier.py 使用。

实现
- 计划中必须包含目标路径、操作类型(create/update)、内容摘要、风险说明。
- 为每个变更标记来源缺口和回滚依据。
- 结构必须适合 patch_applier 顺序执行。

不接受的实现方式
- 不要把 patch_apply_plan 做成自然语言段落。
- 不要丢失目标路径与操作类型。

验收标准
- patch_applier 可直接消费。
