
文件：classifier/__init__.py

功能

- 作为 classifier 包的唯一公共入口文件。
- 对外暴露稳定 API，隐藏内部文件实现细节。
- 统一导出信息提取主入口、分类主入口，以及必要的辅助入口。
- 不承载任何业务判断逻辑。

上游信息接口

- 无直接业务字段输入。
- 只接收模块内部函数、类型、常量。

下游信息接口

- 对外导出的函数必须能被服务层直接调用：
  1. classify_fallback_request
  2. extract_repository_facts
- 可选导出：
  3. build_candidate_decision
  4. apply_hard_rules
  5. apply_final_rules

实现

1. 只做导出，不写任何信息提取逻辑。
2. 只做导出，不写任何分类逻辑。
3. 只做导出，不写任何 AI Prompt 拼接逻辑。
4. 使用显式导入，不要 `import *`。
5. 提供 `__all__`，确保公共 API 清晰。
6. 导出的函数名必须稳定，不要随意更改。
7. 避免循环依赖：
   - `__init__.py` 只从具体模块导入顶层函数
   - 不反向引用 `classifier` 包自身

注意

- 不要在这个文件里定义 dataclass / pydantic model。
- 不要在这个文件里定义常量配置。
- 不要在这个文件里写运行时副作用。
- 保持文件极简。
