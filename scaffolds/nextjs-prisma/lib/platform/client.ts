export function configuration() {
  const base = process.env.PLATFORM_CAPABILITY_URL;
  const token = process.env.PLATFORM_INSTANCE_TOKEN;
  const instance = process.env.PLATFORM_INSTANCE_ID;
  if (!base || !token || !instance) throw new Error('平台能力尚未配置');
  return { base: base.replace(/\/$/, ''), token, instance };
}

export async function platformRequest<T>(path: string, init: RequestInit = {}, userIdentity?:string): Promise<T> {
  const { base, token, instance } = configuration();
  const headers=new Headers(init.headers);
  headers.set('X-Instance-ID',instance);headers.set('X-Instance-Token',token);headers.set('Content-Type','application/json');
  if(userIdentity)headers.set('Authorization',`Bearer ${userIdentity}`);else headers.delete('Authorization');
  const response = await fetch(base + path, { ...init, cache: 'no-store', headers });
  if (!response.ok) throw new Error(`平台能力调用失败: ${response.status}`);
  return response.json() as Promise<T>;
}
