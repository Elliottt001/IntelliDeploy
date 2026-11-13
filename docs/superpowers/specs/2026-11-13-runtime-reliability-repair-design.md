# 真实试验后的交付可靠性修复设计

日期：2026-11-13。范围来自 `docs/algorithm/runtime-issues-2026-11-13.md` 的 RT-01–RT-08。用户已要求按该文档推进代码修复；在 main 由单 agent 顺序执行，不使用工作树或子代理。

## 目标与边界

先使同一句私人笔记需求稳定完成需求冻结，再修复可信边界、输出协议与检索开销，最后通过真实 API 检查交付。所有权限、原文引用、已冻结验收不可静默删除、预算、未知副作用和发布门禁保持有效。旧失败记录不覆盖，普通用户默认仍为 Baseline，局部回归不算真实交付通过。

使用 Python 3.13、现有 Pydantic/SQLAlchemy/PostgreSQL、Node.js 24 和 Linux AMD64 Runner。复用现有 Job.checkpoint、ResourceRecord、UnknownUsage 与模型账本，不增加数据库表或依赖；保存和恢复必须受现有 Worker 租约保护。社区内容 WIP 不纳入提交。

## 方案选择

推荐保留本次草稿与逐轮审阅证据的纠正流程。单纯增加重试/提示词无法防止丢失已经补齐的内容；自动合并任意模型草稿或清空全部遗漏标记会隐藏真正缺口。因此，纠正输入保留上一轮草稿，校验既有验收不丢失，历史遗漏只有经过当前审阅确认才能关闭。

## 需求纠正（RT-01、RT-02、RT-03）

`compile_requirement(messages, previous, model_client, *, persist=None)` 保持返回 RequirementDraft 的现有接口，增加可选持久快照回调。每轮输入是合法 JSON，包含原始消息、已冻结 previous、上一轮 current_draft、累计 review_history、当前 correction 和平台默认身份规则。previous 与 current_draft 含义分离。

本次第一份合法且无需追问的草稿建立修正基线。后续草稿保留该基线已有验收 ID、action、expected 与 private_data，需要加强要求时增加验收项；不静默丢失先前已加入的验收。已冻结 previous 的移除仍按现有原文证据规则检查。所有 facts 的 source_message_id、quote 与验收映射仍须核对原始用户消息。

必要 questions/unsupported 在独立审阅前返回，Worker 保存问题并进入 WAITING_USER；不能在纠正中自行抹去待答问题。提示明确默认接入平台身份，不让用户选择账号技术方案；真正影响业务的选择仍追问。用户补充消息改变输入源后开始新的整理阶段，已冻结需求继续受保护。

独立审阅返回 `missing`，并可返回 `resolved`：每项包含原样 issue、非空 acceptance_ids 与非空 evidence。关闭 draft.review_missing 只接受当前审阅中与其匹配、引用当前真实验收 ID 的 resolved 证据；未知 ID、空证据或与当前 missing 冲突均拒绝。不能因 missing=[] 就清空所有标记。历史反馈始终携带给审阅者核对；当前 unresolved、每轮草稿摘要与结果进入检查点。

三轮纠正上限不增加。恢复从已持久化模型响应重建相同纠正输入与请求 hash；有 REQUESTED/UNKNOWN 的请求不重放。检查点保存输入摘要、attempt、stage、当前草稿、审阅历史、最后错误和未关闭问题；不把完整草稿暴露到公共诊断。

## 失败诊断（RT-06）

RequirementInvalid 携带结构化的最终原因，用户错误为 REQUIREMENT_INVALID 与简明中文说明。授权开发者诊断增加可选 requirement_compilation 投影：阶段、尝试次数、最后错误类型和未解决问题，不返回完整草稿、原始模型 JSON 或配置秘密。旧检查点没有该字段时返回 None，客户端协议同步生成。错误仍发生在需求阶段，不伪造浏览器验收结果。

## 输出协议与未知模型用量（RT-04、RT-07）

无工具的规划/审阅调用默认使用 disabled thinking；带工具的实现保持 enabled thinking，并完整保留 reasoning_content。输出上限统一通过配置控制，产品默认提高到 8192，单任务调用上限仍为 40。新增规划 thinking 配置允许显式选择 enabled。实际请求选项进入持久请求 hash 与记录，预算上界与真实请求使用相同 max_tokens。

ModelTurn 增加可选 finish_reason、provider_request_id、protocol_error，兼容旧记录。DeepSeek 的 length、空最终输出或非法工具参数必须被准确分类；已收到的真实 token 用量先保存和计费，再向上游代码报告协议错误。已计费的错误重放只复用记录，不再次请求或扣费。网络无结果仍 UNKNOWN。

Worker 取消正在等待的模型请求时保存 UNKNOWN 与 UnknownUsage，再传播取消，不虚构用量。只读审计脚本列出未收敛请求；显式标记未知只改变其可核对状态，不填入猜测费用，不再次请求模型。旧试跑的一笔未知费用须保留待供应商核对状态；供应商逐请求账单不可用时如实记录未核对。

## Runner 边界（RT-05）

所有工具参数、路径和命令执行器就绪检查在 STARTED 前完成。无效参数返回脱敏 TOOL_ARGUMENTS_INVALID，执行器未配置返回 503，没有操作开始记录。已 STARTED 的未知副作用继续 409，正确已完成请求保持幂等重放。Worker 侧已有验证继续保留。

## 检索开销（RT-08）

单次检索内按规范仓库 URL 和已知 ref/commit 缓存补全结果，重复候选不重复获取文件；不同已知 commit 仍分别保留，冲突继续 PARTIAL，不把未知故障当空仓库。

路线模型接收全部候选的必要元数据、画像、评估和拒绝证据；原始关键文件在检索检查点完整保留，只在路线输入使用有摘要引用的片段。每候选路径列表至多200项，关键文件片段总字符上限16384，单文件片段至多4096，description至多1000；全部文件提供 SHA256 与长度，目录提供摘要与总数。LICENSE、README、依赖和运行入口按优先级分配片段。原始候选与评分不因压缩变化，验证固定 commit、许可证、核心覆盖等决策规则继续使用完整原始证据。

## 验证与关闭

每项先 RED，再最小实现和 GREEN，按交付单元提交。覆盖纠正丢项、旧遗漏有效关闭/无证据拒绝、必要追问、持久恢复/幂等计费、授权诊断、截断与非法响应计费、Runner 直接 RPC 和重复候选。公共 Schema 变动同步 API 客户端。

最终运行全量 Phase 1 回归和相关客户端测试。随后用原测试环境与原句串行提交真实 Baseline/Hybrid，不固定路线、不注入应用产物，验证 CRUD、刷新与重启持久化及双账号隔离。若再出现实际阻塞，保存证据并按根因处理；不能用本地通过或失败时间声明交付成功。四路线/两云的额外证据不足仍单列 NOT_RUN。

## 真实验收后的补充（同日）

第一对修复版任务均已冻结完整需求；Baseline 在20轮工具循环结束时仍写源码，没有提交运行清单。生成轮数改为 min(32, 当前任务剩余模型调用次数 - 6)，为验证预留6次，整体40次上限不变。Builder输入补充平台内置环境别名、独立数据库说明与必须通过finish_implementation提交的协议。

真实检索仍较慢，唯一仓库补全改为4并发，重复仓库只获取一次。必须按补全前的任务身份检查结果，防止客户端写入部分commit后又失败时被误判为完整。路线摘要针对已检索文本计算SHA256，不声称此前被检索器截断的文本是完整仓库文件。
