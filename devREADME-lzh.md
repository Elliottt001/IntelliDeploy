# LZH 检索与召回后端说明

这份文档给后端同事快速理解“阶段一：自然语言需求 -> Top 3 GitHub 仓库候选”的实现。

## 入口接口

代码入口在 `backend/app/routers/intellideploy/retrieval.py`。

### 1. 搜索仓库

`POST /api/retrieval/repos/search`

请求体：

```json
{
  "natural_language_query": "帮我找一个可部署的梦境记录工具",
  "top_n": 3,
  "readme_corpus": []
}
```

字段说明：

- `natural_language_query`：用户原始自然语言需求。
- `top_n`：返回候选数量，默认 3，最大 10。
- `readme_corpus`：可选。临时传入 README 语料，方便测试或接爬虫结果；生产可先通过 `/api/retrieval/readmes` 预加载。

响应核心结构：

```json
{
  "intent": {
    "raw_query": "...",
    "target_output_type": "repository",
    "target_app_type": "journal_app",
    "expected_features": ["dream journal", "tags"],
    "preferred_language": "TypeScript",
    "preferred_framework": "Next.js",
    "constraints": {},
    "keywords": ["dream", "journal"],
    "github_query": "dream journal topic:nextjs stars:>50 pushed:>2025-05-12",
    "tech_stack": ["Next.js", "React", "TypeScript"]
  },
  "candidates": [
    {
      "rank": 1,
      "retrieval_score": 123.4,
      "repo_url": "https://github.com/owner/repo",
      "default_branch": "main",
      "description": "...",
      "topics": ["nextjs"],
      "stars": 200,
      "is_archived": false,
      "last_commit_at": "2026-04-01T00:00:00Z",
      "file_tree": ["package.json", "Dockerfile"],
      "key_files": {
        "README.md": "...",
        "package.json": "..."
      }
    }
  ],
  "repository_profile": {}
}
```

### 2. 加载 README 语料

`POST /api/retrieval/readmes`

请求体：

```json
{
  "documents": [
    {
      "repo_id": "owner/repo",
      "full_name": "owner/repo",
      "description": "repo description",
      "readme_content": "README text",
      "metadata": {
        "html_url": "https://github.com/owner/repo",
        "stars": 200,
        "pushed_at": "2026-04-01T00:00:00Z",
        "topics": ["nextjs"],
        "files": ["package.json", "Dockerfile"]
      }
    }
  ]
}
```

响应：

```json
{"accepted": 1}
```

## 主要模块

- `backend/app/agent_core/brains/router_agent.py`
  - `RouterAgent.structure_intent(query)`：把自然语言需求结构化为 `RepoIntent`。
  - 有模型配置时可走 LLM；没有配置时走本地启发式规则。

- `backend/app/agent_core/memory/vector_store.py`
  - `BM25ReadmeStore.upsert_many(documents)`：加载 README 语料。
  - `BM25ReadmeStore.search(keywords, top_k)`：按 BM25 召回候选仓库。

- `backend/app/agent_core/brains/github_retriever.py`
  - `GitHubRepositorySearchClient.search_repositories(query)`：调用 GitHub Search API。
  - `enrich_repository(candidate)`：补文件树、README、关键文件内容。

- `backend/app/agent_core/brains/context_rag_agent.py`
  - `NL2RepoRetrievalPipeline.retrieve(query, top_n)`：完整双轨检索流程。
  - 流程：意图结构化 -> GitHub 精确召回 + README BM25 召回 -> 去重 -> GitHub 上下文补全 -> 硬过滤 -> 部署可行性粗排 -> 可选 LLM 精排 -> Top N。

- `backend/app/services/retrieval_service.py`
  - FastAPI 路由使用的服务层。
  - 负责组装 `RouterAgent`、GitHub client、BM25 store 和 pipeline。

## 配置项

在 `backend/app/config.py`：

- `GITHUB_TOKEN`：单个 GitHub token。
- `GITHUB_SEARCH_TOKENS`：多个 GitHub token，用逗号分隔，做简单轮询。
- `GITHUB_SEARCH_TIMEOUT_SECONDS`：GitHub 请求超时。
- `MODEL_API` / `BASE_URL`、`MODEL_KEY` / `API_KEY`、`MODEL_NAME`：配置后启用 LLM 意图结构化和 LLM 精排；未配置时自动降级到本地规则和算法粗排。

## 打分逻辑

硬过滤：

- 归档仓库不进入候选。
- 最近一年无更新的仓库不进入候选。
- 已拿到文件结构时，必须有 `package.json`、`requirements.txt`、`pyproject.toml`、`pom.xml`、`go.mod`、`Dockerfile` 或 `docker-compose.yml` 之一。

粗排加权：

- BM25/GitHub 召回相关性。
- Stars 取 log，避免高星仓库无脑碾压。
- 最近更新时间。
- Dockerfile / docker-compose 权重高。
- 技术栈匹配当前模板储备时加分。
- 同时命中 GitHub 和 BM25 时加分。

## 本地使用示例

```python
from app.agent_core.brains.context_rag_agent import NL2RepoRetrievalPipeline
from app.agent_core.brains.router_agent import RouterAgent
from app.agent_core.memory.vector_store import BM25ReadmeStore, ReadmeDocument

store = BM25ReadmeStore()
store.upsert_many([
    ReadmeDocument(
        repo_id="owner/repo",
        full_name="owner/repo",
        description="Dream journal app",
        readme_content="Dream journal with Dockerfile and Next.js deployment.",
        metadata={
            "html_url": "https://github.com/owner/repo",
            "stars": 200,
            "pushed_at": "2026-04-01T00:00:00Z",
            "topics": ["dreams", "nextjs"],
            "files": ["Dockerfile", "package.json"]
        }
    )
])

pipeline = NL2RepoRetrievalPipeline(router=RouterAgent(), readme_store=store)
result = await pipeline.retrieve("帮我找一个可部署的梦境记录工具", top_n=3)
```

## 测试

新增测试：

```bash
python -m pytest tests\unit\test_nl2repo_retrieval.py -q
```

当前已知情况：

- 检索模块测试通过。
- 整体 `tests/unit` 里有旧测试失败：`ErrorParser` 缺少 `diagnose` 方法，和本模块无关。

## 开发约定建议

开发过程中写这种 `devREADME` 是合理的，尤其适合多人并行、接口还在快速变化的阶段。注意三点：

- 保持短，讲入口、字段、调用方式和测试命令即可。
- 不要让它替代正式接口契约；稳定后最好同步到 OpenAPI、`docs/` 或接口平台。
- 每次改接口字段时顺手更新文档，否则后续会变成误导。
