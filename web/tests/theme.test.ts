import { expect, test } from 'vitest';
import { readStoredTheme, resolveTheme } from '../lib/theme';

test('stored theme wins and invalid storage falls back to the OS', () => {
  expect(readStoredTheme('dark')).toBe('dark');
  expect(readStoredTheme('sepia')).toBeNull();
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme(null, true)).toBe('dark');
  expect(resolveTheme(null, false)).toBe('light');
});
