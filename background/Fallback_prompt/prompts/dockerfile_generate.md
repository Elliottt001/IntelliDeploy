你现在要编写运行时 prompt 文件 `prompts/dockerfile_generate.md`。

功能
- 指导 LLM 在 A 类或 C 类后处理里基于模板生成 Dockerfile。
- 只允许模板填空式生成，不允许从零发散。

上游信息接口
- 输入：repo_profile、framework、package_manager、docker_spec.start_command、docker_spec.exposed_port、selected_template。

下游信息接口
- 输出：严格 JSON，包含 dockerfile_content、base_image、workdir、exposed_port、start_command、notes。

实现
- 明确要求优先复用黄金模板。
- 明确禁止擅自切换包管理器、瞎补环境变量、猜测无证据命令。
- 要求输出和项目事实一致。
- 结果只能描述 Dockerfile，不输出散文解释。

验收标准
- 可被 `services/llm_client.py` 直接调用。
- 输出可被 `json_repair.py` 与 schema 校验。
