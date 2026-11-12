import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function runtimeSessionSecret(): string {
  try { return process.env.SESSION_SECRET_FILE ? readFileSync(process.env.SESSION_SECRET_FILE, 'utf8').trim() : process.env.SESSION_SECRET ?? ''; }
  catch { return ''; }
}

export const SESSION_COOKIE = 'intellideploy_session';

function key(secret: string) {
  if (secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return createHash('sha256').update(secret).digest();
}

export function sealSession(token: string, secret: string, seconds = 3600): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify({ token, exp: Date.now() + seconds * 1000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

export function openSession(cookie: string, secret: string): string | null {
  try {
    const bytes = Buffer.from(cookie, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    return typeof payload.token === 'string' && payload.exp > Date.now() ? payload.token : null;
  } catch {
    return null;
  }
}
