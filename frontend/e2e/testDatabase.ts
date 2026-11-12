// Shared only by test configs and test fixtures. Ambient runtime DATABASE_URL is ignored.
const defaultTestDatabaseUrl = 'postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test';
export function resolveTestDatabaseUrl(override = process.env.INTELLIDEPLOY_TEST_DATABASE_URL): string {
 const value = override ?? defaultTestDatabaseUrl;
 const invalid = () => new Error('INTELLIDEPLOY_TEST_DATABASE_URL must select a local test database on port 55432');
 let url: URL;
 try {url = new URL(value);} catch {throw invalid();}
 if (url.protocol !== 'postgresql+psycopg:' || !['127.0.0.1','localhost'].includes(url.hostname)
  || url.port !== '55432' || url.username !== 'intellideploy'
  || !/^\/intellideploy_(?:test(?:_[a-z0-9_]+)?|mobile_figma_[a-z0-9_]+)$/.test(url.pathname)
  || url.hash || [...url.searchParams].some(([key, val]) => key !== 'gssencmode' || val !== 'disable')) throw invalid();
 return value;
}
