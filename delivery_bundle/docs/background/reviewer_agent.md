# reviewer_agent.py 开发提示

## 1. 文件定位

该文件负责实现 Reviewer Agent。

Reviewer Agent 的职责是对 Builder 当前轮产物进行质量审查，并返回结构化审查结果，供 Router 和 Builder 后续使用。

该文件不负责重新生成产物，不负责状态跳转。


## 2. 主要输入变量

### `state`

- 含义：全局共享状态对象
- 来源：`agent_state.py`
- 用途：作为 Reviewer 的统一输入

重点读取字段：

- `project_id`
- `session_id`
- `user_prompt`
- `repo_context`
- `build_result`
- `iteration_count`
- `stage`


## 3. 主要输出变量

### `review_result`

- 含义：Reviewer 当前轮结构化审查结果
- 写入方：Reviewer Agent
- 消费方：Router、Builder、Graph、前端展示层

必须对齐的字段：

- `reviewer_id`
- `round_index`
- `score`
- `passed`
- `summary`
- `improvement_suggestions`
- `risk_findings`
- `artifact_version`

## 3.1 Reviewer 输入上下文

Reviewer 至少应读取：

- `project_id`
- `session_id`
- `user_prompt`
- `repo_context`
- `build_result`
- `iteration_count`
- `stage`

Reviewer 输出摘要至少应包括：

- `passed`
- `summary`
- `improvement_suggestions`
- `risk_findings`


## 4. 推荐函数

### `build_review_context`

- 作用：从共享状态中提取当前轮审查所需上下文
- 输入：`state`
- 输出：审查上下文对象

### `run_reviewer`

- 作用：执行 Reviewer 主流程
- 输入：`state`
- 输出：结构化 `review_result`

### `append_review_history`

- 作用：将当前轮审查结果追加写入 `review_history`
- 输入：`state`、`review_result`
- 输出：更新后的状态对象


## 5. 实现逻辑

Reviewer 的总体实现逻辑应为：

1. 从 `state` 中读取 `build_result`
2. 从 `state` 中读取 `repo_context` 和 `user_prompt`
3. 组装审查上下文
4. 调用 Prompt 层构造 Reviewer Prompt
5. 调用 Runtime 层完成模型推理
6. 调用 Validators 层解析为 `ReviewResult`
7. 把结果追加到 `review_history`
8. 可由 Graph 层同步维护 `latest_review_result`

注意：

- Reviewer 不直接回写 Builder 产物
- Reviewer 不直接决定通过或失败
- Reviewer 只给出结构化判断和改进建议


## 6. 必须遵守的变量命名

- 使用 `review_result`
- 使用 `review_history`
- 使用 `latest_review_result`
- 使用 `improvement_suggestions`
- 使用 `risk_findings`
- 使用 `artifact_version`

不要使用：

- `review`
- `reviews`
- `review_output_text`
- `suggestions`


## 7. 测试方式

### 单元测试重点

- 正常输入下是否能生成完整的结构化审查结果
- 输出能否被 `ReviewResult` 正常解析
- `artifact_version` 是否与 Builder 版本一致
- `append_review_history` 是否为追加写入

### 异常测试重点

- 当 `build_result` 缺失时是否能明确失败
- 当模型输出 `score` 类型异常时是否能被校验拦截
- 当 `passed`、`summary` 缺失时是否触发结构校验失败


## 8. 与其他文件的关系

- 依赖 `agent_state.py` 中的 `ReviewResult`
- 依赖 `prompts.py` 提供 Reviewer Prompt
- 依赖 `runtime.py` 提供模型调用能力
- 依赖 `validators.py` 提供结果校验
- 被 `graph.py` 调用
