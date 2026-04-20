你现在要实现 `async_tasks/redis_state.py`。

功能

- 提供任务状态与 artifact 结果的状态存储抽象。
- 默认支持 Redis；本地测试可退化到 InMemory 实现。

上游信息接口

- 输入来源：`tasks.py` 中的状态更新、artifact 保存动作。

下游信息接口

- 输出接口至少包括：
  - `save_task()`
  - `update_task()`
  - `get_task()`
  - `save_artifact()`
  - `get_artifact()`
  - `get_state_store()`

实现

1. 存储边界要清晰：
   - task state 和 artifact result 分开保存
   - 不要把 artifact 大对象和状态机字段混在一个 value 里

1.1 如需支持 repair / regenerate 任务：
   - 可以单独保存规范化后的请求快照
   - 请求快照必须与 task state / artifact result 分开存，不要混存

2. `update_task()` 必须是增量更新：
   - 不能覆盖掉已有 `project_id` / `deployment_id` / `updated_at`
   - 必须支持高频阶段切换

2.1 并发更新原则：
   - 同一个 `task_id` 的状态更新按“单任务串行写入”假设设计
   - 第一版不要默认支持多个 worker 并发修改同一个 task
   - 如果未来拆成多子任务，需要单独引入版本号、CAS 或事件流合并策略，而不是复用当前接口直接并写

3. 必须允许两种实现：
   - `InMemoryTaskStateStore`
   - `RedisTaskStateStore`

4. Redis key 建议：
   - `fallback:task:{task_id}`
   - `fallback:artifact:{task_id}`
   - 如保存请求快照，可使用 `fallback:request:{task_id}`

5. TTL 建议可配置：
   - 从配置中读取，如 `state_ttl_seconds`

6. 数据格式：
   - 统一存 JSON 可序列化结构
   - 不直接存 Python 对象

7. 状态更新原则：
   - `status` 用主状态
   - `current_stage` 用细阶段
   - 每次更新都刷新 `updated_at`
   - `update_task()` 只合并本次变化字段，不负责解决多 writer 冲突

8. D 类约束：
   - D 类不调用 `save_artifact`
   - 但必须保留最终 `TaskState`

不接受的实现方式

- 不要把 Redis 细节散落到 `tasks.py`。
- 不要只实现内存态，完全不预留 Redis 版本。
- 不要让 `update_task()` 变成“读不到旧值就整条覆盖”的脆弱写法。
- 不要把当前接口误写成支持同一 task 多 worker 并发覆盖。

验收标准

- 本地测试可用内存实现。
- 部署时可平滑切到 Redis。
- 任务状态查询和 artifact 查询互不干扰。
