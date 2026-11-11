import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/[...path]/route';
import { sealSession, SESSION_COOKIE } from '../lib/session';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test('BFF sets a private cookie and omits upstream bearer token from login response', async () => {
  vi.stubEnv('SESSION_SECRET','s'.repeat(40));
  vi.stubGlobal('fetch',vi.fn(async () => new Response(JSON.stringify({access_token:'upstream-token',token_type:'bearer'}),{status:200})));
  const response=await POST(new NextRequest('http://localhost:3000/api/auth/login',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'test-only'})}),{params:Promise.resolve({path:['auth','login']})});
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ok:true});
  const cookie=response.headers.get('set-cookie');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).not.toContain('upstream-token');
});

test('unauthenticated or foreign origin requests never reach upstream',async () => {
  const transport=vi.fn();vi.stubGlobal('fetch',transport);
  const response=await POST(new NextRequest('http://localhost:3000/api/apps',{method:'POST',headers:{Origin:'http://attacker.test'},body:'{}'}),{params:Promise.resolve({path:['apps']})});
  expect(response.status).toBe(403);
  const read=await GET(new NextRequest('http://localhost:3000/api/apps'),{params:Promise.resolve({path:['apps']})});
  expect(read.status).toBe(401);
  expect(transport).not.toHaveBeenCalled();
});

test('public catalog is the only anonymous quota-shaped read', async () => {
  const transport = vi.fn(async () => new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', transport);
  const catalog = await GET(new NextRequest('http://localhost:3000/api/catalog/skus'), { params: Promise.resolve({ path: ['catalog', 'skus'] }) });
  expect(catalog.status).toBe(200);
  expect(transport).toHaveBeenCalledOnce();
  expect(new Headers((transport.mock.calls[0] as unknown as [string, RequestInit])[1].headers).get('Authorization')).toBeNull();

  transport.mockClear();
  const privateSkus = await GET(new NextRequest('http://localhost:3000/api/quota/skus'), { params: Promise.resolve({ path: ['quota', 'skus'] }) });
  expect(privateSkus.status).toBe(401);
  expect(transport).not.toHaveBeenCalled();
});

test('SSE proxy preserves named events and the reconnect cursor',async () => {
  vi.stubEnv('SESSION_SECRET','s'.repeat(40));
  const transport=vi.fn(async () => new Response('id: 12\nevent: job\ndata: {}\n\n',{headers:{'Content-Type':'text/event-stream'}}));
  vi.stubGlobal('fetch',transport);
  const cookie=sealSession('test-token','s'.repeat(40));
  const response=await GET(new NextRequest('http://localhost:3000/api/jobs/job-1/events?after_id=10',{headers:{Cookie:`${SESSION_COOKIE}=${cookie}`,'Last-Event-ID':'11'}}),{params:Promise.resolve({path:['jobs','job-1','events']})});
  expect(response.headers.get('content-type')).toBe('text/event-stream');
  expect(await response.text()).toContain('event: job');
  const [url,options]=transport.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('http://127.0.0.1:9000/api/jobs/job-1/events?after_id=10');
  expect(new Headers(options.headers).get('Last-Event-ID')).toBe('11');
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
});

test('upstream authorization failures remain failures instead of becoming a successful response', async () => {
  vi.stubEnv('SESSION_SECRET', 's'.repeat(40));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: '无权访问', retryable: false } }), { status: 404 })));
  const response = await GET(new NextRequest('http://localhost:3000/api/jobs/other', { headers: { Cookie: `${SESSION_COOKIE}=${sealSession('token', 's'.repeat(40))}` } }), { params: Promise.resolve({ path: ['jobs', 'other'] }) });
  expect(response.status).toBe(404);
  expect((await response.json()).error.code).toBe('NOT_FOUND');
});

test('artifact proxy keeps the authenticated download private', async () => {
  vi.stubEnv('SESSION_SECRET', 's'.repeat(40));
  const transport = vi.fn(async () => new Response('zip-content', { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="source.zip"' } }));
  vi.stubGlobal('fetch', transport);
  const response = await GET(new NextRequest('http://localhost:3000/api/apps/app/versions/version/artifact', { headers: { Cookie: `${SESSION_COOKIE}=${sealSession('token', 's'.repeat(40))}` } }), { params: Promise.resolve({ path: ['apps', 'app', 'versions', 'version', 'artifact'] }) });
  expect(response.headers.get('content-disposition')).toContain('attachment');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.text()).toBe('zip-content');
  expect(new Headers((transport.mock.calls[0] as unknown as [string, RequestInit])[1].headers).get('Authorization')).toBe('Bearer token');
});

test('logout clears the session locally and never calls the API', async () => {
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  const response = await POST(new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST', headers: { Origin: 'http://localhost:3000' } }), { params: Promise.resolve({ path: ['auth', 'logout'] }) });
  expect(response.status).toBe(200);
  expect(response.cookies.get(SESSION_COOKIE)?.value).toBe('');
  expect(response.cookies.get(SESSION_COOKIE)?.expires?.valueOf()).toBeLessThan(Date.now());
  expect(transport).not.toHaveBeenCalled();
});
