你现在要实现 `async_tasks/celery_app.py`。

功能

- 提供 fallback 异步任务的 Celery 应用初始化。
- 统一 broker / result backend / serializer / queue 配置。
- 为 `tasks.py` 提供可直接注册的 Celery app。

上游信息接口

- 输入来源：环境变量、配置对象、部署环境。
- 依赖：Celery。

下游信息接口

- 输出：`celery_app`、`get_celery_app()`、`is_async_enabled()`。
- 供 `async_tasks/tasks.py` 注册任务使用。

实现

1. 必须支持从环境变量读取：
   - `CELERY_BROKER_URL`
   - `CELERY_RESULT_BACKEND`
   - `CELERY_TASK_DEFAULT_QUEUE`
   - `CELERY_TIMEZONE`

2. 默认配置建议：
   - queue: `fallback`
   - serializer: `json`
   - accept_content: `["json"]`
   - result_serializer: `json`
   - timezone: `UTC`
   - task_track_started: `true`

3. 如果 Celery 未安装：
   - 模块仍可安全导入
   - `celery_app` 可以为 `None`
   - 但 `get_celery_app()` 不要裸返回 `None`
   - 应抛出结构化异常，例如 `CeleryUnavailableError`
   - 同时提供显式能力判断接口，如 `is_async_enabled() -> bool`
   - 必须让上层明确知道“当前仅支持同步或本地执行”
   - 不允许 silent fail

4. 不要把业务逻辑塞进这里：
   - 不在 `celery_app.py` 里直接调用 `FallbackService`
   - 这里只负责 Celery 初始化和配置

5. 需要为后续扩展预留：
   - task routes
   - retry policy
   - rate limit
   - worker queue 分流

6. 推荐调用约定：
   - `submit_fallback_task()` 先调用 `is_async_enabled()`
   - 仅在返回 `true` 时再获取 app 并投递任务
   - 如直接调用 `get_celery_app()`，调用方必须处理 `CeleryUnavailableError`

不接受的实现方式

- 不要把所有 Celery 配置硬编码死在模块里且无法覆盖。
- 不要在这里定义任务状态机。
- 不要在这里直接操作 Redis 状态存储。
- 不要把“未安装 Celery”编码成容易被误用的裸 `None` 协议。

验收标准

- Celery 安装后可稳定初始化 app。
- `tasks.py` 可直接导入并注册任务。
- 本地未安装 Celery 时，模块仍可安全导入。
