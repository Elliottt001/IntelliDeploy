# IntelliDeploy

第11步新增平台生产Compose、管理CLI、健康/结构化日志及引用保护清理，入口见[平台上线运行指南](docs/平台上线运行指南.md)。代码与本机验证和真实生产/节点演练分开记录，后者仍需资源交接。

第10步已新增三渠道订单/验签入账、订阅周期及双客户端购买/到账恢复入口；配置与验证见[开发运行指南的支付部分](docs/开发运行指南.md)。真实商户和原生支付验收仍为NOT_RUN，一期后续按总计划继续。

一期按[实施总计划](docs/superpowers/plans/2026-11-09-phase1-00-roadmap.md)开发，现已实现持久应用/任务、额度账本、需求/检索/生成模块、候选验证与发布适配、实例管理，以及第8步社区/独立副本和双客户端协议联调。P7已补默认需求冻结/生成依赖、受控runner/实例配置与发布接线；真实外部验收仍需资源条件，见[实施进度](docs/一期实施进度.md)和[规划待办](docs/一期规划待办.md)。局部测试和旧演示结果不算真实应用交付。

一期正在按[实施总计划](docs/superpowers/plans/2026-11-09-phase1-00-roadmap.md)开发。已实现持久应用/任务API、PostgreSQL迁移、Worker租约、共享客户端/BFF、额度账本、双客户端状态基础，以及DeepSeek协议、需求冻结、隔离工具、检索四路线、固定脚手架、索引兼容与可恢复生成循环。02目前只形成候选，平台能力、候选验证修复、云发布、社区和支付仍在实施；旧演示部署结果不算真实交付。

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

分别在终端运行npm run dev:api、dev:web、dev:mobile。dev:worker已加载候选/发布与维护循环，已自动组装新生成依赖；配置不完整保存明确失败，不模拟成功。当前Web和Expo已接持久应用/任务API，支持创建、对话、取消/额度恢复和离开后回读；Expo原生token迁移到SecureStore，浏览器预览使用独立存储适配。社区、副本、code身份和实例管理已接同一API；真实交付与原生验收、支付后续继续实施。

API文档：http://localhost:9000/docs。JSON登录后Authorize填Bearer token，POST /api/apps需Idempotency-Key，GET /api/jobs/{id}读取持久状态。创建返回QUEUED只说明任务已保存，不能当成应用交付。

```bash
DATABASE_URL=postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test PYTHONPATH=backend .venv/bin/python -m alembic -c backend/alembic.ini upgrade head
PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1 -q
npm --workspace @intellideploy/api-client test
npm --workspace web test
npm --workspace web run typecheck
npm --workspace web run build
npm --workspace frontend run typecheck
npm --workspace frontend test
npm --workspace frontend run test:e2e
```

frontend的test:e2e会启动9105测试API、3105生产模式Web和8085 Expo浏览器预览，使用独立intellideploy_test数据库；追问/交付状态夹具不算生成证据。

真实模型、隔离执行节点、Linux/Sealos、镜像仓库、三支付和原生设备按[外部资源准备清单](docs/一期外部资源准备清单.md)准备。缺条件的验收记NOT_RUN，不能以mock、Expo网页导出或构建成功声称一期完成。产品范围和交付协议见[PRD](docs/PRD.md)、[交付与测试说明](docs/一期交付与测试说明.md)。
