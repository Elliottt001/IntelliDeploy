文件：classifier/conflict_detector.py

功能

- 检测 README、依赖文件、启动脚本、Dockerfile、入口文件之间的明确冲突。
- 输出 conflict_items 和 warnings。

上游信息接口
输入来自：

- repo_fact_summary 中间事实
- key_files

下游信息接口
输出给 extract_facts.py：
{
  "conflict_items": [],
  "warnings": []
}

这些输出后续提供给：

- scoring.py
- rules.py
- 分类 AI

必须实现的函数

1. detect_readme_script_conflicts(...)
2. detect_dockerfile_entry_conflicts(...)
3. detect_framework_entry_conflicts(...)
4. detect_port_conflicts(...)
5. detect_all_conflicts(...)

实现
必须检测以下冲突：

1. README 说 npm start，但 package.json 没有 start。
2. README 说 npm run dev，但 package.json 没有 dev。
3. package.json script 指向不存在的文件。
4. Dockerfile CMD 指向不存在的入口。
5. Dockerfile EXPOSE 端口和代码监听端口明显不同。
6. Dockerfile 使用 Python，但依赖文件是 package.json 且无 Python 入口。
7. Dockerfile 使用 Node，但仓库只有 Python 入口。
8. framework_detector 识别 FastAPI，但入口没有 FastAPI 或相关依赖。
9. framework_detector 识别 React / Vite，但没有前端入口或构建脚本。
10. docker-compose command 和项目入口冲突。

注意

- 缺 Dockerfile 不算冲突。
- 缺 docker-compose 不算冲突。
- README 不完整不算冲突。
- 只有“明确不一致”才写入 conflict_items。
- 冲突和风险分开，不能混写。
