你现在要实现 `solvers/a_direct_deploy/dockerfile_generate.py`。

功能
- 为 A 类缺失 Dockerfile 的项目生成模板化 Dockerfile 计划。

上游信息接口
- 输入：RepoProfile、start_command、package_manager、模板加载能力。
- 依赖：template_loader、相关 prompt。

下游信息接口
- 输出：GeneratedFile 或 DockerSpec。

实现
- 优先使用 templates 中黄金模板，再按项目事实填空。
- 只生成部署必要内容，不做业务文件生成。
- 结果必须和 package manager、端口、入口一致。
- 需要支持 Node/Next.js/FastAPI/Flask 等主要模板。

不接受的实现方式
- 不要从零自由生成一个发散 Dockerfile。
- 不要忽略 lock 文件和运行命令。

验收标准
- 生成结果可直接进入 Dockerfile validator。
