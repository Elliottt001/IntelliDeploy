// Frame-scoped ownership of native factory results. Returned HostObjects remain
// original objects (no proxy crosses JSI); only factory calls are intercepted.
export function nativeFrameResources<T extends object>(api:T){
 const owned=new Set<{dispose():void}>(),wrappers=new WeakMap<object,object>();let created=0,released=0;
 const wrap=(target:object):object=>{const prior=wrappers.get(target);if(prior)return prior;const proxy=new Proxy(target,{get(value,key){const item=Reflect.get(value,key,value);if(typeof item==='function')return (...args:unknown[])=>{const result=Reflect.apply(item,value,args) as {dispose?:()=>void}|null;if(result&&typeof result.dispose==='function'){owned.add(result as {dispose():void});created++;}return result;};if(item&&typeof item==='object'&&typeof item.dispose!=='function')return wrap(item);return item;}});wrappers.set(target,proxy);return proxy;};
 const release=(value:{dispose():void}|null|undefined)=>{if(value){const tracked=owned.delete(value);value.dispose();if(tracked)released++;}};
 return {api:wrap(api) as T,release,retain(value:{dispose():void}){owned.delete(value);},finish(){for(const value of owned){value.dispose();released++;}owned.clear();return {created,released,live:owned.size};}};
}
