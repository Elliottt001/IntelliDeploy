```text
C:\Users\ROG\Desktop\Deploy\
├─ agent_state.py              # 状态协议中心：定义全局共享状态、Reviewer 输出、安全输出
├─ graph.py                    # 状态机主编排：连接 Builder、Reviewer、Security、Router
├─ router.py                   # 路由决策层：根据审计结果和轮次决定继续、通过或失败
├─ builder_agent.py            # Builder Agent：生成 Dockerfile 和部署配置
├─ reviewer_agent.py           # Reviewer Agent：审查生成结果的完整性和可部署性
├─ security_agent.py           # Security Agent：扫描镜像、依赖、密钥和网络风险
├─ prompts.py                  # Prompt 模板层：统一管理各 Agent 的提示词
├─ validators.py               # 输出校验层：校验并规范化模型返回结果
├─ runtime.py                  # 运行时适配层：封装 LLM / RAG / 重试 / 超时逻辑
└─ background\
   └─ total_frame.md           # 当前整体文件架构说明
```
让AI按照当前的这个文件架构给每个文件写提示词，或者你自己写，如果让AI写完之后你要负责验收，确保对整体框架的控制。明白每个文件的输入输出和功能

prompt 模板
输入
输出
功能
实现
注释
共五个模块，注释可选

记得让AI写完自己去跑一下测试。