import { expect, test } from 'vitest';
import { safeNext } from '../lib/navigation';

test('safeNext accepts only approved product routes', () => {
  expect(safeNext('/create')).toBe('/create');
  expect(safeNext('/apps/app-1')).toBe('/apps/app-1');
  expect(safeNext('/community/public-1?from=home')).toBe('/community/public-1?from=home');
  expect(safeNext('//evil.test')).toBe('/apps');
  expect(safeNext('https://evil.test')).toBe('/apps');
  expect(safeNext('/\\evil.test')).toBe('/apps');
  expect(safeNext('/api/auth/logout')).toBe('/apps');
});
