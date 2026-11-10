import { expect, test } from 'vitest';
import { sealSession, openSession } from '../lib/session';

test('session hides the bearer token and rejects tampering and expired cookies', () => {
  const secret='s'.repeat(40);
  const cookie=sealSession('private-token',secret,60);
  expect(cookie).not.toContain('private-token');
  expect(openSession(cookie,secret)).toBe('private-token');
  expect(openSession(cookie+'x',secret)).toBeNull();
  expect(openSession(sealSession('token',secret,-1),secret)).toBeNull();
});
