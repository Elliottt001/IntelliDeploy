# Legacy fallback classification rule audit

状态：本地迁移实现与主链联调已完成。旧 C/D 仅为历史枚举；真实外部收益评测仍为 NOT_RUN。

| Rule ID | Legacy source and branch | Meaning | Status | New owner | New test and runtime caller | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| CLS-UNCLEAR-MATERIAL | fallback/rules.apply_hard_rules / apply_final_rules | 意图不明且资料不足 | COVERED | requirements | tests/phase1/test_requirement_revision.py; backend/app/jobs/execution.py | 追问业务信息，不能映射产品 D |
| CLS-NO-REAL-CODE | fallback/rules.apply_hard_rules; scoring.build_candidate_decision | 空仓库/文档/库不能直接交付 | COVERED | ranking | tests/phase1/test_hybrid_routing.py; backend/app/agent/routing.py | 不以热度替代应用覆盖 |
| CLS-RUNTIME-CHAIN | fallback/classify._runtime_chain_closed; extract_facts | 入口、依赖与端口链 | COVERED | packaging | tests/phase1/test_packaging_plan.py; backend/app/jobs/execution.py | 用当前文件核对 |
| CLS-PACKAGING-ONLY-A | fallback/rules.apply_final_rules; scoring.build_candidate_decision | 只缺打包保留 A | COVERED | packaging | tests/phase1/test_packaging_plan.py; backend/app/jobs/execution.py | 禁止业务重写 |
| CLS-LIMITED-REPAIR-B | fallback/rules.apply_final_rules; classify._heuristic_ai_review | 局部修复主仓库 | COVERED | gaps | tests/phase1/test_gap_plan.py; backend/app/jobs/execution.py | 验收 ID 约束 |
| CLS-REWRITE-COST | fallback/rules.apply_final_rules | 修复成本接近重写 | COVERED | gaps | tests/phase1/test_gap_plan.py; backend/app/agent/routing.py | 明确成本证据再做路线决定 |
| CLS-OLD-C-REGENERATE | fallback/classify._decide_generation_mode / build_hu_generation_request | C 表示重新生成 | REJECTED | routing | tests/phase1/test_hybrid_routing.py; backend/app/agent/routing.py | 新 C 是多来源组合 |
| CLS-OLD-D-MANUAL | fallback/rules.apply_final_rules | D 表示人工或信息不足 | REJECTED | requirements | tests/phase1/test_requirement_revision.py; backend/app/jobs/execution.py | 人工状态用 WAITING_USER |
| CLS-MISSING-COMPONENT | fallback/solvers/b_patch_repo/missing_component.classify_missing_component | 缺失组件和可选打包项 | COVERED | gaps | tests/phase1/test_gap_plan.py; backend/app/jobs/execution.py | 未知业务缺口不能 warning 放行 |
| CLS-UNKNOWN-SOFT | fallback/rules._hard_blockers; scoring.should_call_classification_ai | 不确定项与 review | COVERED | policy | tests/phase1/test_orchestration_policy.py; backend/app/jobs/execution.py | 确定性策略判断审查强度 |
| CLS-SCORE-WEIGHTS | fallback/scoring._build_evaluation_score | 部署评分与小量热度 | COVERED | ranking | tests/phase1/test_candidate_ranking.py; backend/app/agent/routing.py | 五维证据代替历史总分 |
| CLS-AI-OVERLAY | fallback/classify.call_classification_ai_if_needed | 语义审查覆盖 heuristic | COVERED | routing | tests/phase1/test_hybrid_routing.py; backend/app/agent/routing.py | 模型路线仍须硬验证 |
| CLS-LEGACY-HANDOFF | fallback/classify.build_hu_generation_request | 旧项目/部署 ID 和 hu payload | LEGACY_ONLY | none | tests/phase1/none; backend/app/none | 不恢复另一套运行系统 |
| CLS-STACK-PREFERENCE | fallback/extract_facts._preferred_stack | 模板框架选择 | LEGACY_ONLY | none | tests/phase1/none; backend/app/none | D 已有固定脚手架 A/B 保留真实栈 |

## 主链消费与行为证据

- Packaging: `backend/app/jobs/execution.py:prepare_algorithm_inputs` 在上传前记录并应用计划；`tests/phase1/test_default_execution.py::test_default_generation_calls_existing_loop_on_a_prepared_scaffold` 检查真实 Builder 消息。
- Gaps: `backend/app/agent/orchestrator.py:plan_gaps_and_finalize_route` 在提交路线前校验；`tests/phase1/test_gap_plan.py::test_invalid_integration_contract_never_persists_route_c` 证明无效合同保持 B。
- Composition: `backend/app/jobs/execution.py:generate_candidate` 物化组件、下发 Runner policy；`tests/phase1/test_default_execution.py::test_hybrid_component_builder_consumes_contract_through_runner` 检查实际 RPC 和 Builder 消费。
- Review: `backend/app/jobs/execution.py:review_candidate` 传入当前计划；`tests/phase1/test_candidate_review.py::test_packaging_finding_is_rechecked_after_builder_fix` 证明修复后不再永久阻塞。
- 所有 COVERED 表示旧行为由新版等价或更严格规则承接，不表示任意 GitHub 项目都能部署。多阶段/复杂 shell/ENTRYPOINT 语义不明时保守阻塞，不沿用旧启发式重写。
