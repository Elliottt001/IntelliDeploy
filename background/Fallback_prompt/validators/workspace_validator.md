你现在要实现 `validators/workspace_validator.py`。

功能
- 校验真实 workspace 是否具备最小部署闭包。
- 对最终源码目录做落地校验，而不是只校验计划。

上游信息接口
- 输入：workspace_path、FallbackPlan、RepoProfile。
- 来源：materialize 后的真实目录。

下游信息接口
- 输出：ValidationResult / ValidationCheck 列表。
- 供 validation_pipeline 使用。

实现
- 检查入口文件真实存在。
- 检查 Dockerfile、依赖文件、启动命令、端口、env 文件、healthcheck 是否一致。
- 目录中若缺少 plan 声明必须存在的文件，应报错。
- 校验结果分级：blocking / warning / info。
- 需要能指出具体文件路径与失败原因。

不接受的实现方式
- 不要只看 FallbackPlan，不看文件系统。
- 不要把所有失败都归为一个总错。

验收标准
- 能准确发现 workspace 和 plan 不一致的问题。
- 错误定位到文件级别。
