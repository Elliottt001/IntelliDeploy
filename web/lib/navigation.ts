const allowedRoots = ['/create', '/apps', '/community'] as const;

export function safeNext(value: string | null, fallback = '/apps') {
  if (!value || value.includes('\\')) return fallback;
  try {
    const url = new URL(value, 'https://intellideploy.local');
    if (url.origin !== 'https://intellideploy.local') return fallback;
    const allowed = allowedRoots.some((root) => url.pathname === root || url.pathname.startsWith(`${root}/`));
    return allowed ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
