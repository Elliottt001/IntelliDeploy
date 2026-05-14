
文件：classifier/framework_detector.py

功能

- 基于依赖文件、配置文件、入口文件和文件树，识别：
  1. detected_language
  2. detected_framework
  3. detected_project_type_by_rule
  4. framework_evidence
- 这是规则识别模块，不做最终分类。

上游信息接口
输入来自：

- file_tree
- key_files
- dependency_files
- entry_candidates
- package_manager_detector.py 的输出

下游信息接口
输出给 extract_facts.py：
{
  "detected_language": "string | unknown",
  "detected_framework": "string | unknown",
  "detected_project_type_by_rule": "frontend_web | backend_api | fullstack | static_site | cli_tool | library | ml_service | mcp | automation_tool | unknown",
  "framework_evidence": [],
  "warnings": [],
  "uncertain_points": []
}

同时这些字段需要服务于后续下游接口 A：

- detected_language -> repo_profile.detected_languages
- detected_framework -> repo_profile.detected_frameworks

必须实现的函数

1. detect_language(...)
2. detect_framework(...)
3. detect_project_type_by_rule(...)
4. build_framework_evidence(...)

实现

1. 识别优先级：
   - 依赖文件 > 配置文件 > 入口文件 > 文件树结构 > README 线索
2. 语言识别：
   - package.json -> javascript/typescript
   - requirements.txt / pyproject.toml -> python
   - pom.xml / gradle -> java
   - go.mod -> go
   - Cargo.toml -> rust
   - composer.json -> php
   - Gemfile -> ruby
3. 框架识别规则：
   - React：package.json 中存在 react
   - Vite：存在 vite 依赖或 vite.config.ts / vite.config.js
   - Next.js：存在 next 依赖或 next.config.js / next.config.ts
   - Vue：存在 vue 依赖
   - Express：依赖存在 express，且入口中存在 express() / app.listen
   - FastAPI：依赖或源码存在 fastapi / FastAPI()
   - Flask：依赖或源码存在 flask / Flask(__name__)
   - Django：依赖存在 django 或 manage.py 存在
   - Spring Boot：pom.xml 中存在 spring-boot-starter
   - Go HTTP：go.mod 存在且入口包含 net/http / http.ListenAndServe
   - MCP：依赖、README、源码或目录结构出现 MCP server / tools / resources / prompts / Model Context Protocol
4. 项目类型规则：
   - frontend_web：前端框架为主，存在 pages / app / src/main.tsx / App.tsx 等
   - backend_api：后端服务框架为主，存在路由、服务实例、监听逻辑
   - fullstack：前后端证据同时存在，或 Next.js / Django 等承载前后端
   - static_site：主要是 html/css/js，无后端依赖
   - cli_tool：存在 click / argparse / commander / bin 字段 / main CLI 逻辑
   - library：主要导出 SDK / 模块 / 函数，无服务入口
   - ml_service：出现 gradio / streamlit / 模型加载 / 推理逻辑
   - automation_tool：爬虫、自动化脚本、任务执行工具
   - unknown：证据不足
5. framework_evidence 必须输出“依据来自哪里”，例如：
   - dependency:react
   - config:next.config.js
   - entry:FastAPI()
   - tree:pages/

注意

- 不要只根据 README 判断框架。
- 多个框架并存时，保留主框架，uncertain_points 增加 multi_framework_detected。
- 不做最终 A/B/C/D 分类。
- 不调用 AI。
