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
