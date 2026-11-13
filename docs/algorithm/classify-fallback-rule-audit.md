# Legacy fallback classification rule audit

状态：迁移实施中。MIGRATE 不代表已完成。旧 C/D 仅为历史枚举。

| Rule ID | Legacy source and branch | Meaning | Status | New owner | New test and runtime caller | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| CLS-UNCLEAR-MATERIAL | fallback/rules.apply_hard_rules / apply_final_rules | 意图不明且资料不足 | COVERED | requirements | tests/phase1/test_requirement_revision.py; backend/app/jobs/execution.py | 追问业务信息，不能映射产品 D |
| CLS-NO-REAL-CODE | fallback/rules.apply_hard_rules; scoring.build_candidate_decision | 空仓库/文档/库不能直接交付 | COVERED | ranking | tests/phase1/test_hybrid_routing.py; backend/app/agent/routing.py | 不以热度替代应用覆盖 |
| CLS-RUNTIME-CHAIN | fallback/classify._runtime_chain_closed; extract_facts | 入口、依赖与端口链 | MIGRATE | packaging | tests/phase1/test_packaging_plan.py; backend/app/jobs/execution.py | 用当前文件核对 |
| CLS-PACKAGING-ONLY-A | fallback/rules.apply_final_rules; scoring.build_candidate_decision | 只缺打包保留 A | MIGRATE | packaging | tests/phase1/test_packaging_plan.py; backend/app/jobs/execution.py | 禁止业务重写 |
| CLS-LIMITED-REPAIR-B | fallback/rules.apply_final_rules; classify._heuristic_ai_review | 局部修复主仓库 | MIGRATE | gaps | tests/phase1/test_gap_plan.py; backend/app/jobs/execution.py | 验收 ID 约束 |
| CLS-REWRITE-COST | fallback/rules.apply_final_rules | 修复成本接近重写 | MIGRATE | gaps | tests/phase1/test_gap_plan.py; backend/app/agent/routing.py | 明确成本证据再做路线决定 |
| CLS-OLD-C-REGENERATE | fallback/classify._decide_generation_mode / build_hu_generation_request | C 表示重新生成 | REJECTED | routing | tests/phase1/test_hybrid_routing.py; backend/app/agent/routing.py | 新 C 是多来源组合 |
| CLS-OLD-D-MANUAL | fallback/rules.apply_final_rules | D 表示人工或信息不足 | REJECTED | requirements | tests/phase1/test_requirement_revision.py; backend/app/jobs/execution.py | 人工状态用 WAITING_USER |
| CLS-MISSING-COMPONENT | fallback/solvers/b_patch_repo/missing_component.classify_missing_component | 缺失组件和可选打包项 | MIGRATE | gaps | tests/phase1/test_gap_plan.py; backend/app/jobs/execution.py | 未知业务缺口不能 warning 放行 |
| CLS-UNKNOWN-SOFT | fallback/rules._hard_blockers; scoring.should_call_classification_ai | 不确定项与 review | COVERED | policy | tests/phase1/test_orchestration_policy.py; backend/app/jobs/execution.py | 确定性策略判断审查强度 |
| CLS-SCORE-WEIGHTS | fallback/scoring._build_evaluation_score | 部署评分与小量热度 | COVERED | ranking | tests/phase1/test_candidate_ranking.py; backend/app/agent/routing.py | 五维证据代替历史总分 |
| CLS-AI-OVERLAY | fallback/classify.call_classification_ai_if_needed | 语义审查覆盖 heuristic | COVERED | routing | tests/phase1/test_hybrid_routing.py; backend/app/agent/routing.py | 模型路线仍须硬验证 |
| CLS-LEGACY-HANDOFF | fallback/classify.build_hu_generation_request | 旧项目/部署 ID 和 hu payload | LEGACY_ONLY | none | tests/phase1/none; backend/app/none | 不恢复另一套运行系统 |
| CLS-STACK-PREFERENCE | fallback/extract_facts._preferred_stack | 模板框架选择 | LEGACY_ONLY | none | tests/phase1/none; backend/app/none | D 已有固定脚手架 A/B 保留真实栈 |
