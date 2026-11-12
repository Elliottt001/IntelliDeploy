# IntelliDeploy

IntelliDeploy 是一期中的 AI 应用生成与托管平台。当前仓库已经接通持久应用/任务、四路线检索与生成、候选验证和发布适配、实例与社区、额度与三渠道支付协议、Web/Expo 客户端、平台运维，以及固定质量/故障验收套件。

本地实现完成不等于真实交付完成。真实 DeepSeek、可信 runner、registry、Linux/Sealos、支付宝/微信/Stripe 商户、iOS/Android 设备和平台生产演练仍为 `NOT_RUN`，当前 `release_ready=false`。进度和证据分别见[一期实施进度](docs/一期实施进度.md)与[一期真实验收记录](docs/一期真实验收记录.md)。

## 目录

| 目录 | 职责 |
| --- | --- |
| `backend/` | FastAPI 产品 API、Python Worker、Alembic 迁移 |
| `web/` | Next.js Web 与服务端认证代理 |
| `frontend/` | Expo/React Native 客户端 |
| `packages/api-client/` | OpenAPI 生成的共享类型与请求函数 |
| `tests/phase1/` | 一期协议、数据库、集成与验收测试 |
| `infra/` | 本地数据库、runner 和平台运行配置 |

## 本地环境

要求 Python 3.13、Node.js 24、npm 和 Docker/Compose。所有命令从仓库根目录运行。

```bash
uv python install 3.13
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt -r backend/requirements-dev.txt
npm ci
docker compose -p intellideploy-dev -f infra/compose.dev.yml up -d --wait postgres
DATABASE_URL=postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test \
  PYTHONPATH=backend .venv/bin/python -m alembic -c backend/alembic.ini upgrade head
npm run api:generate
```

按 `backend/.env.example` 配置 `backend/.env` 和随机 `SECRET_KEY`；Web 配置 `API_BASE_URL`、`WEB_ORIGIN`、`SESSION_SECRET`。API 启动只检查数据库是否位于唯一 Alembic head，不会自动建表或修改旧 SQLite。

## 启动

分别在四个终端启动：

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
npm run dev:mobile
```

API 文档默认位于 `http://localhost:9000/docs`。`POST /api/apps` 需要 `Idempotency-Key`；返回 `QUEUED` 只表示任务已持久化，不能当成应用已经生成或交付。

## 旧数据审计与迁移

先只读审计旧库。命令仅输出表计数、schema 差异和迁移阻塞项，不输出密码哈希或 kubeconfig。

```bash
PYTHONPATH=backend .venv/bin/python scripts/audit_legacy_state.py backend/intellideploy.db
```

实际迁移前必须停止旧写入、确认 `DATABASE_URL` 指向预期的非生产目标，并使用一个不存在的新快照路径。迁移会通过 SQLite backup 创建权限为 `0600` 的一致性快照；存在旧项目、部署、分析或 GitHub 账号时会拒绝继续；用户 ID、用户名、邮箱、密码哈希、启用状态和创建时间保持不变，不迁移 kubeconfig，也不授予开发者权限。

```bash
DATABASE_URL=postgresql+psycopg://... \
  PYTHONPATH=backend .venv/bin/python scripts/migrate_legacy_users.py \
  --source backend/intellideploy.db \
  --snapshot /secure/path/intellideploy-legacy.snapshot.db
```

仓库自动化只在专用 `intellideploy_test` 数据库验证迁移；不会自动对持久环境运行上述迁移命令。

## 验证

```bash
PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1 -q
npm --workspace @intellideploy/api-client test
npm --workspace web test
npm --workspace web run typecheck
npm --workspace web run build
npm --workspace web run test:e2e
npm --workspace frontend test
npm --workspace frontend run typecheck
npm --workspace frontend exec -- expo export --platform all --output-dir dist
npm --workspace frontend run test:e2e
```

真实验收复用同一 API/Worker 流程，按 `smoke -> quality -> flow -> faults` 执行。缺外部资源时结果必须保持 `NOT_RUN`，不能使用 fixture、强制路线、构建成功或伪造 URL 补成 `PASS`。

```bash
PYTHONPATH=backend .venv/bin/python scripts/run_phase1_acceptance.py \
  --suite smoke --api-url http://127.0.0.1:9000 \
  --output artifacts/evaluations/smoke/records.json

PYTHONPATH=backend .venv/bin/python scripts/summarize_phase1_evaluations.py \
  --records artifacts/evaluations/smoke/records.json \
  --records artifacts/evaluations/quality/records.json \
  --records artifacts/evaluations/flow/records.json \
  --records artifacts/evaluations/faults/records.json \
  --reviews artifacts/evaluations/reviews.json \
  --output artifacts/evaluations/summary.json
```

外部资源、支付和原生设备准备要求见[一期外部资源准备清单](docs/一期外部资源准备清单.md)，完整运行细节见[开发运行指南](docs/开发运行指南.md)和[平台上线运行指南](docs/平台上线运行指南.md)。
