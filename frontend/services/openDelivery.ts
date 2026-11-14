import type {components} from '@intellideploy/api-client';
type Delivery=NonNullable<components['schemas']['AppDetail']['delivery']>;
export async function openDelivery(delivery:Delivery,issue:(instance:string,callback:string)=>Promise<{code:string}>,open:(url:string)=>Promise<unknown>){
 if(delivery.kind==='EXTERNAL_LINK')return open(delivery.url);
 const callback=new URL('/api/platform/callback',delivery.url).href;
 const {code}=await issue(delivery.instance_id,callback);
 const url=new URL(callback);url.searchParams.set('code',code);
 return open(url.href);
}
