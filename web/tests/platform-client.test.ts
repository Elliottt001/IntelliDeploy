import {afterEach,expect,test,vi} from 'vitest';
import {exchangeIdentity} from '../../scaffolds/nextjs-prisma/lib/platform/identity';
import {platformRequest} from '../../scaffolds/nextjs-prisma/lib/platform/client';
import {NextRequest} from 'next/server';
import {proxy} from '../../scaffolds/nextjs-prisma/proxy';
import {askAI} from '../../scaffolds/nextjs-prisma/lib/platform/ai';
afterEach(()=>vi.unstubAllGlobals());

test('generated app exchanges a single code with registered callback and instance credential',async()=>{
 process.env.PLATFORM_CAPABILITY_URL='https://platform.example';process.env.PLATFORM_INSTANCE_TOKEN='instance-secret';process.env.PLATFORM_INSTANCE_ID='instance';
 let requestBody:unknown;
 vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{expect(url).toBe('https://platform.example/api/capabilities/identity/exchange');requestBody=JSON.parse(String(init.body));return new Response(JSON.stringify({access_token:'app-user-identity',expires_in:900,token_type:'bearer'}));});
 const result=await exchangeIdentity('one-use','https://app.example/api/platform/callback');
 expect(requestBody).toEqual({code:'one-use',callback:'https://app.example/api/platform/callback',instance_token:'instance-secret'});
 expect(result.access_token).toBe('app-user-identity');
});

test('generated app capability requests separate the instance credential from user identity',async()=>{
 process.env.PLATFORM_CAPABILITY_URL='https://platform.example';process.env.PLATFORM_INSTANCE_TOKEN='instance-secret';process.env.PLATFORM_INSTANCE_ID='instance';
 let headers=new Headers();
 vi.stubGlobal('fetch',async(_url:string,init:RequestInit)=>{headers=new Headers(init.headers);return new Response('{}');});
 await platformRequest('/api/capabilities/search',{method:'POST',body:'{}'},'user-identity');
 expect(headers.get('X-Instance-ID')).toBe('instance');
 expect(headers.get('X-Instance-Token')).toBe('instance-secret');
 expect(headers.get('Authorization')).toBe('Bearer user-identity');
});

test('generated app AI uses the actual capability route and sends a model',async()=>{
 process.env.PLATFORM_CAPABILITY_URL='https://platform.example';process.env.PLATFORM_INSTANCE_TOKEN='instance-secret';process.env.PLATFORM_INSTANCE_ID='instance';
 let path='';let body:any;
 vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{path=url;body=JSON.parse(String(init.body));return new Response('{}');});
 await askAI([{role:'user',content:'hello'}],'once');
 expect(path).toBe('https://platform.example/api/capabilities/chat');
 expect(body.model).toBeTruthy();
});

test('generated app gateway rejects revoked visibility on the next request',async()=>{
 process.env.PLATFORM_CAPABILITY_URL='https://platform.example';process.env.PLATFORM_INSTANCE_TOKEN='instance-secret';process.env.PLATFORM_INSTANCE_ID='instance';
 let visible=true;
 vi.stubGlobal('fetch',async()=>new Response(JSON.stringify(visible?{allowed:true,user_id:null}:{error:{code:'INSTANCE_FORBIDDEN'}}),{status:visible?200:403}));
 const request=new NextRequest('https://app.example/notes');
 expect((await proxy(request)).headers.get('x-middleware-next')).toBe('1');
 visible=false;
 expect((await proxy(request)).status).toBe(403);
});

test('login callback removes the code URL and issues an HttpOnly app session',async()=>{
 const {GET}=await import('../../scaffolds/nextjs-prisma/app/api/platform/callback/route');
 process.env.PLATFORM_LOGIN_CALLBACK='https://app.example/api/platform/callback';
 process.env.PLATFORM_CAPABILITY_URL='https://platform.example';process.env.PLATFORM_INSTANCE_TOKEN='instance-secret';process.env.PLATFORM_INSTANCE_ID='instance';
 vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({access_token:'app-identity',expires_in:900,token_type:'bearer'})));
 const result=await GET(new NextRequest('https://app.example/api/platform/callback?code=one-use'));
 expect(result.status).toBe(303);
 expect(result.headers.get('location')).toBe('https://app.example/');
 expect(result.headers.get('set-cookie')).toContain('HttpOnly');
 expect(result.headers.get('cache-control')).toBe('no-store');
});
