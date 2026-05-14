你现在要实现 `validators/entrypoint_validator.py`。

功能
- 校验 docker_spec.start_command 对应的入口是否真实存在且可解析。

上游信息接口
- 输入：FallbackPlan.docker_spec.start_command、RepoProfile、workspace_path。

下游信息接口
- 输出：ValidationCheck 列表。

实现
- 识别 Python、Node、Go、Java 常见入口命令格式。
- 将入口文件解析到 workspace 中对应路径。
- 检查 main.py / app.py / server.js / src/main.ts 等文件存在性。
- 对 `uvicorn main:app`、`node server.js`、`npm run start` 等分别处理。
- 发现 command 与文件树不匹配时给出明确定位。

不接受的实现方式
- 不要只做模糊字符串匹配。
- 不要把脚本命令和文件入口混为一谈。

验收标准
- 能准确发现入口缺失、模块对象缺失、脚本名错误。
