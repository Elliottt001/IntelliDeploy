import http from 'node:http';

const defaultMode = { community: 'ready', catalog: 'ready' };
let mode = { ...defaultMode };
const publication = { id: 'public-home', app_id: 'app-home', instance_id: 'instance-home', version_id: 'version-home', name: '面向跨部门协作的公开笔记与知识整理应用', summary: '保存、读取并继续整理个人笔记', features: ['保存笔记', '读取历史'], creator: '测试发布者', preview_url: null, url: null, available: false, payer_policy: 'VISITOR', sponsor_period: 'DAY', sponsor_limit_units: 0, copy_url: '/api/publications/public-home/copies', updated_at: '2026-11-11T00:00:00Z' };
const skus = [
  { id: 'cny-pack', name: '基础额度包', provider: 'alipay', currency: 'CNY', amount_minor: 9900, units: 10000, period: null },
  { id: 'usd-monthly', name: '月度额度套餐', provider: 'stripe', currency: 'USD', amount_minor: 1900, units: 30000, period: 'MONTH' },
  { id: 'cny-team', name: '团队协作额度包', provider: 'wechat', currency: 'CNY', amount_minor: 29900, units: 50000, period: null },
  { id: 'usd-yearly', name: '年度额度套餐', provider: 'stripe', currency: 'USD', amount_minor: 19900, units: 360000, period: 'YEAR' },
  { id: 'cny-large', name: '大型项目额度包', provider: 'alipay', currency: 'CNY', amount_minor: 99900, units: 200000, period: null },
];
const send = (response, status, payload) => { response.statusCode = status; response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(payload)); };
const readBody = (request) => new Promise((resolve, reject) => { const chunks = []; request.on('data', (chunk) => chunks.push(chunk)); request.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (error) { reject(error); } }); request.on('error', reject); });

http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:9100');
  if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { ok: true });
  if (request.method === 'POST' && url.pathname === '/__fixture__/reset') { mode = { ...defaultMode }; return send(response, 200, mode); }
  if (request.method === 'POST' && url.pathname === '/__fixture__/mode') {
    try {
      const next = await readBody(request);
      for (const key of ['community', 'catalog']) if (next[key] !== undefined && !['ready', 'empty', 'error'].includes(next[key])) return send(response, 400, { error: { code: 'INVALID_MODE', message: `invalid ${key} mode`, retryable: false } });
      mode = { ...mode, ...next }; return send(response, 200, mode);
    } catch { return send(response, 400, { error: { code: 'INVALID_JSON', message: 'fixture body must be JSON', retryable: false } }); }
  }
  if (request.method === 'GET' && url.pathname === '/api/community/apps') { if (mode.community === 'error') return send(response, 503, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'fixture community failure', retryable: true } }); return send(response, 200, { items: mode.community === 'empty' ? [] : [publication], next_cursor: null }); }
  if (request.method === 'GET' && url.pathname === '/api/catalog/skus') { if (mode.catalog === 'error') return send(response, 503, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'fixture catalog failure', retryable: true } }); return send(response, 200, mode.catalog === 'empty' ? [] : skus); }
  if (request.method === 'GET' && url.pathname === '/api/publications/public-home') return send(response, 200, publication);
  return send(response, 404, { error: { code: 'NOT_FOUND', message: 'fixture route not found', retryable: false } });
}).listen(9100, '127.0.0.1');
