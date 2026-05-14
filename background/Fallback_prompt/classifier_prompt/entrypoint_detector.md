
文件：classifier/entrypoint_detector.py

功能

- 识别入口文件、启动命令、构建命令、端口。
- 生成运行链路观察项 runtime_chain_observations。
- 只做“运行事实提取”，不做最终运行链路闭合判断。

上游信息接口
输入来自：

- file_tree
- key_files
- package_manager_detector 结果
- framework_detector 结果

下游信息接口
输出给 extract_facts.py：
{
  "has_entry_file": "boolean",
  "entry_candidates": [],
  "entry_summary": "string | null",
  "has_start_script": "boolean",
  "detected_start_commands": [],
  "has_build_script": "boolean",
  "detected_build_commands": [],
  "detected_ports": [],
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
  "uncertain_points": []
}

并且这些输出要服务于：

- 下游接口 A 的 repo_profile.entrypoints
- 下游接口 A 的 constraints.target_port 候选

必须实现的函数

1. detect_entry_candidates(...)
2. detect_start_commands(...)
3. detect_build_commands(...)
4. detect_ports(...)
5. build_runtime_chain_observations(...)

实现

1. 入口候选规则：
   Python：

   - main.py
   - app.py
   - manage.py
   - server.py
   - src/main.py

   Node / 前端：

   - server.js
   - index.js
   - app.js
   - src/main.ts
   - src/main.tsx
   - src/App.tsx
   - pages/index.tsx
   - app/page.tsx

   Go：

   - main.go
   - cmd/main.go
2. 启动命令提取来源：

   - package.json scripts
   - Procfile
   - Makefile
   - Dockerfile CMD / ENTRYPOINT
   - README 启动说明
3. 构建命令提取来源：

   - package.json scripts.build
   - Makefile
   - README
   - Dockerfile RUN
4. 端口提取来源：

   - Dockerfile EXPOSE
   - docker-compose ports
   - 代码中的 listen / port / PORT
   - README
5. 生成 runtime_chain_observations：

   - start_script_points_to_existing_entry：
     启动脚本是否指向真实存在的入口文件
   - entry_contains_runnable_object：
     入口中是否存在 main / 服务实例 / 路由 / 监听逻辑 / CLI 入口
   - dependencies_cover_detected_framework：
     依赖是否覆盖入口中出现的主框架
   - build_command_matches_project_type：
     构建命令是否符合项目类型
   - port_detected：
     是否发现端口
   - host_binding_observed：
     是否观察到 host 绑定
   - env_vars_required：
     入口中直接引用的环境变量名
   - readme_scripts_conflict：
     README 启动方式和 scripts / Makefile / Procfile 是否冲突
   - dockerfile_entry_conflict：
     Dockerfile 启动命令和真实入口是否冲突

注意

- 不做 runtime_chain_closed 最终判断。
- 不做 A/B/C/D 分类。
- 不把“没有 Dockerfile”视为运行链路错误。
- 入口存在不等于入口能运行。
