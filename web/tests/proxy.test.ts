import { expect, test } from 'vitest';
import { backendPath, validOrigin } from '../lib/proxy';

test('proxy only forwards registered product paths', () => {
  expect(backendPath(['auth','login'])).toBe('/auth/login');
  expect(backendPath(['apps','a','messages'])).toBe('/api/apps/a/messages');
  expect(backendPath(['https:','evil.test'])).toBeNull();
  expect(backendPath(['apps','..','admin'])).toBeNull();
  expect(backendPath(['apps','%2f..','admin'])).toBeNull();
  expect(backendPath(['unknown'])).toBeNull();
});

test('mutations reject foreign or missing origins', () => {
  expect(validOrigin('https://platform.test','https://platform.test')).toBe(true);
  expect(validOrigin('https://attacker.test','https://platform.test')).toBe(false);
  expect(validOrigin(null,'https://platform.test')).toBe(false);
});
