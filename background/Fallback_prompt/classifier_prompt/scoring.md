文件：classifier/scoring.py

功能

- 不做传统加权总分驱动的分类。
- 这里负责生成候选决策 candidate_decision 和决策信号 decision_signals。
- 这是“分类前判断层”。

上游信息接口
输入来自：

- user_intent_summary
- repo_fact_summary

下游信息接口
输出给 classify.py：
{
  "candidate_decision": "A_candidate | B_candidate | C_candidate | D_candidate | unknown",
  "candidate_reason": "string",
  "decision_signals": {
    "a_signals": [],
    "b_signals": [],
    "c_signals": [],
    "d_signals": [],
    "blocking_signals": [],
    "repair_signals": [],
    "missing_information": []
  },
  "evaluation_score": "integer | null",
  "ai_review_required": "boolean",
  "ai_review_reason": []
}

并且：

- evaluation_score 后续可映射到下游接口 A 的 evaluation_score
- 但它不是最终分类唯一依据

必须实现的函数

1. build_candidate_decision(...)
2. build_decision_signals(...)
3. should_call_classification_ai(...)

实现
A_candidate 形成条件：

- has_real_code = true
- detected_language != unknown
- detected_project_type_by_rule != unknown 或 detected_project_type_by_semantics != unknown
- has_dependency_file = true
- has_entry_file = true 或 has_start_script = true
- missing_items 主要是 Dockerfile、docker-compose.yml、.env.example、部署说明、Sealos/Kubernetes 配置
- 没有明显严重冲突

要求：

- A_candidate 不能直接等于 A
- A_candidate 默认进入 AI 审查

B_candidate 形成条件：

- 仓库有真实代码
- 仓库可能可以作为项目主体
- runtime_chain_observations 中存在 false 或 unknown
- conflict_items 非空
- 启动脚本缺失
- 入口不明显
- 依赖和入口可能不一致
- README 和 scripts 不一致
- Dockerfile 和项目结构不一致
- 端口、host、环境变量存在部署风险
- package.json scripts 不完整

C_candidate 形成条件：

- repo_empty_or_near_empty = true
- only_docs_or_notes_or_template = true
- detected_project_type_by_rule = library 且用户需求是完整可部署应用
- 仓库用途和用户需求可能严重不匹配
- 修复成本可能接近重写

D_candidate 形成条件：

- user_intent_state = unclear
- repo_material_state = partial 或 insufficient
- uncertain_points 非空
- 关键文件不足
- 存在多个可能处理路径
- 需要用户确认 MCP / Web / API / 脚本方向

ai_review_required 规则：
除硬规则直接 D/C 外，以下情况为 true：

- candidate_decision = A_candidate
- candidate_decision = B_candidate
- candidate_decision = C_candidate
- candidate_decision = D_candidate
- candidate_decision = unknown
- repo_material_state = partial
- user_intent_state = partially_clear 且仓库不是明显空仓库
- detected_project_type_by_rule = unknown
- detected_framework = unknown 且 has_real_code = true
- uncertain_points 非空
- conflict_items 非空
- runtime_chain_observations 中存在 unknown
- runtime_chain_observations 中存在 false
- 仓库用途需要语义判断
- 仓库和用户需求是否匹配不确定
- 是否保留原仓库作为主体不确定
- 是否需要修改源码或项目结构不确定
- 运行链路是否闭合不确定
- 修复范围是否有限不确定
- 修复成本是否接近重写不确定

注意

- 不做最终 A/B/C/D。
- evaluation_score 可保留，但不能主导分类。
- 不让评分逻辑回到老式“分数高就是 A”。
