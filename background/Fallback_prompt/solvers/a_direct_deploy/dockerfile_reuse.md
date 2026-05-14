你现在要实现 `solvers/a_direct_deploy/dockerfile_reuse.py`。

功能
- 从已存在 Dockerfile 中提取复用信息，供 A 类计划使用。

上游信息接口
- 输入：RepoProfile、关键 Dockerfile 内容。
- 来源：A 类 solve。

下游信息接口
- 输出：DockerReuseResult，包含 dockerfile_content、detected_port、base_image、warnings。

实现
- 提取基础镜像、工作目录、EXPOSE、CMD/ENTRYPOINT。
- 识别是否明显不适合云部署，并返回 lint_required 或 warning。
- 不能直接判定可部署，必须交 validator 审核。

不接受的实现方式
- 不要直接把原 Dockerfile 视为正确。
- 不要忽略多阶段构建。

验收标准
- 能稳定提取关键部署信息。
