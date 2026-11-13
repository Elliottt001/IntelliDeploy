# 复用优先的仓库选择与交付设计

日期：2026-11-13。状态：用户已确认产品决策；本文与配套实施计划是本次文档交付，产品代码尚未修改。

## 1. 目标与已确认决策

IntelliDeploy 首先帮助用户找到并使用现成软件。代码修改用于补必要缺口，从头生成是用户明确接受后的最后选择。

1. 找到满足需求的官方在线服务时，默认交付可用链接。用户要求自托管、独立部署或平台管理时，才部署独立实例。
2. 仓库满足核心用途、剩余差异较小时，允许直接使用或部署，不为界面、按钮名称、额外功能等非关键差异修改代码。
3. 优先沿用官方镜像、Compose、部署脚本和安装说明。缺 Dockerfile 不等于缺业务能力。
4. 不满足 A（直接部署）不等于不值得 B（局部改造）或 C（组件组合）。未知能力不能等同于明确缺失。
5. 默认不自动进入 D。只有用户明确接受从头生成，才允许 GENERATE_APP；未确认合适仓库时返回候选和缺口，可继续搜索或询问用户。

核心验收保持不变：私人数据的持久性、权限隔离、用户明确指定的必要功能不能通过加权平均或“小偏差”放过。用户明确要求的界面、技术栈、登录方式也不能擅自降为可选。

## 2. 当前证据与问题

最终真实 Baseline/Hybrid 均返回19个候选，但最终 sources=[]，选择 GENERATE_APP。检索候选含相关笔记项目，也含书籍列表等无关项目；检索操作完成不证明已充分寻找合适方案。

`ranking._coverage()` 用验收文本关键词与少量画像标签比对；未匹配记 missing_core，随后提高 change_cost。当前 eligible_a 排除全部 unknown_fields；`routing.validate_route_plan()` 又可把 missing/unknown 用作 D 拒绝证据，未单独证明 B/C 不可行。Gap 规划在 provisional.sources 为空时直接返回确定性规划，不能救回已被前一步放弃的主体。

`DeliveryResult` 强制 version_id/instance_id/artifact_url，`finish_job()` 强制运行中的平台实例；两客户端打开应用必先申请平台登录 code。外部链接不能伪造实例、源码版本或交付门禁来接入。

最后两次 `plan path must be relative` 的确切待执行工具是写临时测试文件：Baseline 使用 `../tmp/notes-harness/harness.mjs`，Hybrid 使用 `/workspace/.tmp-test/...`。不能继续把它当成已确认的 Dockerfile 包装计划故障。该恢复问题属于独立运行时修复，本设计聚焦此前的复用选择与交付。

## 3. 需求与交付约束

Requirement 增加 `delivery_policy`：`preference=EXISTING_SERVICE_FIRST|SELF_HOSTED`（默认前者）、`allow_generation=false`。显式从零生成请求令 allow_generation=true；明确自托管、独立部署或平台管理令 preference=SELF_HOSTED。模型必须引用原消息事实，不能仅由“做一个网站”推断从头生成，也不能覆盖用户显式策略。

AcceptanceItem 增加 `importance=CORE|PREFERENCE`，旧记录默认 CORE。核心功能和数据/权限要求属于 CORE。偏好只能由原文和已确认默认支持；必要追问不能被推断替代。业务登录通常允许应用自带账号体系；平台统一登录只对要求平台接入的托管路径适用，不要求外部官方服务实现平台 SSO。

不同账号隔离、刷新/重启保存不能降级。颜色、布局、非指定按钮文案、仓库额外功能可记录为 difference，既不伪报“完全一致”，也不阻塞满足核心用途的交付。

## 4. 候选与能力证据

扩展 RepositoryProfile，保留现有技术画像，并增加 DeploymentAsset：kind=OFFICIAL_SERVICE|DEMO|IMAGE|COMPOSE|SCRIPT|INSTALL_DOC，location、source_ref、source_digest、verification_status。URL 来源必须引用当前固定 commit 的 README/配置或可核对的官方链接；徽章、截图、文档站和一键部署按钮不自动成为运行中的服务。

新增 CandidateAssessment：repo_url、commit、requirement_revision、capabilities、differences、adaptations、route_verdicts。每项能力具有 acceptance_id、status=SUPPORTED|MISSING|UNKNOWN、evidence_refs、reason。引用绑定实际读取的文件内容/摘要；不能编造 coverage:A1 或把路径存在当成行为已实现。

画像关键词用于初筛，不直接裁定业务缺失。按类别相关性选择前5个候选做深度读取，必要时读取对应认证、CRUD、数据模型和部署文件；同任务最多2轮搜索扩展。明确不相关候选保留拒绝理由，无需付费深入检查。读取不完整或未知核心能力阻止“已验证交付”，但不能作为 B/C 不可行或允许 D 的证据。

模型只提出语义评估，确定性校验负责版本绑定、验收ID、引用真实性和重要性不被改写。源码证据支持规划，不替代运行验收。所有模型调用复用 DurableModel，总上限40；多候选评估可批量完成，剩余额度不足时返回未确认结果，不启动无界重试。

## 5. 分开判断使用方式和代码路线

ReuseDecision：delivery_kind=EXTERNAL_LINK|HOSTED_INSTANCE，route 为现有A/B/C/D之一或空（只有 EXTERNAL_LINK/无解结果允许空），assessment_refs、selected_sources、deployment_asset、differences、adaptations。

| 条件 | 决策 |
| --- | --- |
| 用户接受外部服务，官方服务核心用途已核实 | EXTERNAL_LINK；不伪称平台A部署 |
| 用户要求独立实例，单仓库核心业务有证据，配置即可运行 | A；优先官方镜像/Compose/脚本 |
| 有合理主体，明确缺口可局部补齐 | B；保留已满足业务，只列必要改动 |
| 主体与其他来源能组成完整方案，证据、接口、成本可核对 | C；沿用既有组件合同和只读来源保护 |
| 核心证据不足 | 深读/扩大搜索；额度耗尽则给出未确认候选 |
| 所有合理复用方案被分别否决 | 返回候选和拒绝说明；allow_generation=true 时才可D |

A verdict 与 B/C verdict 独立。缺官方镜像、缺平台 SSO、少锁文件、未确认端口等分别影响部署准备，不自动表示业务缺失。成本来自明确文件/功能改动与环境依赖；不能仅由关键词匹配率反推“几乎重写”。

优先级是满足核心用途、用户交付偏好、改造范围、部署成本；Stars仅作辅助。适当小偏差允许直接交付，不设置一个可以覆盖权限/持久性缺口的万能总分阈值。

## 6. 官方部署执行

新增 DeploymentPlan：kind=IMAGE|COMPOSE|SCRIPT|SOURCE_BUILD、source_ref、digest、required_configuration、persistent_resources、health_check、adaptations。按仓库实际材料选择，不强制改为 Next.js，不把所有A都转入 Builder。

官方镜像解析并固定digest后启动；Compose保留服务/网络/卷关系，秘密使用平台文件引用，不覆盖用户数据；部署脚本先检查依赖、网络、写目录及特权，再在Runner执行。需要宿主root、不受控Docker socket或未支持云凭据的脚本标 UNSUPPORTED，转其他部署方式或提示缺口，不在控制面直接执行。缺部署材料才生成配置；业务不缺时不进入源码改造。

平台实例仍经过真实运行、业务、数据与发布验证。平台管理路径明确平台身份适配；单纯自托管可保留原账号体系，并生成相应验证登录流程。身份差异必须进入adaptations，不能要求用户在未说明的情况下替换整套身份系统。

## 7. 外部链接交付

新增 ExternalLinkDelivery，与现有DeliveryResult形成按kind区分的DeliveryOutcome。现有托管结果默认kind=HOSTED_INSTANCE以兼容旧记录；外部结果kind=EXTERNAL_LINK，包含app_id、job_id、url、repo_url、source_ref、summary、features、differences、verified_at、verification_refs。无instance_id、version_id和artifact_url，不编造托管实体。

使用现有ResourceRecord登记type=EXTERNAL_LINK，job/app归属、operation_id、验证元数据和原始来源绑定；结果与SUCCEEDED在同事务内提交。app_detail为外部应用展示最近有效链接交付；外部记录不进入托管资源计费、实例启停、源码复制/社区托管发布或迁移。继续对话可重新推荐，明确要求独立部署则创建托管任务，保留历史链接记录。

验证必须区分服务可达和核心用途可用：检查URL/重定向目的地、官方来源、服务类型、注册/使用入口和与核心要求对应的证据。外部URL使用受控fetch/浏览器，沿用SSRF与同源凭据规则；不能向第三方发送平台token、登录code或真实私人数据。注册或付费墙、核心功能未知时返回推荐/WAITING_USER，不能只凭HTTP200标SUCCEEDED。演示、共享账号、会清空数据的体验站不能作为私人笔记交付。

第三方重启持久性可依据可核对的官方功能说明并明确证据级别，不能伪称执行过服务器重启测试；若用户明确要求实际重启验证，选择可控制的独立实例。第三方服务可用性不由平台保证，显示简短来源和差异即可，不增加无关警告流程。

Web/Expo的外部链接直接打开，不申请平台login code；托管结果维持原实例路径。报告区分外部链接交付、平台部署成功、演示推荐；统计器不得用链接成功填补四路线部署、重启恢复或Hybrid自托管成功率。

## 8. 实施与验收

阶段一先修Requirement策略、能力证据和独立A/B/C判定，以真实候选人工核对证明不再过早D。阶段二补官方入口和部署执行；阶段三接外部链接持久化/API/两客户端及分类统计；阶段四做真实使用、官方部署与局部改造验收。

必测：已有笔记业务但缺平台SSO的候选仍可B；核心满足但界面不同可A/链接；未知隔离不伪报缺失或PASS；官方Compose优先于生成Dockerfile；无适合候选且未授权生成时模型从未进入D；官方演示不算私人笔记服务；外部打开不申请平台code；自托管仍执行真实CRUD/持久性/隔离；旧托管记录兼容。

执行约束：main、单agent顺序；保留社区/移动端WIP；本轮不部署、不调用付费模型。实施时逐项RED→GREEN、范围独立提交；真实验证使用受控目标和授权凭据，不把fixture或源码评分当交付PASS。普通用户算法默认模式仍维持Baseline，直到真实配对结果证明Hybrid可默认使用。
