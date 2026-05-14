你现在要编写 `prompts/scaffold_generate.md`。

功能
- 指导 LLM 在 C 类简单模板场景中生成完整项目计划。

上游信息接口
- 输入：user_intent、preferred_stack、template_constraints、required_features、deployment_constraints。

下游信息接口
- 输出：严格 JSON，包含 generated_files、project_structure、docker_spec、env_vars。

实现
- 以最小可运行项目为目标。
- 必须包含入口文件、依赖文件、Dockerfile、README、env.example、healthcheck。
- 严禁发散生成功能需求之外的模块。
- 输出只描述文件与结构，不写散文。

验收标准
- 结果可直接在空 workspace 中落地。
