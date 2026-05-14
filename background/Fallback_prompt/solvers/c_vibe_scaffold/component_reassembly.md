你现在要实现 `solvers/c_vibe_scaffold/component_reassembly.py`。

功能
- 根据组件规范重组成完整项目计划。

上游信息接口
- 输入：ComponentSpec[]、preferred_stack、templates、RepoProfile 可复用线索。
- 依赖：component_reassembly.md、template_loader。

下游信息接口
- 输出：GeneratedFile[]、ModifiedFile[]、project_structure、runtime spec。

实现
- 明确组件之间的调用关系、路由关系、依赖关系和文件归属。
- 以可运行项目为目标，而不是组件堆叠。
- 生成的目录结构必须统一、闭合、可直接落地。
- 若复用原仓库语义，只复用必要模块，不把原仓库直接当部署对象。

不接受的实现方式
- 不要只把组件名称拼在一起。
- 不要缺少入口、依赖文件、Dockerfile。

验收标准
- 输出能直接驱动 workspace 生成完整项目。
