# runtime.py 开发提示

## 1. 文件定位

该文件负责隔离上游模型能力和检索能力。

Runtime 的职责是给 Builder、Reviewer、Security 提供统一调用入口，并屏蔽底层 LLM / RAG / 重试 / 超时细节。


## 2. 主要输入变量

### `messages`

- 含义：Prompt 层构造出的消息内容
- 来源：`prompts.py`

### `output_schema`

- 含义：本次调用目标输出结构
- 来源：`agent_state.py`

### `timeout_seconds`

- 含义：本次调用超时秒数
- 来源：运行时配置


## 3. 主要输出变量

### `raw_output`

- 含义：模型原始返回结果
- 写入方：Runtime
- 消费方：Validators


## 4. 推荐函数

### `call_llm`

- 作用：统一调用上游模型能力

### `call_with_retry`

- 作用：在失败时执行重试

### `call_with_timeout`

- 作用：为调用增加超时控制

### `call_rag_if_needed`

- 作用：当任务需要时接入检索能力


## 5. 实现逻辑

Runtime 的总体实现逻辑应为：

1. 接收 Prompt 层构造好的消息
2. 接收本次目标输出结构
3. 优先调用 OpenAI-compatible API
4. API 调用失败时进行重试
5. 如果未配置 API 或 API 调用失败，则回退到离线兜底逻辑
6. 返回原始输出给 Validators

注意：

- Runtime 不负责业务语义判断
- Runtime 不负责状态写回
- Runtime 不负责路由


## 6. 必须遵守的变量命名

- 使用 `messages`
- 使用 `output_schema`
- 使用 `raw_output`
- 使用 `timeout_seconds`

## 6.1 环境变量约定

优先支持以下环境变量：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

兼容支持：

- `MODEL_KEY`
- `MODEL_API`
- `MODEL_NAME`


## 7. 测试方式

### 单元测试重点

- 正常调用时是否返回原始输出
- 超时控制是否生效
- 重试逻辑是否生效

### 异常测试重点

- 上游模型报错时是否正确返回异常信息
- 空响应时是否能被下游识别
- 非结构化响应时是否保留原始内容


## 8. 与其他文件的关系

- 接收 `prompts.py` 的消息输入
- 为 `validators.py` 提供原始输出
- 被 `builder_agent.py`、`reviewer_agent.py`、`security_agent.py` 调用
