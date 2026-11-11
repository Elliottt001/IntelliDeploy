import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { formatMinorAmount } from '../lib/money';
import PricingSection from '../components/marketing/PricingSection';

test('formats supported integer minor units without inventing discounts', () => {
  expect(formatMinorAmount('CNY', 9900)).toContain('99.00');
  expect(formatMinorAmount('USD', 1900)).toContain('19.00');
  expect(() => formatMinorAmount('CNY', -1)).toThrow(RangeError);
});

test('pricing renders empty and error truthfully', () => {
  expect(renderToStaticMarkup(<PricingSection state={{ status: 'ready', data: [] }} />)).toContain('套餐暂未发布');
  expect(renderToStaticMarkup(<PricingSection state={{ status: 'error' }} />)).toContain('套餐信息暂时无法加载');
});
