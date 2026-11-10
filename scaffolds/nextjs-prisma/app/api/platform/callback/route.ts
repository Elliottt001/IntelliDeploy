import {NextRequest,NextResponse} from 'next/server';
import {exchangeIdentity,IDENTITY_COOKIE} from '../../../../lib/platform/identity';
export const runtime='nodejs';
export async function GET(request:Request){
 const code=new URL(request.url).searchParams.get('code');
 const configured=process.env.PLATFORM_LOGIN_CALLBACK;
 if(!code||!configured)return new NextResponse('应用登录尚未配置',{status:503,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 try{
  const identity=await exchangeIdentity(code,configured);
  const result=NextResponse.redirect(new URL('/',configured),303);
  result.cookies.set(IDENTITY_COOKIE,identity.access_token,{httpOnly:true,secure:new URL(configured).protocol==='https:',sameSite:'lax',path:'/',maxAge:identity.expires_in});
  result.headers.set('Cache-Control','no-store');result.headers.set('Referrer-Policy','no-referrer');
  return result;
 }catch{return new NextResponse('登录凭证已失效，请从平台重新打开应用。',{status:401,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
}
