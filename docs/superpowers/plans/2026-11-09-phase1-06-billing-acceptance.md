# Phase 1 Billing and Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立免费、套餐和购买额度，接入支付宝、微信支付与 Stripe，并完成迁移及一期真实总验收。

**Architecture:** 三种收款渠道共用订单、签名校验、金额核对、幂等支付入账和额度账本。先完成额度/套餐/用量，再接各支付渠道；其他子系统调用同一账本。

**Tech Stack:** PostgreSQL、SQLAlchemy、httpx、cryptography、Stripe 官方 SDK、pytest、Playwright。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口](2026-11-09-phase1-00-roadmap.md)。用户补充确认国内和国际渠道都支持，并先建立额度和套餐。

## Global Constraints

- “免费、订阅和购买额度以具有来源、有效期和余额的 grants 记录。”
- “账本追加记录，使用操作 ID 防止重复；返还通过反向记录实现。”
- “补足额度后由用户选择继续。”
- 遵守总计划；支付回调来自供应商真实签名，不能通过客户端 success 页面直接发放额度。

### Task 06-F1: 额度、价格与用量账本

**Files:** Create backend/app/billing/{__init__,models,pricing,ledger,router}.py、backend/alembic/versions/0004_billing.py、tests/phase1/test_ledger.py。Modify backend/app/main.py、backend/app/jobs/worker.py。

**Interfaces:** reserve(session, payer_id, operation_id, max_units) -> Reservation；record_usage(session, usage: UsageInput) -> UsageEntry；settle(session, operation_id)；refund(session, operation_id, units, reason)；grant(session, payer_id, grant_key, units, source, expires_at)。resolve_price(kind, version) -> (numerator, denominator)，未配置拒绝收费执行。

本任务仅依赖 01，可先于生成模块实施。平台额度用整数最小单位；价格按有版本的整数比例计算，CNY/USD 支付金额单独保存，不用浮点金额或即时汇率改变已下单价格。

- [ ] **Step 1: 写并发预算与重复计费检查。** 使用真实 PostgreSQL；两个独立连接同时预留，账户只剩 100 单位。

```python
def test_same_usage_is_recorded_once(ledger_context):
    usage = UsageInput(operation_id='model-job-1-input', payer_id=ledger_context.owner,
                       kind='model.flash.input', units=100, price_version='test-v1')
    one = record_usage(ledger_context.session, usage)
    two = record_usage(ledger_context.session, usage)
    assert one.id == two.id

def test_reservation_cannot_overdraw(ledger_context):
    reserve(ledger_context.session, ledger_context.owner, 'job-a', 80)
    with pytest.raises(InsufficientQuota):
        reserve(ledger_context.session, ledger_context.owner, 'job-b', 80)
```

- [ ] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_ledger.py -q`。
- [ ] **Step 3: 实现事务与周期额度。** QuotaGrant 保存来源、到期和余额；Reservation 保存各 grant 分配；UsageEntry 对 operation_id 唯一。预留锁定可用 grant，优先最早到期，购买永久额度排后；结算只消耗实际用量并释放余量；退款追加反向记录。

```python
cost = (usage.units * price.numerator + price.denominator - 1) // price.denominator
existing = session.query(UsageEntry).filter_by(operation_id=usage.operation_id).first()
if existing:
    return existing
```

使用唯一约束处理并发插入，不能只有上述先查询。免费和套餐每个周期用唯一 grant_key 发放；过期额度不可继续预留，已预留按原规则结算。用量按模型输入/缓存输入/输出、搜索成功请求、构建以及分配的 CPU/内存/存储分钟分别记录。运行计量使用实例资源记录和目标状态，停止应用不再计运行资源，保留存储仍按存储配置计量；实例托管余额不足时停止运行并保留数据，补足后用户选择恢复。

Job 和 capability 调用都走本账本；错误或不确定上游用量记录待核对，不生成假的 0 费用。公开页和交付页显示可理解的剩余额度及用量项目。

- [ ] **Step 4: 绿测。** 加入并发预留、过期额度、周期只发一次、缓存输入不重复计价、退款幂等、暂停保留检查点和停止后保留数据的检查。
- [ ] **Step 5: 提交。** `feat: add quota reservations and idempotent usage ledger`。

### Task 06-F2: 国内订单、支付宝和微信支付

**Files:** Create backend/app/billing/orders.py、backend/app/billing/alipay.py、backend/app/billing/wechat.py、tests/phase1/test_domestic_payments.py。Modify backend/app/billing/models.py、backend/app/billing/router.py、backend/app/config.py、backend/alembic/versions/0005_payments.py、backend/requirements.txt。

**Interfaces:** create_order(session, user_id, sku_id, provider, operation_id) -> PaymentOrder；apply_payment(session, event: PaymentEvent) -> PaymentOrder。PaymentEvent 在 core/types.py 定义：provider、event_id、order_id、transaction_id、amount_minor、currency、paid_at、grant_key。PaymentOrder 保存用户、SKU 快照、币种、整数金额、授予额度及套餐周期，状态 CREATED/PAID/CANCELLED/FAILED。

支付宝/微信先实现单次购买及周期套餐订单；续期使用新订单和新的周期 grant_key，未授权免密扣款不自动扣款。API、订单和前端区分购买额度与订阅周期，不能把无限额度当付费套餐。

- [ ] **Step 1: 写签名、金额和重复回调检查。** 用测试 RSA Key 签名，不访问商户真实 Key；微信 fixture 按真实 AES-GCM resource 格式加密。

```python
def test_amount_mismatch_never_grants_credits(payment_context):
    event = PaymentEvent(provider='alipay', event_id='notice-1',
        order_id=payment_context.order.id, transaction_id='trade-1',
        amount_minor=1, currency='CNY', paid_at=datetime.now(timezone.utc), grant_key='paid-order')
    with pytest.raises(PaymentMismatch):
        apply_payment(payment_context.session, event)
    assert payment_context.new_grants() == []

def test_invalid_signature_rejected(domestic_callback):
    assert domestic_callback('alipay', signature='invalid').status_code == 400
```

- [ ] **Step 2: 红测。** test_domestic_payments.py。
- [ ] **Step 3: 实现真实订单接口和通知。** 支付宝接 alipay.trade.precreate，生成扫码 URL；验证 RSA2 签名、app_id、seller_id、订单和 Decimal 转换后的整数分金额。仅 TRADE_SUCCESS/TRADE_FINISHED 入账。微信 Native v3 生成 code_url，验证通知头的签名、时间和平台证书序列，再用 APIv3 Key 解密 resource，核对商户、appid、trade_state、金额和 out_trade_no。

```python
public_key.verify(base64.b64decode(signature), signed_payload,
                  padding.PKCS1v15(), hashes.SHA256())
resource = AESGCM(api_v3_key).decrypt(nonce, ciphertext, associated_data)
```

签名原文按渠道规范原样保存/验证，支付宝移除 sign/sign_type 后按规则构造；微信对 timestamp、nonce、原始 body 的规范原文验证，不先重编码 JSON。调用供应商时签名和商户凭据由本模块持有。两个渠道共用 apply_payment：事务内锁订单、核对币种/金额/所属渠道、标 PAID、以 order/grant_key 唯一发额度；支付通知返回确认前必须提交事务。

同一事件或不同 event_id 的同一 transaction_id 都不得重复发额度。订单失效/取消/退款保存审计；已消费额度不能直接删除账本，退款通过明确的回收或返还记录。支付页展示服务端生成的价格、额度和周期。

- [ ] **Step 4: 绿测与渠道验收。** 正确签名成功、无效/过期签名失败、币种或金额错不入账、重复通知只发一次、支付结果页刷新不发额度。真实渠道用配置好的商户测试流程验收扫码、通知和订单查询；若商户条件未就绪，该渠道保留未执行状态。
- [ ] **Step 5: 提交。** `feat: add Alipay and WeChat quota purchases`。

### Task 06-F3: Stripe 与套餐周期

**Files:** Create backend/app/billing/stripe_payments.py、tests/phase1/test_stripe_payments.py、frontend/app/billing/page.tsx。Modify backend/app/billing/router.py、backend/app/config.py、frontend/lib/api.ts、backend/requirements.txt。

**Interfaces:** create_stripe_checkout(order: PaymentOrder, recurring: bool) -> str；handle_stripe_event(raw_body: bytes, signature: str) -> PaymentEvent|None。Checkout 与 webhook 连接同一 apply_payment；收费 SKU 存 Stripe price_id 与周期配置。

- [ ] **Step 1: 写签名和周期幂等检查。** Stripe test fixture 用 webhook secret 与原始 JSON body 生成签名；测试金额不连接真实支付。

```python
def test_subscription_invoice_grants_cycle_once(stripe_context):
    event = stripe_context.signed_invoice_paid('invoice-1', 'cycle-1')
    stripe_context.deliver(event)
    stripe_context.deliver(event)
    assert stripe_context.grants_for('cycle-1') == 1

def test_browser_success_page_cannot_grant(stripe_context):
    stripe_context.visit_success_page()
    assert stripe_context.new_grants() == []
```

- [ ] **Step 2: 红测。** test_stripe_payments.py。
- [ ] **Step 3: 使用官方 SDK 的 Checkout 和 webhook 校验。** 购买额度用 payment mode，订阅 SKU 用 subscription mode；操作 ID 作为请求幂等键，metadata 只引用服务端订单。校验 checkout/payment 成功状态、customer、币种、金额和 SKU；周期 invoice.paid 使用 invoice ID 和周期唯一 grant_key。取消订阅不提前清空已支付周期额度。

```python
event = stripe.Webhook.construct_event(raw_body, signature, webhook_secret)
if event['type'] == 'invoice.paid':
    payment = normalize_paid_invoice(event['data']['object'])
    apply_payment(session, payment)
```

normalize_paid_invoice 在本模块定义，从服务端订阅记录定位 owner/SKU，不信任客户端 metadata 任意额度。Webhook 延迟或乱序先查询当前供应商对象核对状态再入账；已处理 invoice/transaction 唯一。回调 endpoint 在验证前不要求平台用户登录；其他订单和账单 API 校验用户归属。

前端显示免费、订阅和购买额度，按当前币种和配置展示三渠道入口。不要把支付成功页当回调，不把 Stripe secret 或商户私钥发送前端。暂停任务和托管实例提供明确恢复按钮。

- [ ] **Step 4: 绿测和 Stripe test mode。** 支付、订阅续期、取消、重复/乱序通知、金额错误和 webhook 签名检查；真实 test mode checkout + webhook 后确认账本及周期额度。生产开通条件单独记录，不把 test mode 声称为生产收款已完成。
- [ ] **Step 5: 提交。** `feat: support Stripe checkout and subscription cycles`。

### Task 06-F4: 旧数据审计、入口切换与真实总验收

**Files:** Create scripts/audit_legacy_state.py、scripts/migrate_legacy_users.py、scripts/run_phase1_acceptance.py、tests/phase1/test_legacy_migration.py、tests/phase1/cases/acceptance.json、frontend/e2e/phase1.spec.ts。Modify README.md、CLAUDE.md、.gitignore、backend/app/main.py、backend/requirements.txt、.github/workflows/phase1-ci.yml。

**Interfaces:** audit_legacy(path: Path) -> dict；migrate_users(source_snapshot, target_session) -> dict；run_case(case: dict, api_url: str) -> dict。验收报告保存 route、source commits、time、actual usage、validation、deployment target、URL和结果。

- [ ] **Step 1: 写迁移与无假成功检查。** 创建临时旧 SQLite schema（缺部署列），导入四个测试 User 并保存密码哈希；新库验证同密码可登录，不输出哈希。

```python
def test_legacy_users_import_is_idempotent(legacy_snapshot, pg_session):
    one = migrate_users(legacy_snapshot, pg_session)
    two = migrate_users(legacy_snapshot, pg_session)
    assert one['created'] == 4
    assert two['created'] == 0

def test_missing_cloud_does_not_create_fake_success(acceptance_context):
    result = acceptance_context.run_without_deploy_target()
    assert result['job_status'] != 'SUCCEEDED'
    assert result.get('url') is None
```

- [ ] **Step 2: 红测。** test_legacy_migration.py、frontend/e2e/phase1.spec.ts。
- [ ] **Step 3: 审计、迁移和退休旧入口。** audit 只读旧库，输出表数量、schema 差异与可迁移项。当前旧库有 4 个用户、无项目/部署；实施前重新核对。停止旧写入后通过 SQLite backup 建一致性快照，再迁移 User 和原 ID/哈希，权限受限，不打印秘密。若发现非空旧项目/部署则报告实际内容并停止该迁移分支，不删除源数据；补充映射后再继续。

```python
source = sqlite3.connect(f'file:{source_path}?mode=ro', uri=True)
with sqlite3.connect(snapshot_path) as snapshot:
    source.backup(snapshot)
```

对已存在目标 ID/用户名不一致的用户明确报冲突，不覆盖；每批事务可回滚。完成迁移及新验收后从 main.py 删除旧 RAG/NL/fallback/multi-agent 路由挂载，删除未被调用的 LangGraph 编排依赖；Redis 客户端包只有在旧 GitHub token 池等引用迁移完成后才能移除，不启动额外 Redis 服务。旧实验文件和历史测试分类记录，不用删掉失败测试伪造回归通过；对仍复用的 GitHub/构建/K8s/校验模块运行其有效旧测试并修正实际失败。

验收 JSON 每个 case 给 prompt、期望路线、核心行为、部署目标和用户身份；固定来源版本。至少四条实现路径、两云目标、多人权限、继续调整、共享/副本、预算暂停、Worker 中断恢复、支付重复回调均有实际记录。

```json
{"id":"dream-modify","route":"MODIFY_EXISTING",
 "prompt":"在日记应用加入梦境分析，保存分析历史，只允许本人读取",
 "checks":["save_record","ai_analysis","history_persists","other_user_denied"],
 "target":"linux"}
```

run_phase1_acceptance 逐 case 通过真实 API 创建/调整，轮询持久 Job 到终态并收集报告；缺目标或模型配置返回 NOT_RUN，不伪造 URL。四条路线需要各有真实 DeepSeek 执行，其中至少一例从真实公开仓库改造/部署；组件整合验证跨来源功能打通。数据重启、版本调整和独立副本通过实际操作验证。

README 更新 Python/Node、迁移、API/Worker/Web 三进程、配置和验收命令；CLAUDE.md 更新新入口与历史说明。CI 用 PostgreSQL service 跑 phase1 测试，前端 typecheck/build；真实模型/云/支付测试由有配置的受控环境运行，报告注明环境。

- [ ] **Step 4: 绿测与完整检查。** `.venv/bin/python -m pytest tests/phase1 -q`；`npm --prefix frontend run typecheck`；`npm --prefix frontend run build`；`npm --prefix frontend run test:e2e`。再运行 `scripts/run_phase1_acceptance.py`，确认真实 case 全部 PASS，不能以默认跳过掩盖缺渠道/目标。
- [ ] **Step 5: 提交。** `feat: cut over phase one and verify real delivery`。仅真实模型、两种部署和三支付渠道验收完成后对外声明一期全部支持。

## 商业上线所需配置

支付宝 app_id/商户/签名 Key、微信 appid/mchid/APIv3 Key/平台证书、Stripe secret/webhook secret/price_id、通知可达域名、实际价格和套餐周期。先实现额度再接收款是施工顺序；用户选择的三个渠道都属于一期验收范围。
