你现在要实现 `validators/port_validator.py`。

功能
- 校验端口定义在 plan、Dockerfile、启动命令、workspace 中是否一致。

上游信息接口
- 输入：FallbackPlan、dockerfile_content/path、docker_spec.start_command、deploy_target。

下游信息接口
- 输出：ValidationCheck 列表。

实现
- 检查 EXPOSE、docker_spec.start_command 中的 port、deploy_target 目标端口是否一致。
- 支持常见格式：`--port 8000`、`-p 3000`、环境变量端口。
- 若出现多个端口候选，必须给出冲突项。
- 可以对默认端口做弱提示，但不能擅自改写。

不接受的实现方式
- 不要只从 Dockerfile 读端口。
- 不要忽略启动命令里的端口声明。

验收标准
- 能准确识别端口不一致和缺失。
