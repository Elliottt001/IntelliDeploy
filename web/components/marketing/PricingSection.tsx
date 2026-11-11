import type { components } from '@intellideploy/api-client';
import Link from 'next/link';
import type { LoadState } from '@/lib/marketing-data';
import { formatMinorAmount } from '@/lib/money';
import styles from './marketing.module.css';

type QuotaSku = components['schemas']['QuotaSku'];
const providers: Record<QuotaSku['provider'], string> = { alipay: '支付宝', wechat: '微信支付', stripe: 'Stripe' };
const periodLabel = (period: string | null | undefined) => period === 'MONTH' ? '每月额度' : period === 'YEAR' ? '每年额度' : period || '单次额度包';

export default function PricingSection({ state }: { state: LoadState<QuotaSku[]> }) {
  return <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
    <div className={styles.pricingHeading}><p className={styles.eyebrow}>PRICING / REAL CATALOG</p><h2 id="pricing-title">选择与你当前需求相匹配的额度</h2><p>金额、币种、渠道与额度均来自服务端公开 SKU。购买和入账仍由后续安全支付流程完成。</p></div>
    {state.status === 'error' ? <div className={styles.stateCard}><p role="status">套餐信息暂时无法加载。</p></div>
      : state.data.length === 0 ? <div className={styles.stateCard}><p>套餐暂未发布。</p></div>
        : <div className={styles.pricingGrid}>{state.data.map((sku, index) => <article key={sku.id}>
          <div className={styles.priceTop}><span>{String(index + 1).padStart(2, '0')}</span><span>{providers[sku.provider]}</span></div>
          <h3>{sku.name}</h3><p className={styles.price}>{formatMinorAmount(sku.currency, sku.amount_minor)}</p>
          <dl><div><dt>额度</dt><dd>{new Intl.NumberFormat('zh-CN').format(sku.units)}</dd></div><div><dt>类型</dt><dd>{periodLabel(sku.period)}</dd></div><div><dt>币种</dt><dd>{sku.currency}</dd></div></dl>
        </article>)}</div>}
    <Link className={styles.pricingCta} href="/login?next=%2Fcreate">登录后管理额度 <span aria-hidden="true">↗</span></Link>
  </section>;
}
