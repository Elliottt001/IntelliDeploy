你现在要实现 `solvers/a_direct_deploy/command_resolver.py`。

功能
- 生成或确认项目启动命令。

上游信息接口
- 输入：RepoProfile、entrypoints、framework、package_manager、README 摘要。

下游信息接口
- 输出：RuntimeResolveResult，包含 start_command、exposed_port、confidence、evidence。

实现
- 根据框架和入口文件推断启动命令。
- 对 Python/FastAPI、Flask、Node/Express、Next.js、Vite 等有明确规则。
- 若 README 与实际依赖冲突，保留冲突信息而不是强行拍板。
- 结果需要证据链，便于 validator 使用。

不接受的实现方式
- 不要纯靠 LLM 猜。
- 不要只看 README 不看文件事实。

验收标准
- 常见框架下能给出稳定 start_command。
