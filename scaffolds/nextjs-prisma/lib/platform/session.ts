import {cookies} from 'next/headers';
import {configuration,platformRequest} from './client';
import {IDENTITY_COOKIE} from './identity';

export async function appIdentity(){
 const token=(await cookies()).get(IDENTITY_COOKIE)?.value;
 const{instance}=configuration();
 const result=await platformRequest<{allowed:boolean,user_id:number|null}>(`/api/instances/${encodeURIComponent(instance)}/access`,{},token);
 return {token,userId:result.user_id};
}

export async function requireAppUser(){
 const identity=await appIdentity();
 if(identity.userId===null||!identity.token)throw new Error('请从平台登录后打开应用');
 return {token:identity.token,userId:identity.userId};
}
