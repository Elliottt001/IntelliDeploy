# builder_agent.py 开发提示

## 1. 文件定位

该文件负责实现 Builder Agent。

Builder Agent 的职责是根据共享状态中的仓库上下文、用户目标、上一轮审查建议和安全建议，生成当前轮的部署产物。

该文件不负责路由，不负责最终通过判定，不负责状态机编排。


## 2. 主要输入变量

### `state`

- 含义：全局共享状态对象
- 来源：`agent_state.py` 中定义的 `AgentState`
- 用途：作为 Builder 唯一可信输入

Builder 使用时重点读取以下字段：

- `project_id`
- `session_id`
- `user_prompt`
- `repo_context`
- `iteration_count`
- `review_history`
- `security_reports`
- `stage`


## 3. 主要输出变量

### `build_result`

- 含义：Builder 单轮结构化输出
- 写入方：Builder Agent
- 消费方：Reviewer、Security、Router、Graph

推荐包含以下字段：

- `builder_id`
- `round_index`
- `artifact_version`
- `current_dockerfile`
- `current_configs`
- `build_summary`
- `build_warnings`

## 3.1 Builder 输入上下文

Builder 至少应读取：

- `project_id`
- `session_id`
- `user_prompt`
- `repo_context`
- `iteration_count`
- `latest_review_result`
- `latest_security_result`
- `stage`

推荐输出摘要字段：

- `artifact_version`
- `build_summary`
- `build_warnings`


## 4. 推荐函数

### `build_artifact_from_state`

- 作用：从共享状态中提取 Builder 所需输入，并组装生成上下文
- 输入：`state`
- 输出：适合传给 Prompt 层的上下文对象

### `run_builder`

- 作用：执行 Builder 主流程
- 输入：`state`
- 输出：结构化 `build_result`

### `merge_builder_output`

- 作用：将 Builder 输出写回共享状态中的当前产物区
- 输入：`state`、`build_result`
- 输出：更新后的状态对象


## 5. 实现逻辑

Builder 的总体实现逻辑应为：

1. 从 `state` 中读取 `user_prompt` 和 `repo_context`
2. 读取上一轮 `latest_review_result` 和 `latest_security_result`
3. 构造当前轮生成上下文
4. 调用 Prompt 层生成 Builder Prompt
5. 调用 Runtime 层完成模型推理
6. 调用 Validators 层校验 Builder 输出
7. 生成 `build_result`
8. 把结果写回状态中的产物字段

注意：

- Builder 不直接判断是否通过
- Builder 不直接修改 `is_approved`
- Builder 不负责轮次增长


## 6. 必须遵守的变量命名

- 使用 `build_result`
- 使用 `current_dockerfile`
- 使用 `current_configs`
- 使用 `artifact_version`
- 使用 `build_summary`
- 使用 `build_warnings`

不要使用：

- `result`
- `docker_content`
- `config_bundle`
- `version_tag`


## 7. 测试方式

### 单元测试重点

- 在仅有 `repo_context` 的情况下，能否正常生成结构化产物
- 在存在 `review_history` 的情况下，是否能读取改进建议
- 在存在 `security_reports` 的情况下，是否能读取安全修复建议
- 输出是否包含必备字段

### 异常测试重点

- 当 Runtime 返回空结果时，是否能进入校验失败分支
- 当生成结果字段缺失时，是否能被 Validators 拦截
- 当 `repo_context` 缺少关键字段时，是否能给出明确失败信息


## 8. 与其他文件的关系

- 依赖 `agent_state.py` 提供共享状态协议
- 依赖 `prompts.py` 提供 Builder Prompt
- 依赖 `runtime.py` 提供模型调用能力
- 依赖 `validators.py` 提供输出校验
- 被 `graph.py` 调用
