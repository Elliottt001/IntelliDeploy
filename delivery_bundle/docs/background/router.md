# router.py 开发提示

## 1. 文件定位

该文件负责实现 Router。

Router 的职责是读取最新的质量审查结果、安全结果和轮次信息，决定状态机下一步流向。

Router 不负责执行生成，不负责执行审查，不负责调用模型。


## 2. 主要输入变量

### `state`

- 含义：全局共享状态对象
- 来源：`agent_state.py`
- 用途：作为 Router 唯一可信输入

重点读取字段：

- `latest_review_result`
- `latest_security_result`
- `iteration_count`
- `max_iteration_limit`
- `stage`
- `last_error`


## 3. 主要输出变量

### `next_stage`

- 含义：下一步要进入的阶段
- 写入方：Router
- 消费方：Graph

允许值建议：

- `HEALING`
- `APPROVED`
- `FAILED`

### `is_approved`

- 含义：当前是否形成通过共识
- 写入方：Router
- 消费方：Graph、前端、后端

### `failure_reason`

- 含义：失败原因
- 写入方：Router 或异常处理层
- 消费方：前端、观测层


## 4. 推荐函数

### `decide_next_stage`

- 作用：根据最新审查结果、安全结果和轮次决定下一步阶段
- 输入：`state`
- 输出：`next_stage`

### `is_review_passed`

- 作用：判断最新质量审查是否通过
- 输入：`latest_review_result`
- 输出：布尔值

### `is_security_passed`

- 作用：判断最新安全检查是否通过
- 输入：`latest_security_result`
- 输出：布尔值

### `is_iteration_exceeded`

- 作用：判断是否超过最大轮次
- 输入：`iteration_count`、`max_iteration_limit`
- 输出：布尔值


## 5. 实现逻辑

Router 的总体实现逻辑应为：

1. 读取 `latest_review_result`
2. 读取 `latest_security_result`
3. 判断两者是否同时通过
4. 若同时通过，则写入 `is_approved = True`
5. 若未通过但未超过轮次上限，则进入 `HEALING`
6. 若超过轮次上限，则进入 `FAILED`
7. 若存在严重异常，则可直接失败

注意：

- Router 只使用结构化字段做判断
- Router 不读取自由文本做关键判定
- Router 不直接调 Builder、Reviewer、Security


## 6. 必须遵守的变量命名

- 使用 `next_stage`
- 使用 `is_approved`
- 使用 `failure_reason`
- 使用 `iteration_count`
- 使用 `max_iteration_limit`
- 使用 `latest_review_result`
- 使用 `latest_security_result`

不要使用：

- `next_step_status`
- `retry_times`
- `fail_msg`
- `review_pass`


## 7. 测试方式

### 单元测试重点

- 审查通过且安全通过时，是否正确进入 `APPROVED`
- 任一方未通过但轮次未超限时，是否正确进入 `HEALING`
- 超过轮次时，是否正确进入 `FAILED`

### 异常测试重点

- `latest_review_result` 缺失时如何处理
- `latest_security_result` 缺失时如何处理
- `iteration_count` 非法时是否触发保护逻辑


## 8. 与其他文件的关系

- 依赖 `agent_state.py` 中的共享状态
- 被 `graph.py` 调用
- 消费 `reviewer_agent.py` 和 `security_agent.py` 的结果
- 不依赖 `runtime.py`
