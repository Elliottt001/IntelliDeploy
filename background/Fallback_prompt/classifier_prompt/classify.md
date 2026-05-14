文件：classifier/classify.py

功能

- 这是 classifier 的单仓库主编排文件。
- 它负责：
  1. 解析完整 `FallbackRequest`
  2. 调用 `extract_facts.py` 提取单个仓库的 `repo_fact_summary`
  3. 调用 `rules.py` 做硬规则截断
  4. 调用 `scoring.py` 生成 `candidate_decision`
  5. 在需要时调用分类 AI
  6. 调用 `rules.py` 做最终落类
  7. 生成 `evaluation_result`
  8. 在需要时构造“发给胡的接口 A 请求体”

- 这个文件是“单仓库分类编排器”，不是多仓库聚合器。
- 当前上游只会给一个候选仓库，`classify.py` 不负责多个 repo 的比较和选优。

上游信息接口

直接上游输入是完整 `FallbackRequest`，至少包含：

1. 用户原始需求
   - `raw_query`

2. 用户需求结构化结果
   - `target_output_type`
   - `target_app_type`
   - `expected_features`
   - `preferred_language`
   - `preferred_framework`
   - `constraints`

3. Top 1 候选 GitHub 仓库
   - `rank`
   - `retrieval_score`
   - `repo_url`
   - `default_branch`
   - `description`
   - `topics`
   - `stars`
   - `is_archived`
   - `last_commit_at`

4. 该仓库的文件树
   - `file_tree`

5. 该仓库的关键文件内容
   - `README`
   - 依赖文件
   - lock 文件
   - 构建文件
   - 入口文件
   - 配置文件

如果调用方还需要本文件直接构造胡的接口 A 请求体，则还必须额外提供：

- `project_id`
- `deployment_id`
- `request_id`（可选）

注意：

- 当前输入只针对一个 repo。
- `classify.py` 不允许假设还存在第二个或第三个候选仓库。
- 如果 `project_id` / `deployment_id` 不在原始上游仓库材料里，应由服务层或 HTTP 层补充传入。
- `classify.py` 不允许自己编造这些 ID。

输入规范化规则：

- 对外接口字段可以保持当前上游约定不变。
- 但在进入 `classify.py` 之前，服务层必须先把输入整理成内部统一的 `FallbackRequest`。
- `classify.py` 内部只依赖以下标准字段：
  - `raw_query`
  - `user_intent`
  - `repo_info`
  - `file_tree`
  - `key_files`
  - `project_id`
  - `deployment_id`
  - `request_id`
- 如果外部输入是平铺结构，字段归位工作由服务层完成，不由 `classify.py` 现场猜测。

下游信息接口

本文件有两类下游输出：

1. 输出给服务层 / solver 的分类结果：

- `user_intent_summary`
- `repo_fact_summary`
- `evaluation_result`

2. 在需要转生成时，对接胡的接口 A：

- `project_id`
- `deployment_id`
- `request_id`
- `trigger_reason`
- `original_prompt`
- `generation_mode`
- `evaluation_score`
- `missing_components`
- `preferred_stack.*`
- `repo_profile.*`
- `constraints.*`

不负责：

- 接口 B 状态查询
- 接口 C 取产物
- 接口 D 失败回传
- detector 内部规则实现
- 多 repo 聚合

必须实现的函数

1. `classify_fallback_request(...)`
2. `build_evaluation_result(...)`
3. `build_hu_generation_request(...)`
4. `call_classification_ai_if_needed(...)`

实现

一、职责拆分

`extract_facts.py` 的职责：

- 输入：完整请求中的用户信息 + 单个 repo 材料
- 输出：`user_intent_summary` 和 `repo_fact_summary`

`classify.py` 的职责：

- 不做 detector 细节实现
- 只负责单 repo 的分类编排
- 只在最终需要转生成时构造胡的接口 A 请求体

二、`classify_fallback_request(...)` 总流程

1. 接收 `FallbackRequest`。
2. 调用 `extract_facts.py`，得到：
   - `user_intent_summary`
   - `repo_fact_summary`
3. 调用 `rules.py` 执行硬规则截断。
4. 如果硬规则已经稳定得到 `C` 或 `D`：
   - 直接进入 `build_evaluation_result(...)`
   - 再判断是否需要构造 `hu_generation_request`
   - 不再调用 `scoring.py`
   - 不再调用分类 AI
5. 如果硬规则未直接截断：
   - 调用 `scoring.py` 生成：
     - `candidate_decision`
     - `candidate_reason`
     - `decision_signals`
     - `evaluation_score`
     - `ai_review_required`
     - `ai_review_reason`
6. 如果 `ai_review_required = true`，调用 `call_classification_ai_if_needed(...)`
7. 接收 AI 中间判断结果
8. 调用 `rules.py` 执行最终落类
9. 调用 `build_evaluation_result(...)`
10. 如果最终需要转生成，调用 `build_hu_generation_request(...)`
11. 最终输出：

{
  "user_intent_summary": { ... },
  "repo_fact_summary": { ... },
  "evaluation_result": {
    "candidate_decision": "A_candidate | B_candidate | C_candidate | D_candidate | unknown",
    "evaluation_score": "integer | null",
    "decision": "A | B | C | D",
    "reason": "string",
    "why_not_A": [],
    "repair_targets": [],
    "missing_information": [],
    "requires_user_confirmation": false
  },
  "hu_generation_request": { ... } | null
}

三、`build_evaluation_result(...)` 规则

这个函数负责把多段判断结果整理成统一输出。

必须整合：

- `candidate_decision`
- `candidate_reason`
- `evaluation_score`
- `decision`
- `reason`
- `why_not_A`
- `repair_targets`
- `missing_information`
- `requires_user_confirmation`

要求：

- 输出结构必须稳定
- 即使某些字段为空，也不能缺 key
- 不允许在这个阶段重新推断 repo 事实
- 不允许在这个阶段修改 `repo_fact_summary`

字段默认值与优先级规则：

- 如果硬规则直接输出 `C`：
  - `candidate_decision = C_candidate`
  - `evaluation_score = null`

- 如果硬规则直接输出 `D`：
  - `candidate_decision = D_candidate`
  - `evaluation_score = null`

- `reason` 的优先级：
  1. 硬规则阶段返回的 `reason`
  2. 最终落类阶段返回的 `reason`
  3. `candidate_reason`
  4. `"unknown"`

- `repair_targets`：
  - 优先使用 `rules.py` 最终输出
  - 没有则 `[]`

- `why_not_A`：
  - 没有则 `[]`

- `missing_information`：
  - 没有则 `[]`

- `requires_user_confirmation`：
  - 没有则 `false`

四、`build_hu_generation_request(...)` 输出必须匹配接口 A

{
  "project_id": "string",
  "deployment_id": "string",
  "request_id": "string | null",
  "trigger_reason": "LOW_SCORE_ALL | REPAIR_EXHAUSTED | FORCE_FALLBACK",
  "original_prompt": "string",
  "generation_mode": "AUTO | VIBE | COMPONENT_REASSEMBLY",
  "evaluation_score": "integer | null",
  "missing_components": [],
  "preferred_stack": {
    "frontend": "string | null",
    "backend": "string | null",
    "database": "string | null",
    "runtime": "string | null"
  },
  "repo_profile": {
    "source_repo_url": "string | null",
    "detected_languages": [],
    "detected_frameworks": [],
    "package_manager": "string | null",
    "entrypoints": [],
    "dependency_files": [],
    "has_valid_dockerfile": "boolean | null",
    "readme_summary": "string | null"
  },
  "constraints": {
    "timeout_seconds": "integer | null",
    "target_port": "integer | null",
    "must_provide_dockerfile": true,
    "must_provide_healthcheck": true
  }
}

字段映射规则：

- `project_id` / `deployment_id` / `request_id`：
  - 只允许从调用方输入透传
  - 不允许编造
- `original_prompt`：
  - 直接使用 `raw_query`
- `evaluation_score`：
  - 直接使用 `evaluation_result.evaluation_score`
  - 没有则 `null`
- `missing_components`：
  - 直接使用 `repo_fact_summary.missing_components`
  - 没有则空数组
- `preferred_stack`：
  - 直接使用 `repo_fact_summary.preferred_stack`
  - 没有则各字段为 `null`
- `repo_profile.*`：
  - 直接使用 `repo_fact_summary` 中已提取字段
  - 不允许重新猜测
- `constraints.timeout_seconds`：
  - 从上游 `constraints` 透传；没有则 `null`
- `constraints.target_port`：
  - 优先使用 `repo_fact_summary.target_port_candidates[0]`
  - 没有则 `null`
- `constraints.must_provide_dockerfile`：
  - 默认 `true`
- `constraints.must_provide_healthcheck`：
  - 默认 `true`

五、`trigger_reason` 映射规则

- 当前单个仓库不适合继续保留为项目主体，且最终进入 `C` -> `LOW_SCORE_ALL`
- 单仓库修复失败、修复路径耗尽 -> `REPAIR_EXHAUSTED`
- 人工指定强制走生成 -> `FORCE_FALLBACK`

说明：

- 虽然字段名叫 `LOW_SCORE_ALL`，但在当前单仓库模式下，含义是“当前唯一候选仓库不适合继续保留”
- `classify.py` 不需要为了字段名去虚构多个候选仓库语义

六、`generation_mode` 映射规则

- 默认 -> `AUTO`
- 用户需求明确，且更适合快速脚手架生成 -> `VIBE`
- 需要保留当前仓库中的部分结构、组件、配置或上下文再重组 -> `COMPONENT_REASSEMBLY`

注意：

- `generation_mode` 是策略建议，不是事实字段
- 它必须基于当前单仓库上下文和用户需求稳定生成，不能瞎猜

七、什么时候构造 `hu_generation_request`

1. 最终决策为 `C` 时，必须构造。
2. 最终决策为 `D` 时，不构造。
3. 最终决策为 `A` 时，不构造。
4. 最终决策为 `B` 时，默认不构造；
   但如果调用方明确指定 `REPAIR_EXHAUSTED` 或 `FORCE_FALLBACK`，可以构造。

如果要构造，但缺少 `project_id` 或 `deployment_id`：

- 不允许输出伪造请求体
- 必须抛出明确错误，或把问题返回给服务层处理

八、分类 AI Prompt 约束

本文件可以内置“分类 AI Prompt”模板，但它只能审查当前这个 repo。

这个 Prompt 必须要求 AI 只输出：

{
  "user_intent_clear": true,
  "repo_purpose": "string",
  "repo_purpose_unknown": false,
  "repo_matches_user_intent": true,
  "uses_original_repo_as_base": true,
  "runtime_chain_closed": "true | false | unknown",
  "requires_repo_code_modification": true,
  "repair_scope_limited": true,
  "repair_cost_close_to_rewrite": false,
  "recommended_repair_targets": [],
  "missing_information": [],
  "warnings": [],
  "reasoning_summary": "string",
  "confidence": 0.0
}

AI 调用规则：

- AI 只看当前 repo 的摘要材料
- AI 只做单 repo 审查
- AI 不负责最终分类
- AI 不负责构造接口 A 请求体
- AI 不允许补造 repo 中不存在的事实

注意

- 不把接口 B、C、D 的逻辑塞进 `classify.py`
- `classify.py` 只负责单 repo 分类编排和接口 A handoff
- `extract_facts.py` 只负责 repo 事实提取
- `classify.py` 不负责具体 detector 规则实现
- `A` 不允许只靠文件存在直接判定
- `B` 必须表示保留当前原仓库主体，但需要修改内部内容
- `C` 必须表示当前仓库不再适合作为主体，需要转生成
- `D` 必须表示信息不足或无法可靠判断
- 不允许在本文件中引入多 repo 聚合逻辑
