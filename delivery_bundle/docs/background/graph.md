# graph.py 开发提示

## 1. 文件定位

该文件负责实现整体状态机编排。

Graph 的职责是将 Builder、Reviewer、Security、Router 串联为完整闭环，并负责状态写回和轮次控制。

该文件是整个多智能体链路的执行入口。


## 2. 主要输入变量

### `state`

- 含义：全局共享状态对象
- 来源：`agent_state.py`
- 用途：作为整条状态机链路的共享上下文


## 3. 主要输出变量

### `state`

- 含义：更新后的全局状态对象
- 写入方：Graph
- 消费方：上层接口、前端、部署层

Graph 重点维护字段：

- `stage`
- `iteration_count`
- `build_result`
- `review_history`
- `security_reports`
- `latest_review_result`
- `latest_security_result`
- `is_approved`
- `failure_reason`
- `last_error`


## 4. 推荐函数

### `run_graph`

- 作用：执行整条主流程
- 输入：`state`
- 输出：更新后的 `state`

### `run_single_iteration`

- 作用：执行单轮 Builder -> Reviewer -> Security 流程
- 输入：`state`
- 输出：更新后的 `state`

### `sync_latest_results`

- 作用：从历史数组中同步最近一轮结果到便捷字段
- 输入：`state`
- 输出：更新后的 `state`

### `update_stage`

- 作用：统一更新当前阶段字段
- 输入：`state`、`next_stage`
- 输出：更新后的 `state`


## 5. 实现逻辑

Graph 的总体实现逻辑应为：

1. 初始化当前阶段为 `building`
2. 调用 Builder 生成当前轮产物
3. 更新状态中的 `build_result`
4. 调用 Reviewer 完成质量审查
5. 追加 `review_history`
6. 调用 Security 完成安全审查
7. 追加 `security_reports`
8. 同步 `latest_review_result` 和 `latest_security_result`
9. 调用 Router 决定下一步阶段
10. 若进入 `rebuilding`，则轮次加一并继续循环
11. 若进入 `approved` 或 `failed`，则结束流程

注意：

- Graph 是唯一允许协调所有节点顺序的文件
- Graph 负责维护状态机生命周期
- Graph 不直接承载 Prompt 和模型推理逻辑


## 6. 必须遵守的变量命名

- 使用 `stage`
- 使用 `iteration_count`
- 使用 `build_result`
- 使用 `review_history`
- 使用 `security_reports`
- 使用 `latest_review_result`
- 使用 `latest_security_result`
- 使用 `is_approved`
- 使用 `failure_reason`
- 使用 `last_error`
- `stage` 必须统一为：
  - `THINKING`
  - `BUILDING`
  - `REVIEWING`
  - `SECURITY_CHECK`
  - `HEALING`
  - `APPROVED`
  - `FAILED`

## 6.1 事件协议

Graph 发出的 `event_stream` 必须统一包含：

- `session_id`
- `agent_name`
- `stage`
- `event_type`
- `message`
- `iteration_count`
- `is_terminal`
- `timestamp`
- `payload`

Graph 是唯一允许统一追加事件的文件。


## 7. 测试方式

### 单元测试重点

- 单轮执行是否能依次完成 Builder、Reviewer、Security
- 审查通过时是否正确结束
- 审查未通过时是否能进入下一轮
- 历史数组是否保持追加

### 集成测试重点

- 多轮修复是否能正确维护 `iteration_count`
- 任一节点抛出异常时，`last_error` 是否被正确记录
- Router 返回 `failed` 时，Graph 是否能正确结束


## 8. 与其他文件的关系

- 依赖 `agent_state.py` 提供状态协议
- 调用 `builder_agent.py`
- 调用 `reviewer_agent.py`
- 调用 `security_agent.py`
- 调用 `router.py`
- 不直接依赖具体 Prompt 文本
