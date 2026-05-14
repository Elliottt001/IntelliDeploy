现在本地同步测试链路已经不是旧的三段式，而是：

```text
main.py
  ↓
evaluate
  ↓
solve_plan
  ↓
materialize
  ↓
validate
  ↓
package
```

后面接 FastAPI 后，同步 HTTP 入口会变成：

```text
HTTP API
  ↓
FallbackRequest
  ↓
FallbackService.run_pipeline()
  ↓
classification / plan / materialize_result / validation / artifact
```

后面接 Celery / Redis 后，异步链路应统一为：

```text
HTTP API
  ↓
submit_fallback_task()
  ↓
创建 task_id
  ↓
Celery worker 后台执行
  classify -> solve_plan -> materialize -> validate -> package
  ↓
Redis / StateStore 记录
  QUEUED -> RUNNING
  current_stage: queued / classifying / solving / materializing / validating / packaging / completed / failed / manual_required
  ↓
前端轮询 task status
  ↓
SUCCEEDED 时拉取 artifact
```

关键约束：

1. `status` 作为异步任务主状态，建议只保留：
   - `QUEUED`
   - `RUNNING`
   - `SUCCEEDED`
   - `FAILED`

2. 细粒度阶段不要继续扩散到 `status` 枚举里，统一放到：
   - `current_stage`

3. 异步 worker 不要自己重写业务逻辑：
   - 编排必须复用 `FallbackService.evaluate()`
   - `FallbackService.solve_plan()`
   - `FallbackService.materialize()`
   - `FallbackService.validate()`
   - `FallbackService.package()`

4. D 类必须保持短路：
   - 只返回 `missing_information`
   - 不进入 `materialize`
   - 不进入 `package`
   - `artifact_ready=false`

5. 对外 artifact 响应仍兼容下游接口 C：
   - 内部主字段使用 `env_vars`
   - 对异步接口响应映射为 `required_envs`

Celery 和 Redis 的职责不是再发明一套 fallback 流程，而是把这条已经确定的执行闭环：

```text
classify -> solve_plan -> materialize -> validate -> package
```

包装成：

- 可异步执行
- 可追踪状态
- 可查询结果
- 可失败回放

的工程层。
