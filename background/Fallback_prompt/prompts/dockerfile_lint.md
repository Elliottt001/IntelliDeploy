你现在要编写 `prompts/dockerfile_lint.md`。

功能
- 让 LLM 审查已有 Dockerfile 是否适合当前云部署场景。

上游信息接口
- 输入：dockerfile_content、repo_profile、docker_spec.start_command、docker_spec.exposed_port。

下游信息接口
- 输出：严格 JSON，包含 issues、warnings、suggested_fix、is_reusable。

实现
- 检查 FROM、WORKDIR、COPY、RUN、EXPOSE、CMD/ENTRYPOINT、基础镜像合理性。
- 明确区分 blocking issue 和 warning。
- 不直接修改文件，只给结构化审查意见。

验收标准
- 输出足够让 A 类 solve 决定复用还是重生。
