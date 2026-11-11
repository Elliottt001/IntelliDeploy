import styles from './marketing.module.css';

const steps = [
  ['整理需求', '保存用途、数据、权限和可观察验收结果。'],
  ['选择路径', '优先评估可复用应用，再决定部署、改造、整合或生成。'],
  ['验证交付', '运行接口和页面检查，保存 PASS、FAIL 或 NOT_RUN 证据。'],
  ['继续调整', '新版本验证成功后发布；失败不替换当前可用版本。'],
] as const;

export default function DeliveryFlow() {
  return <section className={styles.delivery} aria-labelledby="delivery-title">
    <div className={styles.deliveryIntro}><p className={styles.eyebrow}>DELIVERY / VERIFIED</p><h2 id="delivery-title">从一句需求，到一条可追溯的交付链路</h2><p>每一步都留下真实状态与证据。视觉进度不会代替后端任务结果。</p></div>
    <ol className={styles.deliveryGrid}>{steps.map(([title, description], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
  </section>;
}
