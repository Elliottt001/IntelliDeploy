你现在要实现 `validators/env_validator.py`。

功能
- 校验环境变量声明来源是否可靠。

上游信息接口
- 输入：FallbackPlan.env_vars、RepoProfile.detected_env_vars、workspace 中的 `.env.example` 或源码证据。
- 来源：A/B/C。

下游信息接口
- 输出：ValidationCheck 列表。

实现
- 检查 generated env_vars 是否来自 detected_env_vars、用户需求或模板明示。
- 对 `ASSUMED` 类型变量默认警告或阻断，规则要可配置。
- 检查必填变量是否有说明、示例值、来源。
- 防止 LLM 凭空生成 OPENAI_API_KEY、DATABASE_URL 等。

不接受的实现方式
- 不要只比较名称集合，不看来源。
- 不要默许幻觉变量进入 deploy-ready 结果。

验收标准
- 能明确识别真实变量与假设变量。
