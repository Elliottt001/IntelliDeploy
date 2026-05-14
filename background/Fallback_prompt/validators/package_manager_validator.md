你现在要实现 `validators/package_manager_validator.py`。

功能
- 校验包管理器与项目真实依赖文件是否一致。

上游信息接口
- 输入：RepoProfile、FallbackPlan、workspace_path。
- 来源：A/B/C 全流程。

下游信息接口
- 输出：ValidationCheck 列表。

实现
- 根据 package-lock.json、pnpm-lock.yaml、yarn.lock、requirements.txt、pyproject.toml、go.mod、pom.xml 判断真实包管理器。
- 检查安装命令是否与锁文件匹配。
- 对 Node、Python、Go、Java 主要场景都要覆盖。
- 若 plan 使用 npm，但项目实际为 pnpm，应报 blocking error。

不接受的实现方式
- 不要只相信 repo_profile，不校验实际文件。
- 不要把所有后端都当 pip。

验收标准
- 能发现包管理器误判与命令错配。
