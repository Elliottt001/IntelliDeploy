文件：classifier/rules.py

功能

- 实现硬规则截断。
- 实现 AI 审查后的最终落类规则。
- 这是“最终规则层”。

上游信息接口
输入来自：

- user_intent_summary
- repo_fact_summary
- candidate_decision
- 分类 AI 输出中间字段

下游信息接口
输出给 classify.py：

- decision
- reason
- why_not_A
- repair_targets
- missing_information
- requires_user_confirmation

实现

必须实现的函数

1. apply_hard_rules(...)
2. apply_final_rules(...)

硬规则截断：

直接 D：
如果：

- user_intent_state = unclear
- 且 repo_material_state = insufficient

输出 D。

直接 C：
如果：

- user_intent_state = clear 或 partially_clear
- 且 repo_material_state = insufficient
- 且 has_real_code = false

输出 C。

归档仓库：
如果：

- is_archived = true

只加入 warning：

- repository_archived

不要因为归档直接判 C 或 D。

最终落类：

D：
如果：

- user_intent_clear = false
- 且 repo_purpose_unknown = true

输出 D。

如果：

- uses_original_repo_as_base 无法判断

输出 D。

如果：

- runtime_chain_closed = unknown
- 且 requires_repo_code_modification 无法判断

输出 D。

如果：

- missing_information 非空
- 且这些缺失信息会阻塞 A/B/C 判断

输出 D。

C：
如果：

- uses_original_repo_as_base = false
- 且 user_intent_clear = true

输出 C。

如果：

- repo_matches_user_intent = false
- 且 user_intent_clear = true
- 且仓库和用户需求严重不匹配

输出 C。

如果：

- uses_original_repo_as_base = true
- 且 requires_repo_code_modification = true
- 且 repair_cost_close_to_rewrite = true
- 且 user_intent_clear = true

输出 C。

A：
如果：

- uses_original_repo_as_base = true
- 且 repo_matches_user_intent = true
- 且 runtime_chain_closed = true
- 且 requires_repo_code_modification = false

输出 A。

B：
如果：

- uses_original_repo_as_base = true
- 且 repo_matches_user_intent = true
- 且 requires_repo_code_modification = true
- 且 repair_scope_limited = true

输出 B。

兜底：
以上都不能稳定分类时，输出 D。

强制边界：

1. 缺 Dockerfile 不算 B。
2. 缺 docker-compose.yml 不算 B。
3. 缺 .env.example 不算 B。
4. 缺部署说明不算 B。
5. 缺 Sealos / Kubernetes 配置不算 B。
6. README 不完整不等于 B。
7. 文件存在不等于运行链路闭合。
8. 技术栈明确不等于无需修源码。
9. 入口存在不等于入口能运行。
10. A_candidate 必须审查运行链路和源码修正必要性。
11. 只有需要修改源码、依赖、入口、脚本、配置或项目结构，才是 B。
12. 只有不再以原仓库作为主体，才是 C。
13. 信息不足才是 D。
14. 判断依据不足时，优先 D。
15. 不要把部署包装问题误判为项目修复问题。
16. 不要把项目修复问题误判为部署包装问题。
