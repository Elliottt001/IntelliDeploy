你现在实现 `classifier/extract_facts.py`。

目标：
实现信息提取主入口。
输入 `FallbackRequest`，输出统一的 `user_intent_summary` 和 `repo_fact_summary`。
这个文件负责编排其他 detector，并在需要时调用“信息提取 AI”。

边界：

- 不做 A/B/C/D 最终分类。
- 不生成 Dockerfile。
- 不修复项目。
- 不部署。
- 不编造输入中不存在的文件、依赖、入口、端口、脚本或框架。

特别要求：
这个文件输出的字段，必须能被后续模块**直接映射**到胡的接口 A 请求体，不允许后续再靠猜测补字段。

也就是说，这个文件必须稳定产出至少以下可映射信息：

- `repo_profile.source_repo_url`
- `repo_profile.detected_languages`
- `repo_profile.detected_frameworks`
- `repo_profile.package_manager`
- `repo_profile.entrypoints`
- `repo_profile.dependency_files`
- `repo_profile.has_valid_dockerfile`
- `repo_profile.readme_summary`
- `missing_components`
- `constraints.target_port` 的候选值
- `preferred_stack.frontend`
- `preferred_stack.backend`
- `preferred_stack.runtime`

不要直接输出胡的接口格式，但要保证当前输出可一对一映射。

输入至少包含：

- raw_query
- user_intent
- repo_info
- file_tree
- key_files

必须完成：

1. 解析用户需求，生成 `user_intent_summary`。
2. 判断 `user_intent_state`：
   - clear
   - partially_clear
   - unclear
3. 解析仓库文件树和关键文件内容。
4. 调用：
   - `package_manager_detector.py`
   - `framework_detector.py`
   - `entrypoint_detector.py`
   - `env_detector.py`
   - `conflict_detector.py`
   - `risk_detector.py`
5. 汇总 detector 输出为 `repo_fact_summary`。
6. 判断 `repo_material_state`：
   - sufficient
   - partial
   - insufficient
7. 生成：
   - missing_items
   - conflict_items
   - warnings
   - uncertain_points
   - runtime_chain_observations
8. 额外生成以下“对胡接口友好”的稳定字段：
   - `detected_languages`
   - `detected_frameworks`
   - `preferred_stack`
   - `has_valid_dockerfile`
   - `readme_summary`
   - `missing_components`
   - `target_port_candidates`
   - `env_var_sources`
   - `env_var_details`
9. 判断是否需要调用信息提取 AI。
10. 如果需要，构造 AI 输入，调用信息提取 AI，并合并结果。
11. 输出完整 JSON，不允许缺 key。

`user_intent_state` 规则：

clear：
能明确知道用户要生成或部署什么类型的东西。
例如：博客、后台管理系统、API 服务、聊天机器人、MCP 工具、数据看板、静态网站、自动化工具。

partially_clear：
能看出大方向，但功能不完整。
例如：“部署一个网站”“弄一个后台”“做一个接口服务”“生成一个能运行的项目”。

unclear：
无法判断用户要什么。
例如：“帮我弄一下”“部署这个”“做个项目”，且没有其他上下文。

要求：
用户多数不是专业开发者。只要能判断大方向，不要轻易标记 unclear。

`repo_material_state` 规则：

sufficient：
有文件树；有真实代码；有依赖文件、入口文件、配置文件、README、源码目录中的若干项；足够判断项目类型和大致运行方式。

partial：
有一定代码或说明；但缺少关键运行信息；需要进一步语义判断。

insufficient：
几乎没有代码；只有 README、LICENSE、.gitignore；没有依赖文件；没有入口文件；没有可判断项目用途的内容。

`detected_languages` 规则：

- 必须是数组。
- 即使只检测到一种语言，也输出数组。
- 不要把 unknown 放进数组；如果确实无法判断，则输出空数组并在 warnings 标记。

`detected_frameworks` 规则：

- 必须是数组。
- 主框架在前。
- 次框架或工具型框架可以放后面。
- 不要把构建工具和主框架混淆，例如 React + Vite 应输出两个元素，但 React 应排前。

`preferred_stack` 规则：
这个字段是为了后续构造胡接口 A 中的 `preferred_stack.*`。
必须输出：

{
  "frontend": "string | null",
  "backend": "string | null",
  "database": "string | null",
  "runtime": "string | null"
}

生成规则：

- frontend：React / Next.js / Vue / Vite 等前端主栈
- backend：FastAPI / Flask / Django / Express / Spring Boot / Go HTTP 等后端主栈
- database：只有在源码、README、依赖或环境变量中出现明确证据时才填写
- runtime：尽量输出运行时版本，例如 python3.11、node18；没有版本证据时只输出 python / node

`has_valid_dockerfile` 规则：

- 不是简单等于 has_dockerfile
- 必须满足：
  - 有 Dockerfile
  - Dockerfile 启动入口不与实际入口明显冲突
  - Dockerfile 基础镜像与项目语言不明显冲突
- 否则为 false

`readme_summary` 规则：

- 这是为了后续直接映射到 `repo_profile.readme_summary`
- 需要输出一个简短、稳定、面向工程的仓库摘要
- 不要写成营销文案
- 不要输出超过 200 字
- 没有 README 或 README 无有效信息时可为 null

`missing_components` 规则：
这个字段必须面向胡接口 A 的 `missing_components`。
输出字符串数组，例子：

- Dockerfile
- docker_compose
- start_script
- build_script
- entry_file
- dependency_file
- env_example
- healthcheck
- runtime_config

要求：

- 只列“缺失的组件”
- 不把“冲突”写进 missing_components
- 不把“低质量”写进 missing_components

`target_port_candidates` 规则：

- 必须是整数数组
- 从 Dockerfile EXPOSE、docker-compose、源码监听端口、README 中提取
- 顺序按可信度从高到低
- 后续 classify.py 用它来映射胡接口 A 的 `constraints.target_port`

`env_var_sources` 和 `env_var_details` 规则：

- 这两个字段必须直接保留 `env_detector.py` 的结构化输出。
- 不允许在 `extract_facts.py` 中把结构化环境变量信息压扁后丢失。
- `detected_env_vars` 只用于快速索引；不能替代 `env_var_details`。
- 后续如果生成阶段需要构造下游接口 C 的 `required_envs`，应优先基于 `env_var_details`，而不是重新猜测。
- 如果未检测到环境变量：
  - `env_var_sources = {}`
  - `env_var_details = []`

AI 调用条件：
以下任一情况出现时，必须调用信息提取 AI：

1. README 较长，需要总结项目用途、启动方式或功能说明。
2. 依赖文件较复杂，需要总结核心技术栈。
3. 入口文件较复杂，需要判断是否存在可运行对象或服务启动逻辑。
4. 文件结构复杂，程序无法稳定判断项目类型。
5. `detected_project_type_by_rule = unknown`。
6. `detected_framework = unknown`，但仓库有真实代码。
7. README、启动脚本、Dockerfile、入口文件之间存在不一致，需要 AI 总结冲突。
8. 程序无法判断仓库是应用、库、CLI、脚本、MCP、静态站点还是服务。
9. `runtime_chain_observations` 中存在关键 `unknown`。
10. `uncertain_points` 非空。
11. `user_intent_state = partially_clear`，且仓库描述、README 或 topics 可能提供用途线索。
12. description / topics / README 能提供用途线索，但程序无法稳定归纳。

如果调用 AI，不要把原始仓库全部无脑传入。先构造摘要输入。

输出结构必须至少包含：

{
  "user_intent_summary": {
    "raw_query": "string",
    "target_output_type": "deployable_app | mcp | unknown",
    "target_app_type": "backend_api | frontend_web | fullstack | chatbot | dashboard | static_site | automation_tool | unknown",
    "expected_features": [],
    "preferred_language": "string | null",
    "preferred_framework": "string | null",
    "constraints": {},
    "user_intent_state": "clear | partially_clear | unclear"
  },
  "repo_fact_summary": {
    "repo_url": "string",
    "rank": "number | null",
    "retrieval_score": "number | null",
    "description": "string | null",
    "topics": [],
    "stars": "number | null",
    "is_archived": "boolean",
    "last_commit_at": "string | null",

    "repo_material_state": "sufficient | partial | insufficient",

    "has_real_code": "boolean",
    "has_dependency_file": "boolean",
    "dependency_files": [],
    "dependency_summary": "string | null",

    "package_manager": "npm | pnpm | yarn | pip | poetry | uv | maven | go | cargo | composer | bundler | unknown",
    "lock_files": [],

    "has_entry_file": "boolean",
    "entry_candidates": [],
    "entry_summary": "string | null",

    "has_start_script": "boolean",
    "detected_start_commands": [],

    "has_build_script": "boolean",
    "detected_build_commands": [],

    "has_dockerfile": "boolean",
    "has_valid_dockerfile": "boolean",
    "dockerfile_summary": "string | null",

    "has_docker_compose": "boolean",
    "compose_summary": "string | null",

    "has_config_file": "boolean",
    "config_files": [],

    "detected_language": "string | unknown",
    "detected_languages": [],
    "detected_framework": "string | unknown",
    "detected_frameworks": [],
    "detected_project_type_by_rule": "frontend_web | backend_api | fullstack | static_site | cli_tool | library | ml_service | mcp | automation_tool | unknown",
    "detected_project_type_by_semantics": "frontend_web | backend_api | fullstack | static_site | cli_tool | library | ml_service | mcp | automation_tool | unknown",

    "preferred_stack": {
      "frontend": "string | null",
      "backend": "string | null",
      "database": "string | null",
      "runtime": "string | null"
    },

    "detected_ports": [],
    "target_port_candidates": [],
    "detected_env_vars": [],
    "env_var_sources": {},
    "env_var_details": [],

    "readme_summary": "string | null",
    "missing_items": [],
    "missing_components": [],
    "conflict_items": [],
    "risk_items": [],

    "repo_empty_or_near_empty": "boolean",
    "only_docs_or_notes_or_template": "boolean",

    "runtime_chain_observations": {
      "start_script_points_to_existing_entry": "true | false | unknown",
      "entry_contains_runnable_object": "true | false | unknown",
      "dependencies_cover_detected_framework": "true | false | unknown",
      "build_command_matches_project_type": "true | false | unknown",
      "port_detected": "true | false | unknown",
      "host_binding_observed": "true | false | unknown",
      "env_vars_required": [],
      "readme_scripts_conflict": "true | false | unknown",
      "dockerfile_entry_conflict": "true | false | unknown"
    },

    "warnings": [],
    "uncertain_points": [],

    "ai_extraction_required": "boolean",
    "ai_extraction_reason": []
  }
}

另外，在本文件中内置一个用于程序调用的“信息提取 AI Prompt”字符串常量或模板构造函数。

这个 AI Prompt 必须只做语义摘要补充，不能做分类。必须要求 AI 只输出如下 JSON：

{
  "README_summary": "string | null",
  "dependency_summary": "string | null",
  "entry_summary": "string | null",
  "dockerfile_summary": "string | null",
  "compose_summary": "string | null",
  "detected_language": "string | unknown",
  "detected_framework": "string | unknown",
  "detected_project_type_by_semantics": "frontend_web | backend_api | fullstack | static_site | cli_tool | library | ml_service | mcp | automation_tool | unknown",
  "runtime_chain_observations": {
    "start_script_points_to_existing_entry": "true | false | unknown",
    "entry_contains_runnable_object": "true | false | unknown",
    "dependencies_cover_detected_framework": "true | false | unknown",
    "build_command_matches_project_type": "true | false | unknown",
    "port_detected": "true | false | unknown",
    "host_binding_observed": "true | false | unknown",
    "env_vars_required": [],
    "readme_scripts_conflict": "true | false | unknown",
    "dockerfile_entry_conflict": "true | false | unknown"
  },
  "conflict_items": [],
  "warnings": [],
  "uncertain_points": []
}

验收要求：

- 输入任何候选仓库，都能输出完整 JSON。
- 不缺字段。
- 程序可验证事实优先级高于 AI。
- AI 不能覆盖文件存在性等确定事实。
- 不输出 A/B/C/D。
- 输出结果可直接映射到胡接口 A 的 repo_profile / missing_components / preferred_stack / constraints.target_port。
- 输出结果必须保留结构化环境变量信息，供后续生成阶段映射到接口 C 的 `required_envs`。
