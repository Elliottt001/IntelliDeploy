fallback/
├── __init__.py
│   # 标记 fallback 为 Python 包。
│
├── main.py
│   # 本模块的本地测试入口。
│   # 用于手动传入 mock FallbackRequest，测试完整流程：
│   # request -> classify -> solve(plan) -> materialize(workspace) -> validate(workspace) -> package(artifact)。
│
├── schemas/
│   ├── __init__.py
│   │   # 导出所有数据结构。
│   │
│   ├── enums.py
│   │   # 定义所有枚举值。
│   │   # 例如 Decision(A/B/C/D)、Strategy、ProjectType、PackageManager、TaskStatus。
│   │
│   ├── request.py
│   │   # 定义输入接口 FallbackRequest。
│   │   # 输入仍然保持现有上下游约束，不新增“上游直接传完整源码包”字段。
│   │
│   ├── repo.py
│   │   # 定义仓库相关数据结构。
│   │   # 包括 RepoInfo、RepoProfile、FileTreeNode、KeyFile、ExtractionSummary。
│   │
│   ├── build.py
│   │   # 定义构建上下文。
│   │   # 包括 BuildContext、BuildError、failed_stage、error_summary。
│   │
│   ├── score.py
│   │   # 定义评分结构。
│   │   # 包括 DeployabilityScore、ScoreReason、RiskItem、ConflictItem。
│   │
│   ├── response.py
│   │   # 定义分类阶段输出。
│   │   # 包括 EvaluationResult、CandidateEvaluation、ClassifyResponse。
│   │
│   ├── plan.py
│   │   # 定义 solve 阶段输出的计划对象。
│   │   # 包括 FallbackPlan、GeneratedFile、ModifiedFile、DockerSpec、EnvVarSpec。
│   │
│   ├── workspace.py
│   │   # 定义真实工作区上下文。
│   │   # 包括 WorkspaceContext、WorkspacePaths、MaterializeResult、ArtifactManifest。
│   │
│   └── validation.py
│       # 定义校验结果。
│       # 包括 ValidationResult、ValidationCheck、ValidationError。
│
├── classifier/
│   ├── __init__.py
│   │   # 导出分类器主函数。
│   │
│   ├── extract_facts.py
│   │   # 从 FallbackRequest 中提取可评分事实。
│   │   # 例如：是否有 Dockerfile、入口文件是否存在、依赖文件是否存在、lock 文件是什么。
│   │
│   ├── package_manager_detector.py
│   │   # 包管理器判断。
│   │   # 根据 package-lock.json / pnpm-lock.yaml / yarn.lock / requirements.txt / pyproject.toml 判断。
│   │   # 这是确定性规则，不应交给 AI。
│   │
│   ├── framework_detector.py
│   │   # 框架判断辅助。
│   │   # 根据依赖和入口文件确认 FastAPI / Flask / React / Next.js / Express 等。
│   │
│   ├── entrypoint_detector.py
│   │   # 入口文件判断。
│   │   # 检查 main.py、app.py、server.js、src/main.ts 等是否存在并可启动。
│   │
│   ├── env_detector.py
│   │   # 环境变量提取。
│   │   # 从源码、README、.env.example 中提取 OPENAI_API_KEY、DATABASE_URL 等。
│   │   # 目的是防止 LLM 凭空生成环境变量。
│   │
│   ├── conflict_detector.py
│   │   # 冲突检测。
│   │   # 例如 README 说 npm start，但 package.json 没有 start；
│   │   # repo_profile 说 FastAPI，但源码没有 fastapi 证据。
│   │
│   ├── risk_detector.py
│   │   # 风险检测。
│   │   # 例如 archived、长期未维护、fork、需要 GPU 但无模型文件、需要数据库但无配置。
│   │
│   ├── scoring.py
│   │   # 评分规则实现。
│   │   # 根据 extract_facts 的结果计算 DeployabilityScore。
│   │   # 这是 ABCD 分类的核心程序规则。
│   │
│   ├── rules.py
│   │   # ABCD 硬规则。
│   │   # 例如信息严重缺失先判 D；分数高且条件满足判 A；半可用判 B；不可用但需求清楚判 C。
│   │
│   └── classify.py
│       # 分类主入口。
│       # 输入 FallbackRequest。
│       # 输出 EvaluationResult。
│       # 内部调用 extract_facts、scoring、rules。
│
├── solvers/
│   ├── __init__.py
│   │   # 导出 solve_by_decision()。
│   │
│   ├── router.py
│   │   # 根据 EvaluationResult.decision 路由到 A/B/C/D solver。
│   │   # A -> direct_deploy_solver
│   │   # B -> patch_repo_solver
│   │   # C -> vibe_scaffold_solver
│   │   # D -> manual_required_solver
│   │
│   ├── a_direct_deploy/
│   │   ├── __init__.py
│   │   │   # A 类处理模块。
│   │   │
│   │   ├── solve.py
│   │   │   # A 类主入口。
│   │   │   # 只生成 A 类执行计划。
│   │   │   # 真正的源码拉取、补 Dockerfile、补 env 文件在 materialize 阶段执行。
│   │   │
│   │   ├── dockerfile_reuse.py
│   │   │   # 已有 Dockerfile 时，提取并准备复用。
│   │   │   # 复用前必须交给 validators/dockerfile_validator.py 审查。
│   │   │
│   │   ├── dockerfile_generate.py
│   │   │   # 没有 Dockerfile 但信息足够时，基于模板生成 Dockerfile。
│   │   │   # 不建议让 LLM 从零写，应使用 templates 中的黄金模板。
│   │   │
│   │   └── command_resolver.py
│   │       # 生成或确认 run_command。
│   │       # 例如 uvicorn main:app --host 0.0.0.0 --port 8000。
│   │
│   ├── b_patch_repo/
│   │   ├── __init__.py
│   │   │   # B 类处理模块。
│   │   │
│   │   ├── solve.py
│   │   │   # B 类主入口。
│   │   │   # 只生成修补计划，不直接修改真实源码目录。
│   │   │
│   │   ├── missing_component.py
│   │   │   # 分析缺失组件。
│   │   │   # 例如 Dockerfile、start.sh、.env.example、启动命令、依赖声明。
│   │   │
│   │   ├── patch_generate.py
│   │   │   # 调用 LLM 或规则生成补丁。
│   │   │   # 输出 ModifiedFile / GeneratedFile。
│   │   │
│   │   ├── repair_loop.py
│   │   │   # 修复循环。
│   │   │   # 设置最大重试次数，例如 MAX_REPAIR_RETRIES = 3。
│   │   │   # 修复失败后转 C 类 fallback。
│   │   │
│   │   └── patch_apply_plan.py
│   │       # 输出结构化 patch plan。
│   │       # 供 services/patch_applier.py 在 workspace 中真正落盘。
│   │
│   ├── c_vibe_scaffold/
│   │   ├── __init__.py
│   │   │   # C 类处理模块。
│   │   │
│   │   ├── solve.py
│   │   │   # C 类主入口。
│   │   │   # 原仓库不可用，根据用户需求生成完整脚手架计划。
│   │   │   # 后续直接在 workspace 中落成新项目目录。
│   │   │
│   │   ├── scaffold_router.py
│   │   │   # 判断走哪条 C 类路径。
│   │   │   # 简单需求 -> scaffold_generate
│   │   │   # 复杂需求 -> component_reassembly
│   │   │
│   │   ├── scaffold_generate.py
│   │   │   # 直接生成项目骨架。
│   │   │   # 从 templates 中选择基础模板，让 AI 只填业务文件。
│   │   │
│   │   ├── component_decompose.py
│   │   │   # 把用户需求拆成组件。
│   │   │   # 例如 Auth_Module、Chat_UI、Payment_API。
│   │   │
│   │   ├── component_reassembly.py
│   │   │   # 按组件重组。
│   │   │   # 把标准组件拼接成一个可运行项目。
│   │   │
│   │   └── scaffold_postprocess.py
│   │       # 对生成项目做后处理。
│   │       # 例如统一文件路径、补 README、补 Dockerfile、补 .env.example。
│   │
│   └── d_manual_required/
│       ├── __init__.py
│       │   # D 类处理模块。
│       │
│       ├── solve.py
│       │   # D 类主入口。
│       │   # 信息不足时不调用 AI 乱生成。
│       │   # 返回 missing_information 和建议补充字段。
│       │   # 不进入 materialize/package。
│       │
│       └── missing_info_builder.py
│           # 生成缺失信息列表。
│           # 例如缺少 key_files、入口文件、依赖文件、用户需求不明确。
│
├── validators/
│   ├── __init__.py
│   │   # 导出所有校验器。
│   │
│   ├── dockerfile_validator.py
│   │   # Dockerfile 校验。
│   │   # 检查 FROM、WORKDIR、COPY、RUN、EXPOSE、CMD/ENTRYPOINT。
│   │
│   ├── package_manager_validator.py
│   │   # 包管理器校验。
│   │   # 防止 pnpm 项目被写成 npm install。
│   │
│   ├── env_validator.py
│   │   # 环境变量校验。
│   │   # 检查 generated env_vars 是否来自 detected_env_vars 或用户需求。
│   │   # 防止 LLM 幻觉变量。
│   │
│   ├── port_validator.py
│   │   # 端口校验。
│   │   # 检查 Dockerfile EXPOSE、run_command、deploy_target 是否一致。
│   │
│   ├── entrypoint_validator.py
│   │   # 入口校验。
│   │   # 检查 run_command 中的入口是否真的存在于 file_tree / generated_files。
│   │
│   ├── output_validator.py
│   │   # FallbackPlan 总体验证。
│   │   # 确认 generated_files、run_command、container_port、docker_spec 等字段完整。
│   │
│   ├── workspace_validator.py
│   │   # 真实工作区校验。
│   │   # 检查最终源码目录中入口、Dockerfile、依赖文件、启动命令、端口是否真实存在且一致。
│   │
│   └── validation_pipeline.py
│       # 校验流水线。
│       # 统一调用 plan 校验 + workspace 校验。
│
├── prompts/
│   # 所有 AI prompt 统一放在这里维护。
│   # Python 代码中不再内嵌 prompt 正文，只允许通过 services/prompt_loader.py 读取。
│   #
│   ├── extract_facts.md
│   │   # 分类阶段事实提取的 AI prompt。
│   │   # 仅做语义补充，不允许直接输出 ABCD。
│   │
│   ├── classify.md
│   │   # 分类阶段语义复核的 AI prompt。
│   │   # 只输出语义判断字段，最终 ABCD 仍由 rules.py 裁决。
│   │
│   ├── dockerfile_generate.md
│   │   # A 类生成 Dockerfile 的 prompt。
│   │   # 要求 LLM 基于模板填空，不从零发散。
│   │
│   ├── dockerfile_lint.md
│   │   # 审查已有 Dockerfile 的 prompt。
│   │   # 检查是否适合云原生部署，是否缺 CMD / EXPOSE。
│   │
│   ├── patch_generate.md
│   │   # B 类生成补丁的 prompt。
│   │   # 输入 missing_components、repo_context、error_context。
│   │
│   ├── repair_reflection.md
│   │   # 修复失败后的反思 prompt。
│   │   # 输入上一次 patch 和 error_msg，要求重新生成补丁。
│   │
│   ├── scaffold_generate.md
│   │   # C 类直接生成项目的 prompt。
│   │   # 输入 user_intent 和模板约束，输出完整 GeneratedFile 列表。
│   │
│   ├── component_decompose.md
│   │   # C 类组件拆解 prompt。
│   │   # 把自然语言需求拆成组件列表。
│   │
│   ├── component_reassembly.md
│   │   # C 类组件重组 prompt。
│   │   # 把标准组件连接成完整项目。
│   │
│   └── output_format.md
│       # 通用输出格式约束。
│       # 要求 LLM 只输出 JSON，不输出解释性散文。
│
├── templates/
│   ├── python_fastapi/
│   │   ├── Dockerfile.template
│   │   │   # FastAPI Dockerfile 黄金模板。
│   │   │
│   │   ├── requirements.txt.template
│   │   │   # 默认依赖模板。
│   │   │
│   │   ├── main.py.template
│   │   │   # C 类脚手架使用的 FastAPI 入口模板。
│   │   │
│   │   └── README.md.template
│   │       # 生成项目说明模板。
│   │
│   ├── python_flask/
│   │   ├── Dockerfile.template
│   │   ├── requirements.txt.template
│   │   ├── app.py.template
│   │   └── README.md.template
│   │
│   ├── node_express/
│   │   ├── Dockerfile.template
│   │   ├── package.json.template
│   │   ├── server.js.template
│   │   └── README.md.template
│   │
│   ├── react_vite/
│   │   ├── Dockerfile.template
│   │   ├── nginx.conf.template
│   │   ├── package.json.template
│   │   ├── src_App.jsx.template
│   │   └── README.md.template
│   │
│   ├── nextjs/
│   │   ├── Dockerfile.template
│   │   ├── package.json.template
│   │   ├── app_page.tsx.template
│   │   └── README.md.template
│   │
│   └── common/
│       ├── env.example.template
│       │   # .env.example 通用模板。
│       │
│       ├── start.sh.template
│       │   # 启动脚本模板。
│       │
│       └── healthcheck.template
│           # 健康检查模板。
│
├── services/
│   ├── __init__.py
│   │   # 导出服务层对象。
│   │
│   ├── fallback_service.py
│   │   # fallback 主服务。
│   │   # 对外暴露 evaluate()、solve_plan()、materialize()、validate()、package()。
│   │   # 串联 classifier、solvers、workspace、validators。
│   │
│   ├── llm_client.py
│   │   # LLM 调用封装。
│   │   # 统一处理模型调用、超时、重试、JSON 解析。
│   │
│   ├── prompt_loader.py
│   │   # 读取 prompts/*.md。
│   │   # 避免 prompt 写死在 Python 代码里。
│   │
│   ├── template_loader.py
│   │   # 读取 templates 中的黄金模板。
│   │   # 用于 Dockerfile 和脚手架生成。
│   │
│   ├── source_fetcher.py
│   │   # 源码拉取服务。
│   │   # 根据 repo_url/default_branch 将原仓库拉到 workspaces/{task_id}/source。
│   │
│   ├── workspace_manager.py
│   │   # 工作区管理服务。
│   │   # 创建 task workspace，维护 source/workspace/logs/metadata。
│   │
│   ├── patch_applier.py
│   │   # patch 落盘服务。
│   │   # 将 A/B/C plan 中的 generated_files / modified_files 真实写入 workspace。
│   │
│   ├── artifact_builder.py
│   │   # artifact 制品化服务。
│   │   # 将最终 workspace 导出为 artifact_path / artifact_uri / artifact_key。
│   │
│   ├── json_repair.py
│   │   # 修复 LLM 输出的 JSON 格式问题。
│   │   # 例如多余 markdown code fence、尾逗号。
│   │
│   ├── logger.py
│   │   # 日志封装。
│   │   # 记录 request_id、decision、score、selected_repo。
│   │
│   └── config.py
│       # fallback 模块配置。
│       # 例如 MAX_REPAIR_RETRIES、TOKEN_LIMIT、DEFAULT_PORTS。
│
├── workspaces/
│   └── {task_id}/
│       ├── source/
│       │   # 拉下来的原始仓库，只读基线。
│       │
│       ├── workspace/
│       │   # 真正应用 A/B/C 结果的工作目录。
│       │   # validate 和 package 都以这里为准。
│       │
│       ├── logs/
│       │   # git 拉取、patch 应用、校验、打包日志。
│       │
│       └── metadata.json
│           # 本次任务元信息。
│           # 例如 source_repo_url、decision、artifact_type、status、timestamps。
│
├── artifacts/
│   └── {task_id}/
│       ├── ...
│       │   # 最终交给下游部署的完整项目目录。
│       │
│       └── artifact_manifest.json
│           # 制品清单。
│           # 记录来源仓库、应用补丁、最终 Dockerfile、env、校验结果等。
│
├── async_tasks/
│   ├── __init__.py
│   │   # 异步任务模块。
│   │
│   ├── celery_app.py
│   │   # Celery 应用初始化。
│   │   # 配置 broker、backend、serializer、默认 queue。
│   │
│   ├── tasks.py
│   │   # Celery 任务定义。
│   │   # 统一包装 submit_fallback_task / run_fallback_task / get_task_status / get_task_artifact。
│   │   # 内部按 classify -> solve_plan -> materialize -> validate -> package 推进。
│   │
│   ├── redis_state.py
│   │   # Redis 状态读写。
│   │   # 保存 TaskState 和 ArtifactResponse。
│   │   # status 使用 QUEUED / RUNNING / SUCCEEDED / FAILED；
│   │   # current_stage 使用 queued / classifying / solving / materializing / validating / packaging / completed / failed / manual_required。
│   │
│   └── task_schema.py
│       # 异步任务输入输出结构。
│       # 和 HTTP API 返回 task_id、查询状态、拉取 artifact 时配合使用。
│
└── tests/
    ├── test_scoring.py
    │   # 测试评分规则。
    │
    ├── test_classify.py
    │   # 测试 ABCD 分类。
    │
    ├── test_package_manager_detector.py
    │   # 测试 npm / pnpm / yarn / pip / poetry 判断。
    │
    ├── test_dockerfile_validator.py
    │   # 测试 Dockerfile 校验。
    │
    └── fixtures/
        ├── fastapi_good.json
        │   # A 类样例。
        │
        ├── fastapi_missing_dockerfile.json
        │   # B 类样例。
        │
        ├── unusable_repo.json
        │   # C 类样例。
        │
        └── missing_info.json
            # D 类样例。


# ABCD 后续处理完整流程

## 通用主链路

1. `classify`
   - 输入：`FallbackRequest`
   - 输出：`ClassifyResponse`
   - 决定 A / B / C / D

2. `solve(plan)`
   - A/B/C/D solver 只生成结构化 `FallbackPlan`
   - 此时还没有最终 artifact

3. `materialize(workspace)`
   - A/B：先根据 `repo_url + default_branch` 拉源码到 `workspaces/{task_id}/source`
   - A/B：复制到 `workspaces/{task_id}/workspace`
   - C：直接在 `workspaces/{task_id}/workspace` 生成完整项目
   - D：跳过

4. `validate(workspace)`
   - 先校验 plan
   - 再校验真实 workspace
   - 失败则进入 repair / regenerate / manual_review

5. `package(artifact)`
   - 将最终 `workspace/` 导出到 `artifacts/{task_id}`
   - 返回 `artifact_path / artifact_uri / artifact_key`

---

## A 类后续处理

1. 分类判定为 A
2. `solve_a` 生成最小补充计划
   - 可能补 Dockerfile
   - 可能补 `.env.example`
   - 不改业务代码
3. 拉取原仓库到 `source/`
4. 复制到 `workspace/`
5. 在 `workspace/` 中应用补充文件
6. 校验最终目录
7. 导出 `artifact_path`
8. 交下游部署

建议产物类型：
- `STITCHED_PROJECT`

---

## B 类后续处理

1. 分类判定为 B
2. `solve_b` 生成 patch plan
3. 拉取原仓库到 `source/`
4. 复制到 `workspace/`
5. 在 `workspace/` 中真正应用 patch
6. 执行 workspace 校验
7. 若失败：
   - 进入 repair loop
   - 重试上限后转 C
8. 若成功：
   - 导出 `artifact_path`
   - 交下游部署

建议产物类型：
- `STITCHED_PROJECT`

---

## C 类后续处理

1. 分类判定为 C
2. `solve_c` 生成 scaffold / component reassembly plan
3. 直接在 `workspace/` 中生成完整项目
4. 补 README / Dockerfile / `.env.example` / healthcheck
5. 执行 workspace 校验
6. 导出 `artifact_path`
7. 交下游部署

建议产物类型：
- 简单模板：`TEMPLATE_PROJECT`
- 复杂重组：`STITCHED_PROJECT`

---

## D 类后续处理

1. 分类判定为 D
2. `solve_d` 生成 `missing_information`
3. 不拉源码，不生成 workspace
4. 不打包 artifact
5. 返回人工补充提示
6. 等待上游补齐信息后重新进入主链路
