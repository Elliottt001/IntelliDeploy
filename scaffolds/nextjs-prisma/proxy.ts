import {NextRequest,NextResponse} from 'next/server';
import {configuration,platformRequest} from './lib/platform/client';
import {IDENTITY_COOKIE} from './lib/platform/identity';

export async function proxy(request:{cookies:{get:(name:string)=>{value:string}|undefined}}){
 try{
  const {instance}=configuration();
  const token=request.cookies.get(IDENTITY_COOKIE)?.value;
  const access=await platformRequest<{allowed:boolean}>(`/api/instances/${encodeURIComponent(instance)}/access`,{},token);
  if(!access.allowed)throw new Error('access denied');
  return NextResponse.next();
 }catch{return new NextResponse('应用暂不可用，或需要从平台登录后打开。',{status:403,headers:{'Cache-Control':'no-store'}});}
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|api/health|api/platform/callback).*)']};
