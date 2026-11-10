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
