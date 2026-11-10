const ID = '[A-Za-z0-9_-]+';
const ALLOWED = [
  /^\/api\/apps$/, new RegExp(`^/api/apps/${ID}$`), new RegExp(`^/api/apps/${ID}/(messages|publish)$`),
  new RegExp(`^/api/apps/${ID}/versions/${ID}/artifact$`),
  new RegExp(`^/api/jobs/${ID}(/(events|report|resume|cancel|diagnostics))?$`),
  new RegExp(`^/api/jobs/${ID}/report/evidence/${ID}$`),
  /^\/api\/community\/apps$/, new RegExp(`^/api/publications/${ID}(/copies)?$`),
  /^\/api\/library\/(recent|favorites)$/, new RegExp(`^/api/library/favorites/${ID}$`),
  /^\/api\/quota\/(policy|balance|usage|skus|subscription|orders)$/, new RegExp(`^/api/quota/orders/${ID}$`),
  /^\/api\/quota\/subscription\/cancel$/, /^\/api\/evaluation\/targets$/,
  new RegExp(`^/api/instances/${ID}(/(start|stop|login-code))?$`), new RegExp(`^/api/instance-operations/${ID}$`),
];

export function backendPath(parts: string[]): string | null {
  if (parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  if (parts[0] === 'auth' && parts.length === 2 && ['login', 'register', 'me'].includes(parts[1])) return '/auth/' + parts[1];
  const path = '/api/' + parts.join('/');
  return ALLOWED.some(pattern => pattern.test(path)) ? path : null;
}

export function validOrigin(origin: string | null, expected: string) {
  return origin === expected;
}
