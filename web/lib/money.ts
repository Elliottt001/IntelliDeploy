export function formatMinorAmount(currency: 'CNY' | 'USD', amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new RangeError('amount_minor must be a non-negative safe integer');
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountMinor / 100);
}
