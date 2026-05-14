你现在要实现 `solvers/b_patch_repo/patch_generate.py`。

功能
- 基于缺口报告生成结构化补丁。

上游信息接口
- 输入：MissingComponentReport、RepoProfile、error_context、相关源码上下文。
- 依赖：patch_generate.md、output_format.md、llm_client。

下游信息接口
- 输出：GeneratedFile[]、ModifiedFile[]、patch rationale。

实现
- 只生成与当前缺口直接相关的补丁。
- 优先小步修补，禁止无关重构。
- 允许先请求更多代码上下文，再生成 patch。
- 输出必须严格 JSON，可被 json_repair 与 schema 校验。
- 生成文件路径必须明确且落在 workspace 根内。

不接受的实现方式
- 不要一次性改很多无关文件。
- 不要只返回散文解释。

验收标准
- patch 可被 patch_applier 直接落盘。
