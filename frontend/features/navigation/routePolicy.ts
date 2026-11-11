const exactPublicPaths = new Set([
  '/login',
  '/register',
  '/store',
  '/store/ranking',
  '/community',
]);

const communityDetailPath = /^\/community\/[A-Za-z0-9_-]+$/;
const safeNextPath = /^\/(?:store(?:\/ranking)?|community(?:\/[A-Za-z0-9_-]+)?|chatbot|app-gallery|billing|library\/(?:favorites|recent)|app-detail\/[A-Za-z0-9_-]+)$/;

export type SafeNextPath = `/${string}`;

export function isPublicPath(pathname: string): boolean {
  return exactPublicPaths.has(pathname) || communityDetailPath.test(pathname);
}

export function sanitizeNextPath(value: unknown): SafeNextPath | '/' {
  if (value === '/') {
    return '/';
  }

  return typeof value === 'string' && safeNextPath.test(value)
    ? (value as SafeNextPath)
    : '/';
}
