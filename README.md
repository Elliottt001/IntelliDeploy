# IntelliDeploy

用自然语言描述需求，平台检索并复用开源代码或生成应用，自动验证、修复并部署为Web应用。支持继续对话调整、社区共享及独立副本。

一期正在按[实施总计划](docs/superpowers/plans/2026-11-09-phase1-00-roadmap.md)开发。已实现持久应用/任务API、PostgreSQL迁移、Worker租约及共享客户端/BFF、额度账本和Web工作台基础；真实生成、手机新客户端、平台能力、云部署、社区和支付仍在实施。旧演示部署结果不算真实交付。

| 目录 | 职责 |
| --- | --- |
| backend/ | FastAPI产品API、Python Worker |
| frontend/ | 保留的Expo手机平台客户端 |
| web/ | 新增Next.js平台Web及服务端认证代理 |
| packages/api-client/ | 从OpenAPI生成的共享类型与请求函数 |
| infra/ | 开发数据库及后续执行/部署配置 |
| tests/phase1/ | 新链路的协议、数据库与后续真实验收 |

环境：Python3.13、Node24、npm、Docker/Compose。所有命令从仓库根运行：

```bash
uv python install 3.13
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt -r backend/requirements-dev.txt
docker compose -p intellideploy-dev -f infra/compose.dev.yml up -d --wait postgres
PYTHONPATH=backend .venv/bin/python -m alembic -c backend/alembic.ini upgrade head
npm ci
npm run api:generate
```

先按backend/.env.example设置backend/.env和随机SECRET_KEY，Web另设API_BASE_URL、WEB_ORIGIN、SESSION_SECRET；详见[开发运行指南](docs/开发运行指南.md)。根package-lock管理三个npm工作区，API启动不会自动建表或修改旧SQLite。

分别在终端运行npm run dev:api、dev:web、dev:mobile。dev:worker脚本已建立，在完整pipeline实施前明确退出，不模拟任务成功。当前Web可以操作持久任务状态；旧Expo聊天屏幕正等待07-E2接入新API。

API文档：http://localhost:9000/docs。JSON登录后Authorize填Bearer token，POST /api/apps需Idempotency-Key，GET /api/jobs/{id}读取持久状态。创建返回QUEUED只说明任务已保存，不能当成应用交付。

```bash
DATABASE_URL=postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test PYTHONPATH=backend .venv/bin/python -m alembic -c backend/alembic.ini upgrade head
PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1 -q
npm --workspace @intellideploy/api-client test
npm --workspace web test
npm --workspace web run typecheck
npm --workspace web run build
npm --workspace frontend exec -- tsc --noEmit
```

真实模型、隔离执行节点、Linux/Sealos、镜像仓库、三支付和原生设备按[外部资源准备清单](docs/一期外部资源准备清单.md)准备。缺条件的验收记NOT_RUN，不能以mock、Expo网页导出或构建成功声称一期完成。产品范围和交付协议见[PRD](docs/PRD.md)、[交付与测试说明](docs/一期交付与测试说明.md)。
