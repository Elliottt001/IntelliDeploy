# 运行时可靠性修复真实验收记录

日期：2026-11-13。范围：同一句私人笔记需求的真实 Baseline/Hybrid API 任务、真实 DeepSeek/GitHub、mTLS Runner、TLS Registry 和 Linux AMD64 测试节点。测试节点仅用于测试，不是生产环境。

## 输入与判定标准

两条路径使用同一句需求：

> 做一个私人笔记网站，登录后可以新增、修改、删除笔记，刷新页面和服务重启后内容仍在，不同账号互相看不到笔记。

只有任务 `SUCCEEDED`，并实际通过 CRUD、页面刷新、服务重启持久化和双账号读写隔离，才记录成功完成时间。FAILED 耗时不是完成时间；构建成功、manifest 提交或算法阶段成功都不能替代业务交付。

## 最终干净快照结果

控制器提交：`d8dab5d`。Runner digest：`sha256:000d0fbec7384bbf0e445dd759dfeb432b260d74f96dc43fa4be27c1a339a7e3`。BuildKit TLS Registry 独立构建/push 预检通过。

| 路径 | Job | 终态 | 到失败时间 | 最终错误 | 业务报告 |
| --- | --- | --- | ---: | --- | --- |
| Baseline | `1ea12775-a506-44af-8fe3-f87b78340502` | FAILED | 600.669 秒 | `plan path must be relative` | NOT_RUN |
| Hybrid | `a0222c82-c110-4454-ac77-784d15fb4e3f` | FAILED | 432.091 秒 | `plan path must be relative` | NOT_RUN |

结论：没有成功完成时间，不能比较 Hybrid 完成时间或收益，不能把普通用户默认模式切换为 Hybrid。

## 本轮已取得的真实阶段证据

- 多轮 Baseline/Hybrid 均在约 6–8 秒冻结完整需求，旧需求纠正 P0 已越过。
- Hybrid 的 QUERY_PLAN、RETRIEVAL、PROFILE、ROUTE、GAP、PACKAGING、COMPOSITION 均出现真实 SUCCEEDED；模型增强查询存在真实调用者。
- 源码生成、FINALIZE、manifest、BrowserCheck 规划、独立 review/security 和候选构建在不同尝试中实际到达。
- FINALIZE 中额外清理命令被拒绝且未执行；确认 NOT_STARTED 的写工具只重试一次；只读 snapshot 可有界重试。
- 构建失败触发过 repairing 并重新进入生成；精确构建/审查信息现写入私有修复上下文。
- BuildKit 之前误用 HTTP 推送 TLS Registry；修正配置后，同一真实候选的镜像构建和 push 成功。

## 仍未通过

- 最新共同 P0：包装计划或其上游仍产生绝对路径，触发 `PackagingPlan` 的相对路径门禁。不得通过允许绝对路径、`..` 或扩大组件写权限规避。
- 40 次总模型调用内，完整首次生成、精确修复和后置 BrowserCheck/review/security 尚未稳定闭环。
- Hybrid 算法子阶段完成后，外层 phase 仍可能长时间显示 retrieving；需要按操作 ID 拆分耗时。
- CRUD、刷新/重启持久化、删除不复活、双账号读写隔离和最终 Linux 发布仍为 NOT_RUN。
- 一笔历史模型请求继续显式 UNKNOWN；不重放、不当免费、不填造供应商费用。

## 验证与证据位置

- 本地：Phase 1 `536 passed / 4 skipped`；共享 API 客户端 9 项通过；OpenAPI/客户端生成和 TypeScript 构建通过。
- 私有原始记录：`/Users/bytedance/.config/intellideploy/paired-api-2026-11-13/reports/`；`attempt-10` 至 `attempt-14` 保留各轮失败，当前 `baseline.json`、`hybrid.json`、`pair.json` 为最终 pair。
- 问题状态与下一步：[runtime-issues-2026-11-13.md](runtime-issues-2026-11-13.md)。
