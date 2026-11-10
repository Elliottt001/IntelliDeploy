function configuration() {
  const base = process.env.PLATFORM_CAPABILITY_URL;
  const token = process.env.PLATFORM_INSTANCE_TOKEN;
  if (!base || !token) throw new Error('平台能力尚未配置');
  return { base: base.replace(/\/$/, ''), token };
}

export async function platformRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { base, token } = configuration();
  const response = await fetch(base + path, { ...init, cache: 'no-store', headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`平台能力调用失败: ${response.status}`);
  return response.json() as Promise<T>;
}
