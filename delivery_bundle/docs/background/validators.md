# validators.py 开发提示

## 1. 文件定位

该文件负责统一校验和规范化各 Agent 的结构化输出。

Validators 的职责是保护共享状态稳定，防止 Router 和 Graph 消费非法结果。


## 2. 主要输入变量

### `raw_output`

- 含义：模型或规则引擎的原始输出
- 来源：`runtime.py`

### `target_schema`

- 含义：目标结构化对象要求
- 来源：`agent_state.py`


## 3. 主要输出变量

### `validated_build_result`

- 含义：校验后的 Builder 输出

### `validated_review_result`

- 含义：校验后的 Reviewer 输出

### `validated_security_result`

- 含义：校验后的 Security 输出


## 4. 推荐函数

### `validate_build_result`

- 作用：校验 Builder 输出是否合法

### `validate_review_result`

- 作用：校验 Reviewer 输出是否合法

### `validate_security_result`

- 作用：校验 Security 输出是否合法

### `normalize_invalid_output`

- 作用：在输出异常时生成统一错误信息或兜底结构


## 5. 实现逻辑

Validators 的总体实现逻辑应为：

1. 接收 Runtime 返回的原始内容
2. 尝试解析为目标结构
3. 验证必填字段和字段类型
4. 对非法结果进行统一处理
5. 返回可写入状态机的稳定结构

注意：

- Router 不能直接消费未经校验的输出
- Validators 必须统一错误风格
- 校验失败时要保留足够的错误上下文


## 6. 必须遵守的变量命名

- 使用 `validated_build_result`
- 使用 `validated_review_result`
- 使用 `validated_security_result`
- 使用 `raw_output`
- 使用 `target_schema`


## 7. 测试方式

### 单元测试重点

- 合法输出是否能通过校验
- 字段缺失是否能被识别
- 类型错误是否能被识别
- 枚举值非法是否能被识别

### 异常测试重点

- 空输出
- 非 JSON 输出
- 结构嵌套错误
- 数组字段被错误地返回成字符串


## 8. 与其他文件的关系

- 依赖 `agent_state.py` 中的结构定义
- 被 `builder_agent.py`、`reviewer_agent.py`、`security_agent.py` 调用
- 向 `graph.py` 和 `router.py` 提供稳定输入

