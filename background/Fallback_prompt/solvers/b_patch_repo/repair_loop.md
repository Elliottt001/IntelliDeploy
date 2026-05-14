你现在要实现 `solvers/b_patch_repo/repair_loop.py`。

功能
- 管理 B 类修补重试流程。
- 在 validate 失败后基于错误上下文重新生成 patch。

上游信息接口
- 输入：FallbackPlan、ValidationResult、retry_count、RepoProfile。
- 依赖：patch_generate、repair_reflection prompt。

下游信息接口
- 输出：新的 FallbackPlan 或转 C 的决策建议。

实现
- 最大重试次数配置化，如 MAX_REPAIR_RETRIES。
- 每次重试必须带上上一次 patch 和本次错误摘要。
- 当错误已超出 B 类局部修补能力时，明确输出转 C。
- 保留每轮重试历史，便于日志与 manifest 记录。

不接受的实现方式
- 不要无限重试。
- 不要忽略前一轮失败原因重复生成同类 patch。

验收标准
- 能在有限轮次内做出修补或转 C 决策。
