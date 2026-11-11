import { expect, test } from 'vitest';

import { loginOptions } from '../features/auth/loginOptions';

test('unimplemented social providers are visible but cannot authenticate', () => {
  expect(loginOptions.map(({ id, enabled }) => [id, enabled])).toEqual([
    ['google', false],
    ['github', false],
    ['apple', false],
  ]);
});
