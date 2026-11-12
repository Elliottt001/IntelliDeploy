import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import type { components } from '@intellideploy/api-client';
import { authAPI, phase1Api } from '../../services/api';
import { readDraft, saveDraft, clearDraft } from '../../services/workspaceStorage';
import WorkspacePage, { Action, workspaceStyles as styles } from '../../components/WorkspacePage';

type Order = components['schemas']['PaymentOrderInfo'];
const names = { alipay: '支付宝', wechat: '微信支付', stripe: 'Stripe' };

export default function BillingScreen() {
  const router = useRouter();
  const { appId } = useLocalSearchParams<{ appId?: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAccount>> | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setRevision(value => value + 1); });
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    const controller = new AbortController();
    loadAccount().then(async value => {
      if (!active) return;
      setData(value); setError(''); setOrder(null);
      const recent = await readDraft(`billing-order:${value.userId}`);
      if (recent?.content) {
        const result = await phase1Api.getOrder(recent.content, controller.signal);
        if (active) setOrder(result);
      }
    }).catch(exc => { if (active && !controller.signal.aborted) setError(exc.message ?? '无法读取额度或订单'); });
    return () => { active = false; controller.abort(); };
  }, [revision]));
  async function buy(sku: components['schemas']['QuotaSku']) {
    if (!data || busy) return;
    setBusy(true); setError('');
    const key = `billing-purchase:${data.userId}:${sku.id}`;
    try {
      const draft = await saveDraft(key, sku.id);
      const result = await phase1Api.createOrder(sku.id, sku.provider, draft.operationId);
      await saveDraft(`billing-order:${data.userId}`, result.order_id);
      await clearDraft(key, draft.operationId);
      setOrder(result);
    } catch (exc) { setError(exc instanceof Error ? exc.message : '无法创建订单'); }
    finally { setBusy(false); }
  }
  async function openPayment() {
    if (!order?.checkout_url || busy) return;
    setBusy(true); setError('');
    try { await Linking.openURL(order.checkout_url); }
    catch { setError('无法打开支付页面，请稍后重试'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setError('');
    try { await phase1Api.cancelSubscription(randomUUID()); setRevision(value => value + 1); }
    catch (exc) { setError(exc instanceof Error ? exc.message : '取消失败'); }
    finally { setBusy(false); }
  }
  return <WorkspacePage title="额度与用量">
    {Boolean(error) && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!data && !error && <Text style={styles.text}>正在读取额度…</Text>}
    {data && <>
      <View style={styles.card}><Text style={styles.title}>可用额度：{data.balance.available_units}</Text><Text style={styles.text}>执行预留：{data.balance.reserved_units}</Text><Text style={styles.muted}>{data.policy.failed_usage_rule}</Text>
        {data.subscription && <><Text style={styles.text}>当前套餐状态：{data.subscription.status}，到期时间：{data.subscription.period_end}</Text><Text style={styles.muted}>{data.subscription.provider === 'stripe' ? data.subscription.cancelled ? '已取消未来续订，已付额度保留。' : '自动订阅，可取消未来续订。' : '手动续费，到期后购买新的套餐订单。'}</Text>{!data.subscription.cancelled && <Action label="取消未来续订" disabled={busy} onPress={() => void cancel()} />}</>}
      </View>
      <View style={styles.card}><Text style={styles.title}>购买额度与套餐</Text>{!data.skus.length && <Text style={styles.muted}>暂无可购买商品。</Text>}{data.skus.map(sku => <View key={sku.id}><Text style={styles.text}>{sku.name} · {sku.currency} {(sku.amount_minor / 100).toFixed(2)} · {sku.units} 额度 · {names[sku.provider]}</Text><Text style={styles.muted}>{sku.period ? `${sku.period === 'YEAR' ? '年度' : '月度'}套餐，${sku.provider === 'stripe' ? '自动订阅' : '手动续费'}` : '购买额度，无到期时间'}</Text><Action label={'购买' + sku.name} testID={'buy-' + sku.id} disabled={busy} onPress={() => void buy(sku)} /></View>)}</View>
      <View style={styles.card}><Text style={styles.title}>用量记录</Text>{data.usage.items.length === 0 && <Text style={styles.muted}>暂无已结算用量。</Text>}{data.usage.items.map(item => <Text key={item.id} style={styles.text}>{item.kind} · {item.cost_units} 额度 · {item.created_at}</Text>)}</View>
      <View style={styles.card}><Text style={styles.title}>购买记录</Text>{!data.orders.length && <Text style={styles.muted}>暂无订单。</Text>}{data.orders.map(item => <Action key={item.order_id} label={item.name + ' · ' + (item.status === 'PAID' ? '已到账' : '待核对')} onPress={() => { void saveDraft(`billing-order:${data.userId}`, item.order_id).then(() => setRevision(value => value + 1)).catch(() => setError('订单未能保存，请重试')); }} />)}</View>
    </>}
    {order && <View style={styles.card}><Text style={styles.title}>最近订单：{order.name}</Text><Text style={styles.muted}>{order.order_id}</Text><Text testID="payment-state" style={styles.text}>{order.status === 'PAID' ? '支付已到账' : order.status === 'CREATED' ? '等待支付到账' : '订单已结束'}</Text>
      {!!order.refunded_amount_minor && <Text style={styles.muted}>已退款 {order.currency} {(order.refunded_amount_minor / 100).toFixed(2)}。{order.refund_review_required ? '已消费或预留额度需要平台核对。' : '对应未消费额度已回收。'}</Text>}
      {order.status === 'CREATED' && order.checkout_url && <><Text style={styles.muted}>在浏览器支付；返回后核对订单及额度，到账后由你选择恢复任务。</Text>{order.provider === 'wechat' && <Text style={styles.muted}>微信 Native 支付需要另一台设备扫码；浏览器支付页可使用同一平台账号登录。</Text>}<Action label="打开支付页面" testID="open-payment" disabled={busy} onPress={() => void openPayment()} /></>}
      <Action label="刷新支付状态" testID="refresh-payment" disabled={busy} onPress={() => setRevision(value => value + 1)} />
    </View>}
    <Action label="刷新额度" disabled={busy} onPress={() => setRevision(value => value + 1)} />
    {appId && /^[A-Za-z0-9_-]+$/.test(appId) && <Action label="返回应用并选择恢复" onPress={() => router.push({ pathname: '/app-detail/[id]', params: { id: appId } })} />}
  </WorkspacePage>;
}

async function loadAccount() {
  const [user, balance, policy, usage, subscription, skus, orders] = await Promise.all([authAPI.getMe(), phase1Api.getBalance(), phase1Api.getPolicy(), phase1Api.listUsage(), phase1Api.getSubscription(), phase1Api.listSkus(), phase1Api.listOrders()]);
  return { userId: user.data.id, balance, policy, usage, subscription, skus, orders };
}
