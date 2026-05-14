文件：classifier/risk_detector.py

功能

- 检测事实层面的运行和维护风险。
- 输出 risk_items 和 warnings。
- 不做分类结论。

上游信息接口
输入来自：

- repo_info
- repo_fact_summary 中间结果

下游信息接口
输出给 extract_facts.py：
{
  "risk_items": [],
  "warnings": []
}

这些输出后续提供给：

- scoring.py
- rules.py
- 分类 AI

必须实现的函数

1. detect_archive_risk(...)
2. detect_stale_risk(...)
3. detect_fork_risk(...)
4. detect_gpu_risk(...)
5. detect_model_file_risk(...)
6. detect_database_risk(...)
7. detect_external_api_risk(...)
8. detect_large_runtime_risk(...)
9. detect_all_risks(...)

实现
检测规则：

1. repository_archived：
   - is_archived = true
2. stale_repository：
   - last_commit_at 距当前时间过久
3. possible_fork：
   - repo_info 或 topics 显示 fork 信息
4. gpu_required：
   - README、依赖或代码中出现 CUDA、torch、tensorflow-gpu、nvidia、GPU 等
5. missing_model_file：
   - 项目显式需要模型文件，但文件树中未发现模型文件
6. database_required：
   - 出现 DATABASE_URL、SQLAlchemy、Prisma、TypeORM、Django database、PostgreSQL、MySQL、MongoDB 等
7. database_config_missing：
   - 需要数据库但未发现配置说明或环境变量
8. external_api_required：
   - 出现 API key、OPENAI_API_KEY、ANTHROPIC_API_KEY 等
9. large_runtime_risk：
   - 依赖或说明显示运行资源较大

注意

- 风险不等于冲突。
- 风险不等于分类结果。
- 不输出修复建议。
- 不做 A/B/C/D 判断。
