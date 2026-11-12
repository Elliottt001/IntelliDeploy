'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { ApiError, type components } from '@intellideploy/api-client';
import { api } from '../lib/api';

type S = components['schemas'];
const providerNames = { alipay: '支付宝', wechat: '微信支付', stripe: 'Stripe' };
const money = (currency: string, amount: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(amount / 100);
function returnPath() {
  const path = new URLSearchParams(window.location.search).get('return');
  return path && /^\/apps\/[A-Za-z0-9_-]+$/.test(path) ? path : '/apps';
}

export function BillingAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<{ userId: number; balance: S['QuotaBalance']; policy: S['QuotaPolicy']; usage: S['QuotaUsagePage']; skus: S['QuotaSku'][]; subscription: S['SubscriptionInfo'] | null; orders: S['PaymentOrderInfo'][] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [recent, setRecent] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([api.request<{ id: number }>('/api/auth/me'), api.getBalance(), api.getPolicy(), api.listUsage(), api.listSkus(), api.getSubscription(), api.listOrders()])
      .then(([user, balance, policy, usage, skus, subscription, orders]) => {
        if (!active) return;
        setAccount({ userId: user.id, balance, policy, usage, skus, subscription, orders }); setError('');
        setRecent(localStorage.getItem(`intellideploy:order:${user.id}`));
      }).catch(exc => {
        if (!active) return;
        if (exc instanceof ApiError && exc.status === 401) router.push('/login?next=' + encodeURIComponent('/billing' + window.location.search));
        else setError(exc instanceof Error ? exc.message : '无法读取额度');
      });
    const refresh = () => { if (document.visibilityState === 'visible') setRevision(value => value + 1); };
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, [revision, router]);
  async function buy(sku: S['QuotaSku']) {
    if (!account || busy) return;
    setBusy(true); setError('');
    const storage = `intellideploy:purchase:${account.userId}:${sku.id}`;
    try {
      const key = localStorage.getItem(storage) ?? crypto.randomUUID(); localStorage.setItem(storage, key);
      const order = await api.createOrder(sku.id, sku.provider, key);
      localStorage.setItem(`intellideploy:order:${account.userId}`, order.order_id);
      localStorage.removeItem(storage);
      router.push('/billing/orders/' + encodeURIComponent(order.order_id) + '?return=' + encodeURIComponent(returnPath()));
    } catch (exc) { setError(exc instanceof Error ? exc.message : '无法创建订单'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!account || busy) return;
    setBusy(true); setError('');
    try { await api.cancelSubscription(crypto.randomUUID()); setRevision(value => value + 1); }
    catch (exc) { setError(exc instanceof Error ? exc.message : '取消失败'); }
    finally { setBusy(false); }
  }
  return <><h1>额度与用量</h1>{error && <p role="alert" className="error">{error}</p>}{!account && !error && <p>正在读取额度…</p>}{account && <>
    <section><h2>可用额度：{account.balance.available_units}</h2><p>执行预留：{account.balance.reserved_units}</p><p>{account.policy.failed_usage_rule}</p>
      {account.subscription && <><p>套餐状态：{account.subscription.status} · 到期时间：{account.subscription.period_end}</p><p>{account.subscription.provider === 'stripe' ? account.subscription.cancelled ? '已取消未来续订，已付周期额度保留。' : '自动订阅，可取消未来续订。' : '手动续费，到期后购买新的套餐订单。'}</p>{!account.subscription.cancelled && <button disabled={busy} onClick={() => void cancel()}>取消未来续订</button>}</>}
    </section>
    <section><h2>购买额度与套餐</h2>{!account.skus.length && <p>暂无可购买商品。</p>}{account.skus.map(sku => <article key={sku.id}><h3>{sku.name}</h3><p>{money(sku.currency, sku.amount_minor)} · {sku.units} 额度 · {providerNames[sku.provider]}</p><p>{sku.period ? `${sku.period === 'YEAR' ? '年度' : '月度'}套餐，${sku.provider === 'stripe' ? '自动订阅' : '手动续费'}` : '购买额度，无到期时间'}</p><button disabled={busy} onClick={() => void buy(sku)}>购买{sku.name}</button></article>)}</section>
    <section><h2>用量记录</h2>{account.usage.items.length ? account.usage.items.map(item => <p key={item.id}>{item.kind} · {item.cost_units} 额度 · {item.created_at}</p>) : <p>暂无已结算用量。</p>}</section>
    {recent && <Link href={'/billing/orders/' + encodeURIComponent(recent)}>查看最近订单</Link>}
    <section><h2>购买记录</h2>{account.orders.length ? account.orders.map(order => <p key={order.order_id}><Link href={'/billing/orders/' + encodeURIComponent(order.order_id)}>{order.name} · {money(order.currency, order.amount_minor)} · {order.status === 'PAID' ? '已到账' : order.status === 'CREATED' ? '待核对' : '已结束'}</Link></p>) : <p>暂无订单。</p>}</section>
  </>}<button disabled={busy} onClick={() => setRevision(value => value + 1)}>刷新额度</button><p><Link href="/apps">返回我的应用，选择恢复任务或运行实例</Link></p></>;
}

export function BillingOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<S['PaymentOrderInfo'] | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [revision, setRevision] = useState(0);
  const [back, setBack] = useState('/apps');
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    setBack(returnPath());
    async function read() {
      try {
        if (document.visibilityState !== 'visible') return;
        const result = await api.getOrder(orderId, controller.signal);
        if (controller.signal.aborted) return;
        setOrder(result); setError('');
        if (result.status === 'CREATED' && Date.parse(result.expires_at) > Date.now()) timer = setTimeout(() => void read(), 3000);
      } catch (exc) {
        if (controller.signal.aborted) return;
        if (exc instanceof ApiError && exc.status === 401) router.push('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
        else setError(exc instanceof Error ? exc.message : '支付状态暂时无法读取');
      }
    }
    void read();
    const visible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); setRevision(value => value + 1); } };
    document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [orderId, revision, router]);
  useEffect(() => {
    let active = true;
    setQr('');
    if (order?.checkout_kind === 'QR' && order.payment_url && order.status === 'CREATED') QRCode.toDataURL(order.payment_url, { width: 256, margin: 2 }).then(value => { if (active) setQr(value); }).catch(() => { if (active) setError('二维码无法显示，请刷新重试'); });
    return () => { active = false; };
  }, [order?.payment_url, order?.checkout_kind, order?.status]);
  return <><h1>支付订单</h1>{error && <p role="alert" className="error">{error}</p>}{!order && !error && <p>正在核对订单…</p>}{order && <section><h2>{order.name}</h2><p>订单：{order.order_id}</p><p>{money(order.currency, order.amount_minor)} · {order.units} 额度 · {providerNames[order.provider]}</p>
    <p aria-live="polite">{order.status === 'PAID' ? '支付已到账' : order.status === 'CREATED' ? '等待支付到账' : '订单已结束'}</p>
    {!!order.refunded_amount_minor && <p>已退款 {money(order.currency, order.refunded_amount_minor)}。{order.refund_review_required ? '已消费或预留额度需要平台核对。' : '对应未消费额度已回收。'}</p>}
    {order.status === 'CREATED' && Date.parse(order.expires_at) > Date.now() && <>
      {qr && <img src={qr} width="256" height="256" alt="支付二维码" />}
      {order.provider === 'wechat' && <p>请使用另一台设备扫码；微信 Native 支付不支持扫描手机自己的屏幕。</p>}
      {order.payment_url && order.provider !== 'wechat' && <a href={order.payment_url} rel="noreferrer" target="_blank">前往{providerNames[order.provider]}支付</a>}
      <p>支付后刷新订单核对到账，关闭支付页面不会自动充值。</p>
    </>}
    {order.status === 'CREATED' && Date.parse(order.expires_at) <= Date.now() && <p>付款入口已到期，请核对是否到账后再创建新订单。</p>}
    <p><button onClick={() => setRevision(value => value + 1)}>刷新支付状态</button></p>
  </section>}<p><Link href="/billing">返回额度与用量</Link></p><p><Link href={back}>返回应用，选择恢复任务或运行实例</Link></p></>;
}
