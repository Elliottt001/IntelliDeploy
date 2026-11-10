import { expect, test, vi } from 'vitest';
import { createApiClient, ApiError } from '../src/client';

test('create carries auth and idempotency without duplicating the API prefix', async () => {
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({app_id:'a',job_id:'j',status:'QUEUED'}),{status:201}));
  const api=createApiClient({baseUrl:'https://api.test',getToken:async ()=>'test-token',fetchImpl});
  expect(await api.createApp('笔记',100,'once')).toEqual({app_id:'a',job_id:'j',status:'QUEUED'});
  const [url,init]=fetchImpl.mock.calls[0];
  expect(url).toBe('https://api.test/api/apps');
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
  expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('once');
  expect(JSON.parse(init?.body as string)).toEqual({prompt:'笔记',budget_units:100});
});

test('same origin requests read the backend error contract', async () => {
  const fetchImpl=vi.fn<typeof fetch>(async () => new Response(JSON.stringify({error:{code:'ACTIVE_JOB_EXISTS',message:'处理中',retryable:false}}),{status:409}));
  const api=createApiClient({baseUrl:'',fetchImpl});
  await expect(api.sendMessage('a','继续','key')).rejects.toMatchObject({status:409,code:'ACTIVE_JOB_EXISTS'});
  expect(fetchImpl.mock.calls[0][0]).toBe('/api/apps/a/messages');
});

test('download sends authentication without putting the token in the URL',async () => {
  const fetchImpl=vi.fn<typeof fetch>(async () => new Response('archive'));
  const api=createApiClient({baseUrl:'https://api.test',getToken:async ()=>'test-token',fetchImpl});
  expect(await (await api.downloadArtifact('a','v')).text()).toBe('archive');
  expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/api/apps/a/versions/v/artifact');
});

test('quota methods read the shared account endpoints',async () => {
  const fetchImpl=vi.fn<typeof fetch>(async () => new Response(JSON.stringify({available_units:70,reserved_units:30})));
  const api=createApiClient({baseUrl:'',fetchImpl});
  expect(await api.getBalance()).toEqual({available_units:70,reserved_units:30});
  expect(fetchImpl.mock.calls[0][0]).toBe('/api/quota/balance');
});

test('snapshot reads can be cancelled when a mobile screen leaves the foreground', async () => {
  const controller = new AbortController();
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(JSON.stringify({ id: 'job' }));
  });
  const api = createApiClient({ baseUrl: '', fetchImpl });
  controller.abort();
  await expect(api.getJob('job', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  await expect(api.getApp('app', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

test('community copies, instance operations and login exchange share authenticated endpoints',async()=>{
  const calls:Array<[string,RequestInit|undefined]>=[];
  const transport:typeof fetch=async(input,init)=>{calls.push([String(input),init]);return new Response(JSON.stringify({code:'single-use-code',expires_in:60,items:[],next_cursor:null}));};
  const api=createApiClient({baseUrl:'',getToken:async()=>'private-platform-token',fetchImpl:transport});
  await api.createCopy('publication',undefined,'copy-once');
  await api.startInstance('instance','start-once');
  await api.deleteInstance('instance',false,'delete-once');
  await api.issueLoginCode('instance','https://app.example/api/platform/callback');
  await api.listFavorites('cursor');
  expect(calls.map(([path])=>path)).toEqual(['/api/publications/publication/copies','/api/instances/instance/start','/api/instances/instance','/api/instances/instance/login-code','/api/library/favorites?cursor=cursor']);
  expect(JSON.parse(calls[2][1]?.body as string)).toEqual({confirmation:'DELETE',delete_data:false});
  expect(new Headers(calls[0][1]?.headers).get('Idempotency-Key')).toBe('copy-once');
  expect(calls.every(([url])=>!url.includes('private-platform-token'))).toBe(true);
});
