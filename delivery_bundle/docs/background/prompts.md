# prompts.py 开发提示

## 1. 文件定位

该文件负责统一管理多智能体系统中各 Agent 的 Prompt 模板。

Prompts 文件是连接共享状态和模型输入的中间层。


## 2. 主要输入变量

### `state`

- 含义：共享状态对象
- 来源：`agent_state.py`

### `schema`

- 含义：目标结构化输出 Schema
- 来源：`agent_state.py` 中导出的 JSON Schema


## 3. 主要输出变量

### `builder_prompt`

- 含义：Builder 使用的提示词内容

### `reviewer_prompt`

- 含义：Reviewer 使用的提示词内容

### `security_prompt`

- 含义：Security 使用的提示词内容


## 4. 推荐函数

### `build_builder_prompt`

- 作用：根据共享状态构造 Builder 的 Prompt

### `build_reviewer_prompt`

- 作用：根据共享状态和 Builder 当前产物构造 Reviewer 的 Prompt

### `build_security_prompt`

- 作用：根据共享状态和 Builder 当前产物构造 Security 的 Prompt

### `inject_output_schema`

- 作用：将目标输出 Schema 注入 Prompt 约束中


## 5. 实现逻辑

Prompts 文件的总体实现逻辑应为：

1. 从 `state` 中读取该 Agent 所需最小上下文
2. 控制上下文长度，不传无关信息
3. 注入统一输出 Schema
4. 明确该 Agent 的职责边界
5. 明确禁止行为
6. 产出结构化 Prompt 数据

注意：

- Prompt 必须与 Agent 职责一一对应
- Prompt 中必须约束输出格式
- Prompt 不应承担业务决策逻辑


## 6. 必须遵守的变量命名

- 使用 `builder_prompt`
- 使用 `reviewer_prompt`
- 使用 `security_prompt`
- 使用 `output_schema`


## 7. 测试方式

### 单元测试重点

- 是否能正确读取所需状态字段
- 是否包含目标输出 Schema
- 是否没有混入其他 Agent 的职责描述

### 边界测试重点

- 当输入字段缺失时 Prompt 是否仍保持可生成
- 当上下文过长时是否有截断策略


## 8. 与其他文件的关系

- 依赖 `agent_state.py` 导出的 Schema
- 被 `builder_agent.py`、`reviewer_agent.py`、`security_agent.py` 调用
- 不依赖 Router

