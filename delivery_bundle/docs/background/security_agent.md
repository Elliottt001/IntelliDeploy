# security_agent.py 开发提示

## 1. 文件定位

该文件负责实现 Security Agent。

Security Agent 的职责是对 Builder 当前轮产物进行安全检查，输出结构化安全结果，用于 Router 判定是否可以继续流转。

该文件不负责改写产物，不负责状态跳转。


## 2. 主要输入变量

### `state`

- 含义：全局共享状态对象
- 来源：`agent_state.py`
- 用途：作为 Security 的统一输入

重点读取字段：

- `project_id`
- `session_id`
- `repo_context`
- `build_result`
- `iteration_count`
- `stage`


## 3. 主要输出变量

### `security_result`

- 含义：当前轮结构化安全扫描结果
- 写入方：Security Agent
- 消费方：Router、Builder、Graph、前端展示层

必须对齐的字段：

- `scanner_id`
- `round_index`
- `passed`
- `summary`
- `risk_score`
- `issues`

## 3.1 Security 输入上下文

Security 至少应读取：

- `project_id`
- `session_id`
- `repo_context`
- `build_result`
- `iteration_count`
- `stage`

Security 输出摘要至少应包括：

- `passed`
- `summary`
- `risk_score`
- `issues`


## 4. 推荐函数

### `build_security_context`

- 作用：提取安全检查所需上下文
- 输入：`state`
- 输出：安全扫描上下文对象

### `run_security`

- 作用：执行 Security 主流程
- 输入：`state`
- 输出：结构化 `security_result`

### `append_security_reports`

- 作用：将当前轮安全结果追加到 `security_reports`
- 输入：`state`、`security_result`
- 输出：更新后的状态对象


## 5. 实现逻辑

Security 的总体实现逻辑应为：

1. 从 `state` 中读取 `build_result`
2. 提取 Dockerfile、配置文件、环境变量候选项和依赖信息
3. 调用 Prompt 层构造 Security Prompt
4. 调用 Runtime 层执行安全分析
5. 调用 Validators 层解析为 `SecurityResult`
6. 将结果追加到 `security_reports`
7. 可由 Graph 层同步维护 `latest_security_result`

注意：

- Security 不负责生成修复后的产物
- Security 不负责决定进入下一轮还是结束
- Security 只输出结构化风险结果和修复建议


## 6. 必须遵守的变量命名

- 使用 `security_result`
- 使用 `security_reports`
- 使用 `latest_security_result`
- 使用 `risk_score`
- 使用 `issues`
- 使用 `severity`
- 使用 `category`
- 使用 `remediation`

不要使用：

- `security_output`
- `security_history`
- `problem_list`


## 7. 测试方式

### 单元测试重点

- 正常输入下是否能生成完整的结构化安全结果
- 输出能否被 `SecurityResult` 正常解析
- `issues` 是否保持结构化数组格式

### 异常测试重点

- 当模型输出 `severity` 不在允许枚举中时是否校验失败
- 当 `risk_score` 类型不正确时是否被拦截
- 当 `issues` 为空时是否仍可形成合法结果


## 8. 与其他文件的关系

- 依赖 `agent_state.py` 中的 `SecurityResult`
- 依赖 `prompts.py` 提供 Security Prompt
- 依赖 `runtime.py` 提供分析能力
- 依赖 `validators.py` 提供结果校验
- 被 `graph.py` 调用
