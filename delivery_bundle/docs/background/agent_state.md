# agent_state.py 开发提示

## 文件定位

该文件定义多智能体共享状态协议，是 `graph.py`、Builder、Reviewer、Security 共同依赖的唯一状态源。

## 需要包含的核心字段

基础字段：

- `project_id`
- `session_id`
- `user_prompt`
- `trigger_source`
- `repo_context`

构建相关：

- `build_result`
- `current_dockerfile`
- `current_configs`

审查相关：

- `review_history`
- `security_reports`
- `latest_review_result`
- `latest_security_result`

状态机相关：

- `stage`
- `iteration_count`
- `max_iteration_limit`
- `is_approved`
- `failure_reason`
- `last_error`
- `status_message`
- `event_stream`

部署相关：

- `deployment_url`
- `deployment_logs`

## 事件协议

`event_stream` 内每个元素建议固定为：

- `session_id`
- `agent_name`
- `stage`
- `event_type`
- `message`
- `iteration_count`
- `is_terminal`
- `timestamp`
- `payload`

## 推荐函数

- `build_result_json_schema()`
- `review_result_json_schema()`
- `security_result_json_schema()`
- `agent_event_json_schema()`

## 设计要求

- `stage` 使用统一大写命名
- `event_stream` 只存结构化事件，不存自由文本
- `BuildResult` / `ReviewResult` / `SecurityResult` 必须保持 Pydantic 校验
