import { NextRequest, NextResponse } from 'next/server';
import { backendPath, validOrigin } from '../../../lib/proxy';
import { openSession, sealSession, SESSION_COOKIE } from '../../../lib/session';

export const runtime = 'nodejs';

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const error = (status: number, code: string, message: string) => NextResponse.json({error:{code,message,retryable:status===503}},{status});
  const origin = process.env.WEB_ORIGIN ?? request.nextUrl.origin;
  if (mutation && !validOrigin(request.headers.get('Origin'), origin)) return error(403,'ORIGIN_MISMATCH','请求来源不符合要求');
  if (parts.join('/') === 'auth/logout' && request.method === 'POST') {
    const result=NextResponse.json({ok:true});
    result.cookies.delete(SESSION_COOKIE);
    return result;
  }
  const path=backendPath(parts);
  if (!path) return error(404,'NOT_FOUND','接口不存在');
  if (path === '/auth/login' && request.method !== 'POST' || path === '/auth/register' && request.method !== 'POST' || path === '/auth/me' && request.method !== 'GET') return error(405,'METHOD_NOT_ALLOWED','请求方法不允许');
  const secret=process.env.SESSION_SECRET ?? '';
  const cookie=request.cookies.get(SESSION_COOKIE)?.value;
  const token=cookie ? openSession(cookie,secret) : null;
  const anonymous=path.startsWith('/auth/') && path !== '/auth/me' || path==='/api/community/apps' || path==='/api/catalog/skus' && request.method==='GET' || /^\/api\/publications\/[^/]+$/.test(path) && request.method==='GET';
  if (!token && !anonymous) return error(401,'UNAUTHORIZED','请先登录');
  const headers=new Headers();
  for (const name of ['Content-Type','Idempotency-Key','Last-Event-ID']) {
    const value=request.headers.get(name); if (value) headers.set(name,value);
  }
  if (token) headers.set('Authorization',`Bearer ${token}`);
  let upstream: Response;
  try {
    upstream=await fetch((process.env.API_BASE_URL ?? 'http://127.0.0.1:9000').replace(/\/$/,'')+path+request.nextUrl.search,
      {method:request.method,headers,body:mutation ? await request.arrayBuffer() : undefined,cache:'no-store',signal:request.signal,redirect:'manual'});
  } catch {
    return error(503,'UPSTREAM_UNAVAILABLE','服务暂时不可用');
  }
  if (path==='/auth/login' && upstream.ok) {
    const payload=await upstream.json();
    if (typeof payload.access_token !== 'string' || secret.length<32) return error(503,'SESSION_UNAVAILABLE','登录服务配置尚未就绪');
    const response=NextResponse.json({ok:true});
    response.cookies.set(SESSION_COOKIE,sealSession(payload.access_token,secret),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:3600});
    return response;
  }
  const outgoing=new Headers({'Cache-Control':'no-store','X-Accel-Buffering':'no'});
  for (const name of ['Content-Type','Content-Disposition','X-Request-ID']) {
    const value=upstream.headers.get(name);if (value) outgoing.set(name,value);
  }
  return new NextResponse(upstream.body,{status:upstream.status,headers:outgoing});
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
