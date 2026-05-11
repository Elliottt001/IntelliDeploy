# 整体约束

## 1. 文档定位

本文件用于约束 IntelliDeploy 多智能体主链路中的共享 Schema、统一变量命名和字段语义。

本文件不描述具体代码实现，不包含代码样例，只定义后续所有任务必须遵守的统一约束。

本文件主要服务于以下分工协作：

- 张瑞喆：总状态机、总协议、总路由
- 林子豪：RAG 检索与底层模型能力
- 胡曦元：后端承接、服务包装、外部平台对接
- 杨钞越：生成链路中的算法能力与异步化承载
- 成可心：前端展示、状态流消费、界面联调
- 你：Builder / Reviewer 子 Agent 与状态流转接入


## 2. 总体设计原则

- 所有跨模块、跨角色传递的数据，必须使用统一字段名，不允许同义字段并存。
- 状态机共享上下文必须以单一状态对象为中心，不允许各节点维护独立私有主状态。
- 同一个概念在不同层中必须保持同名，例如项目标识、轮次、阶段、审查结果。
- 面向前端展示的字段和面向后端编排的字段必须共源，不允许分别维护两套状态定义。
- Agent 输出必须结构化，不允许 Router 依赖自由文本做关键决策。
- 审查类输出与生成类输出必须分离，不能混在同一个结果对象里。
- 安全审查与质量审查必须分开存档，不能共用一个历史数组。
- 变量命名必须表达领域含义，禁止使用模糊缩写。


## 3. 总体 Schema 分层

整个系统的共享数据分为六层：

1. 会话层
   用于标识一次完整的用户请求和自动化处理会话。

2. 仓库上下文层
   用于描述代码仓库、依赖、入口、配置、构建特征等基础输入。

3. 生成产物层
   用于承载 Builder 输出的 Dockerfile、部署配置和版本标识。

4. 审查结果层
   用于承载 Reviewer 的质量结论和 Security 的安全结论。

5. 路由控制层
   用于控制轮次、状态跳转、是否通过、是否失败。

6. 展示与观测层
   用于前端展示、日志流、部署可视化和错误追踪。


## 4. 统一命名总规则

### 4.1 命名风格

- Python 侧统一使用小写下划线命名。
- JSON 字段若需对前端暴露，可由后端统一做风格转换，但状态机内部仍以小写下划线为准。
- 状态机内部字段名必须稳定，不允许随节点变化而变化。

### 4.2 禁止事项

- 禁止同时出现 `projectId` 和 `project_id` 作为同一层共享字段。
- 禁止同时出现 `reviews`、`review_history`、`review_results` 三种并行含义字段。
- 禁止使用 `data`、`info`、`result` 这类无语义总称作为主状态字段名。
- 禁止将同一个字段在不同阶段赋予不同含义。

### 4.3 允许的命名方向

- 标识类字段使用 `_id`
- 布尔类字段使用 `is_`、`has_`、`needs_`
- 历史集合字段使用 `_history`、`_reports`、`_logs`
- 当前阶段产物字段使用 `current_`
- 最终产物字段使用 `final_`
- 轮次控制字段使用 `iteration_`、`round_`


## 5. 会话层 Schema

### 5.1 目的

会话层字段用于贯穿整条链路，保证前端、后端、算法、部署各方能定位到同一次任务。

### 5.2 必备字段

#### `project_id`

- 含义：项目唯一标识
- 责任来源：后端主数据层
- 使用方：算法、后端、前端
- 约束：全局稳定，不随轮次变化

#### `session_id`

- 含义：一次自动化处理会话的唯一标识
- 责任来源：后端编排层
- 使用方：状态机、日志流、前端订阅
- 约束：一次用户触发对应一次会话

#### `user_prompt`

- 含义：用户原始输入目标
- 责任来源：前端或上层入口
- 使用方：Builder、Reviewer、Router
- 约束：整个会话中不得被覆盖，只可引用

#### `trigger_source`

- 含义：本次会话的触发来源
- 责任来源：上层入口
- 使用方：编排层、观测层
- 约束：用于区分手动触发、自动修复触发、重试触发


## 6. 仓库上下文层 Schema

### 6.1 目的

仓库上下文层是 Builder、Reviewer、Security 的共同输入基础，也是林子豪能力层和胡曦元服务层之间的重要交接面。

### 6.2 总字段

#### `repo_context`

- 含义：仓库分析后的统一上下文对象
- 责任来源：后端聚合层，可调用 GitHub / RAG / 基础分析能力生成
- 使用方：全部 Agent
- 约束：不得直接传入未经整理的原始杂项数据作为共享主输入

### 6.3 推荐子字段

#### `repo_url`

- 含义：仓库地址
- 责任来源：用户输入或项目记录
- 使用方：后端、展示层、审计追踪

#### `repo_owner`

- 含义：仓库所属者
- 责任来源：仓库解析层
- 使用方：后端外部调用层

#### `repo_name`

- 含义：仓库名称
- 责任来源：仓库解析层
- 使用方：后端、部署命名、前端展示

#### `default_branch`

- 含义：仓库默认分支
- 责任来源：GitHub 元信息
- 使用方：生成链路、PR 生成、构建触发

#### `file_list`

- 含义：仓库文件路径列表
- 责任来源：仓库树扫描
- 使用方：Builder、Reviewer、Security、RAG
- 约束：字段名统一为 `file_list`，不要混用 `files`

#### `readme_text`

- 含义：README 内容摘要或正文截断结果
- 责任来源：仓库内容提取层
- 使用方：Builder、Reviewer、RAG

#### `tech_stack`

- 含义：识别出的技术栈标签列表
- 责任来源：分析层
- 使用方：Builder、Reviewer、Security、前端展示

#### `entrypoints`

- 含义：识别出的应用入口信息集合
- 责任来源：分析层
- 使用方：Builder、Reviewer

#### `dependency_files`

- 含义：依赖清单文件路径集合
- 责任来源：上下文截断与依赖提取逻辑
- 使用方：Builder、Security

#### `detected_ports`

- 含义：推测出的端口列表
- 责任来源：分析层
- 使用方：Builder、Reviewer、部署层

#### `env_candidates`

- 含义：推测出的环境变量候选项
- 责任来源：分析层或规则层
- 使用方：Builder、Reviewer、前端确认层

#### `error_context`

- 含义：当前待修复报错的清洗后上下文
- 责任来源：日志降噪清洗逻辑
- 使用方：Builder、Reviewer、RAG
- 约束：如果场景不是修复类任务，可为空


## 7. 生成产物层 Schema

### 7.1 目的

生成产物层是你主责的核心边界，必须保证 Builder 生成内容可审查、可追踪、可回滚。

### 7.2 Builder 输出主字段

#### `build_result`

- 含义：Builder 单轮输出结果对象
- 责任来源：Builder Agent
- 使用方：Reviewer、Security、Router、后端落库层
- 约束：每一轮必须产生一个结构化结果

### 7.3 推荐子字段

#### `builder_id`

- 含义：执行当前生成的 Builder 标识
- 责任来源：Builder Agent
- 使用方：审计追踪、实验比对

#### `round_index`

- 含义：当前结果所属轮次
- 责任来源：状态机控制层写入，Builder 输出中回显
- 使用方：所有审查节点

#### `artifact_version`

- 含义：当前产物版本标识
- 责任来源：Builder Agent
- 使用方：Reviewer、Security、观测层
- 约束：同一轮审查必须引用同一个版本标识

#### `current_dockerfile`

- 含义：当前轮生成的 Dockerfile 文本
- 责任来源：Builder Agent
- 使用方：Reviewer、Security、部署层

#### `current_configs`

- 含义：当前轮生成的配置集合
- 责任来源：Builder Agent
- 使用方：Reviewer、Security、部署层
- 约束：用于承载 sealos、compose、workflow、env 模板等结构化配置

#### `build_summary`

- 含义：本轮生成结果摘要
- 责任来源：Builder Agent
- 使用方：前端展示、Reviewer 快速理解

#### `build_warnings`

- 含义：Builder 自我声明的不确定点或风险提示
- 责任来源：Builder Agent
- 使用方：Reviewer、前端展示


## 8. 审查结果层 Schema

### 8.1 目的

审查层分为质量审查和安全审查，两条链必须平行存在，不能混并。

### 8.2 Reviewer 结果字段

#### `review_history`

- 含义：Reviewer 多轮审查历史
- 责任来源：Reviewer Agent 累积写入
- 使用方：Router、前端展示、观测层
- 约束：按时间顺序累积，不覆盖旧结果

#### `latest_review_result`

- 含义：最近一轮质量审查结果
- 责任来源：编排层从历史中提取
- 使用方：Router、Builder
- 约束：属于派生字段，不替代 `review_history`

### 8.3 Reviewer 单轮结果语义

#### `reviewer_id`

- 含义：执行审查的 Reviewer 标识

#### `passed`

- 含义：该轮质量审查是否通过

#### `score`

- 含义：质量评分
- 约束：必须可比较，供 Router 使用

#### `summary`

- 含义：质量结论摘要

#### `improvement_suggestions`

- 含义：给 Builder 下一轮使用的改进建议列表
- 约束：必须尽量可执行，不能只写笼统判断

#### `risk_findings`

- 含义：识别出的风险点列表

#### `artifact_version`

- 含义：本轮审查对应的产物版本
- 约束：必须与 Builder 版本对应


## 9. 安全结果层 Schema

### 9.1 安全历史字段

#### `security_reports`

- 含义：Security 多轮扫描历史
- 责任来源：Security Agent 累积写入
- 使用方：Router、前端展示、观测层
- 约束：按轮次保留，不覆盖旧结果

#### `latest_security_result`

- 含义：最近一轮安全结果
- 责任来源：编排层从历史中提取
- 使用方：Router、Builder

### 9.2 Security 单轮结果语义

#### `scanner_id`

- 含义：执行安全检查的 Security 标识

#### `passed`

- 含义：该轮安全检查是否通过

#### `risk_score`

- 含义：安全风险评分
- 约束：分数越高表示风险越高，方向必须稳定

#### `summary`

- 含义：安全结论摘要

#### `issues`

- 含义：安全问题列表
- 约束：必须结构化，不允许纯文本拼接

### 9.3 Security 问题项语义

#### `issue_id`

- 含义：问题唯一标识

#### `severity`

- 含义：严重等级
- 约束：统一使用 low、medium、high、critical

#### `category`

- 含义：问题分类
- 约束：建议从 secrets、base_image、network、dependency、runtime、permission 中选

#### `title`

- 含义：问题标题

#### `description`

- 含义：问题详情

#### `remediation`

- 含义：修复建议


## 10. 路由控制层 Schema

### 10.1 目的

路由控制层是张瑞喆总图和你实现的子 Agent 之间的关键边界，字段必须最稳定。

### 10.2 必备字段

#### `stage`

- 含义：当前所处阶段
- 责任来源：状态机编排层
- 使用方：前端、日志层、调试层
- 约束：必须是枚举值，不允许自由文本

建议阶段值：

- `thinking`
- `building`
- `reviewing`
- `security_checking`
- `rebuilding`
- `approved`
- `failed`

#### `iteration_count`

- 含义：当前修复迭代次数
- 责任来源：编排层
- 使用方：Router、前端展示
- 约束：只能递增

#### `max_iteration_limit`

- 含义：允许的最大迭代轮次
- 责任来源：全局配置
- 使用方：Router

#### `is_approved`

- 含义：当前链路是否已达成通过共识
- 责任来源：Router 汇总结论后写入
- 使用方：编排层、前端、后端

#### `failure_reason`

- 含义：链路失败原因
- 责任来源：Router 或异常处理层
- 使用方：前端展示、观测层、人工排障

#### `last_error`

- 含义：最近一次执行异常信息
- 责任来源：节点执行层
- 使用方：调试和排障


## 11. 展示与观测层 Schema

### 11.1 目的

该层主要服务于你与成可心的联调，也服务于后续 WebSocket 或流式日志协议设计。

### 11.2 必备字段

#### `event_stream`

- 含义：面向前端的事件流集合
- 责任来源：状态机编排层
- 使用方：前端
- 约束：建议作为派生输出，不作为唯一主状态

#### `deployment_logs`

- 含义：部署阶段日志片段
- 责任来源：部署执行层
- 使用方：前端、观测层

#### `deployment_url`

- 含义：部署成功后的访问地址
- 责任来源：部署执行层
- 使用方：前端、项目详情页

#### `status_message`

- 含义：当前用户可理解的状态描述
- 责任来源：编排层
- 使用方：前端
- 约束：用于展示，不参与 Router 决策


## 12. 角色分工对应的字段边界

### 12.1 张瑞喆主责边界

张瑞喆负责定义和拍板以下字段约束：

- `stage`
- `iteration_count`
- `max_iteration_limit`
- `is_approved`
- 整体状态流转规范
- 全局 Prompt 约束

### 12.2 林子豪主责边界

林子豪负责提供或影响以下输入字段：

- `repo_context`
- `file_list`
- `readme_text`
- `tech_stack`
- `entrypoints`
- `dependency_files`
- `error_context`

### 12.3 胡曦元主责边界

胡曦元负责承接和对外包装以下字段：

- `project_id`
- `session_id`
- `repo_url`
- `default_branch`
- `current_dockerfile`
- `current_configs`
- `deployment_logs`
- `deployment_url`

### 12.4 杨钞越主责边界

杨钞越负责影响以下生成类字段和异步承载：

- `build_result`
- `artifact_version`
- 生成链路异步任务状态

### 12.5 成可心主责边界

成可心主要消费以下展示字段：

- `stage`
- `status_message`
- `review_history`
- `security_reports`
- `deployment_logs`
- `deployment_url`
- `event_stream`

### 12.6 你主责边界

你负责直接产出或维护以下核心字段：

- `build_result`
- `current_dockerfile`
- `current_configs`
- `review_history`
- `latest_review_result`
- Builder / Reviewer 的结构化约束
- 与状态流转相关的阶段语义一致性


## 13. 强制统一词汇

后续文档、代码、接口讨论中，以下词汇必须统一：

- 用 `builder`，不用 `generator`
- 用 `reviewer`，不用 `checker`
- 用 `security`，不用 `guard`
- 用 `stage`，不用 `step_status`
- 用 `iteration_count`，不用 `retry_times`
- 用 `review_history`，不用 `reviews`
- 用 `security_reports`，不用 `security_history`
- 用 `current_dockerfile`，不用 `docker_content`
- 用 `current_configs`，不用 `config_bundle`
- 用 `artifact_version`，不用 `version_tag`
- 用 `failure_reason`，不用 `fail_msg`


## 14. 后续任务必须遵守的约束

- 任何新字段加入前，必须先判断是否能归入现有字段语义。
- 如果必须新增字段，优先新增到对应层级，不得跨层乱放。
- Router 只能依赖结构化字段，不能依赖长文本判断。
- 前后端联调时，展示字段必须来源于主状态字段，不允许前端自行猜测阶段。
- Builder、Reviewer、Security 三方都必须围绕同一个 `artifact_version` 对齐。
- 任何历史字段都必须追加写入，不能覆盖旧轮次结果。
- 所有布尔字段必须表达单一判断，不允许一字段多义。

