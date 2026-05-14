你现在要实现 `solvers/d_manual_required/missing_info_builder.py`。

功能
- 生成结构化 missing_information 列表。

上游信息接口
- 输入：RepoProfile、EvaluationResult、FallbackRequest。

下游信息接口
- 输出：MissingInformationItem[]。

实现
- 至少覆盖：缺少 key_files、入口文件、依赖文件、源码不可访问、用户需求不明确。
- 每项都包含 field、reason、required_action、severity。
- 区分“缺事实”和“缺约束”。

不接受的实现方式
- 不要只返回一段自然语言。
- 不要把所有问题归结为“信息不足”。

验收标准
- D 类 solve 可直接使用其结果。
