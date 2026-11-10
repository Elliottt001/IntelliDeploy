import {configuration} from './client';
export const IDENTITY_COOKIE='intellideploy_app_identity';
export async function exchangeIdentity(code:string,callback:string):Promise<{access_token:string,token_type:string,expires_in:number}>{
 const{base,token}=configuration();
 const response=await fetch(base+'/api/capabilities/identity/exchange',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,callback,instance_token:token})});
 if(!response.ok)throw new Error('应用登录凭证无效或已使用');
 return response.json();
}
