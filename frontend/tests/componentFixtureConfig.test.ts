import { afterEach, expect, test } from 'vitest';

import appConfig from '../app.config';
import appJson from '../app.json';

afterEach(() => {
  delete process.env.INTELLIDEPLOY_COMPONENT_FIXTURE;
});

test('default Expo config remains identical to app.json', () => {
  delete process.env.INTELLIDEPLOY_COMPONENT_FIXTURE;
  expect(appConfig()).toEqual(appJson.expo);
});

test('component fixture root is enabled only by explicit env', () => {
  process.env.INTELLIDEPLOY_COMPONENT_FIXTURE = '1';
  expect(appConfig().plugins).toContainEqual([
    'expo-router',
    { root: './e2e/component-fixture-app' },
  ]);
});

test('production mobile config excludes the dedicated fixture motion suite',async()=>{
 const production=(await import('../playwright.mobile.config')).default;
 const fixture=(await import('../playwright.motion.config')).default;
 const file='mobile-complete-motion.spec.ts';const ignored=Array.isArray(production.testIgnore)?production.testIgnore:[production.testIgnore];
 expect(ignored.some(pattern=>pattern instanceof RegExp&&pattern.test(file))).toBe(true);
 expect(fixture.testMatch).toBe(file);
 expect((fixture.webServer as {env?:Record<string,string>}).env?.INTELLIDEPLOY_COMPONENT_FIXTURE).toBe('1');
 delete process.env.INTELLIDEPLOY_COMPONENT_FIXTURE;expect(appConfig()).toEqual(appJson.expo);
});
