# NL2Repo Retrieval Ranking Weights

本文档说明当前 NL2Repo 阶段的仓库召回、过滤和重排规则。目标从“找热门相关仓库”调整为“找更像可直接部署应用/模板的仓库”。

## 1. 召回策略

GitHub 召回不再只跑单个 `sort=stars` 查询，而是最多跑 4 路查询并合并去重：

1. Router 生成的基础查询，例如 `fastapi topic:fastapi stars:>50 pushed:>...`
2. 应用模板查询，例如 `fastapi admin dashboard template docker stars:>50 pushed:>...`
3. 功能约束查询，例如 `fastapi auth database postgresql starter stars:>50 pushed:>...`
4. 全栈部署查询，例如 `fastapi full stack template docker stars:>50 pushed:>...`

不同查询和不同排名的 GitHub 结果会按位置衰减 source score：

```text
github_source_score = max(0.35, 1.0 - query_index * 0.12 - result_index * 0.04)
```

这样高 star 框架仓库不会因为出现在第一路查询里就天然压过后续召回到的应用模板。

## 2. 硬过滤

以下仓库会直接过滤或强降权：

| 规则 | 行为 |
| --- | --- |
| archived 仓库 | 直接过滤 |
| 最近更新时间超过 1 年 | 直接过滤 |
| 有文件树但没有工程结构 | 直接过滤 |
| 框架/库本体 | 强负分 |
| 教程/课程/awesome/example collection | 强负分 |
| 没有部署证据 | 强负分 |

工程结构包括：

```text
package.json
requirements.txt
pyproject.toml
go.mod
pom.xml
Dockerfile
docker-compose.yml
```

## 3. 正向权重

当前粗排分数由以下部分相加：

| 分项 | 上限 | 说明 |
| --- | ---: | --- |
| `retrieval_relevance` | 20 | GitHub/BM25 召回相关性，已按多路查询位置衰减 |
| `intent_match` | 30 | 仓库名称、描述、topics、文件名、README/key files 是否匹配用户意图 |
| `deployability` | 25 | Dockerfile、docker-compose、依赖文件、入口文件、lock file 等部署证据 |
| `application_signal` | 15 | template/starter/boilerplate/full-stack/admin/dashboard/app 等应用模板信号 |
| `stack_match` | 12 | 首选框架和语言是否匹配，例如 FastAPI/Python |
| `recency` | 8 | 最近 1 年更新给满分，1-2 年半分 |
| `stars` | 5 | 只作为弱信号，log 计分并封顶 |
| `docker_bonus` | 8 | 保留兼容字段，Docker/compose/container 信号加分 |
| `template_stack_bonus` | 5 | 模板信号和技术栈同时匹配时加分 |
| `package_structure` | 10 | 保留兼容字段，来自部署结构分的截断值 |
| `dual_track_bonus` | 4 | 同时被 GitHub 和 BM25 召回时加分 |
| `complexity_fit` | 5 | 文件树较小、结构清晰的项目加分；过大项目扣分 |

## 4. 负向权重

| 分项 | 分值 | 触发条件 |
| --- | ---: | --- |
| `framework_library_penalty` | -35 | framework/library/sdk、本体框架仓库，如 `fastapi/fastapi` |
| `tutorial_penalty` | -30 | tutorial/course/learn/awesome/beginner/Hello-Python 等学习资料 |
| `no_deploy_evidence_penalty` | -25 | 没有 Docker、依赖文件、入口文件等部署证据 |
| `intent_mismatch_penalty` | -45 或 -15 | 用户要后台/admin，但仓库没有 admin/dashboard/backoffice/management UI 信号；或明显是图片/压缩/机器学习工具 |

负分项用于解决“关键词命中但用途不对”的问题，例如：

- `fastapi/fastapi`：框架本体，用户要可部署应用时应下沉。
- `mouredev/Hello-Python`：教程/课程仓库，应下沉。
- 泛工具仓库：即使 topic 有 FastAPI，也不应压过后台管理模板。
- 只有 auth/database 但没有 admin/dashboard 的 full-stack 模板：可作为候选，但后台意图下要下沉。

## 5. Router 意图增强

Router 现在会识别以下中文/英文意图：

| 用户表达 | 结构化结果 |
| --- | --- |
| 后台、管理系统、admin、dashboard、backoffice | `target_app_type = admin_dashboard` |
| 登录、用户、login、auth、authentication | 增加 `auth` keyword 和 `user authentication` feature |
| 数据库、database、postgres/postgresql/mysql/sqlite | `has_database = true`，增加 `database` feature |
| FastAPI + 后台/API/后端 | 技术栈补充 `Python` 和 `FastAPI` |

示例：

```text
我想部署一个 FastAPI 后台管理系统，带用户登录和数据库
```

会被结构化为：

```text
target_app_type: admin_dashboard
keywords: fastapi, admin dashboard, backoffice, auth, database
tech_stack: Python, FastAPI
has_database: true
preferred_language: Python
```

## 6. 预期效果

对于“FastAPI 后台管理系统，带用户登录和数据库”这类请求：

应优先排序：

- FastAPI admin/dashboard template
- full-stack FastAPI starter
- 带 Docker/PostgreSQL/auth 的可部署示例

应下沉：

- 框架本体，例如 `fastapi/fastapi`
- 教程仓库，例如 `Hello-Python`
- 只是 topic 里有 FastAPI 的泛工具仓库
- 没有 Docker/依赖/入口文件的不可部署仓库
