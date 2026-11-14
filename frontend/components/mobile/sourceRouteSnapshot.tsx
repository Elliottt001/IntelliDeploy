import { createElement, useLayoutEffect, useRef, type RefObject } from 'react';
import type { View } from 'react-native';
export type RouteSnapshot = { element: HTMLElement; dispose:()=>void; restore:()=>void };
let serial=0;
/** Freeze the actual DOM presentation, including an interrupted transition.
 * Clone carries no listeners; IDs/fragment references receive a unique namespace. */
export async function captureRoutePresentation(root:RefObject<View|null>):Promise<RouteSnapshot|null>{
 const original=root.current as unknown as HTMLElement|null;
 if(!original?.cloneNode)return null;
 const clone=original.cloneNode(true) as HTMLElement, prefix=`source-route-${++serial}-`;
 const originals=[original,...Array.from(original.querySelectorAll('*'))];
 const copies=[clone,...Array.from(clone.querySelectorAll('*'))];
 const ids=new Map<string,string>();
 for(const element of copies) if(element.id)ids.set(element.id,prefix+element.id);
 for(let i=0;i<copies.length;i++){
   const element=copies[i],live=originals[i];
   if(live instanceof HTMLElement && element instanceof HTMLElement){
     const style=getComputedStyle(live);
     for(const property of Array.from(style))element.style.setProperty(property,style.getPropertyValue(property),style.getPropertyPriority(property));
     element.scrollTop=live.scrollTop;element.scrollLeft=live.scrollLeft;
   }
   if(element.id)element.id=ids.get(element.id)!;
   for(const attribute of Array.from(element.attributes)){
     let value=attribute.value.replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${ids.get(id)??id})`);
     if((attribute.name==='href'||attribute.name==='xlink:href')&&value.startsWith('#'))value='#'+(ids.get(value.slice(1))??value.slice(1));
     if(value!==attribute.value)element.setAttribute(attribute.name,value);
     if(attribute.name.startsWith('on')||attribute.name.startsWith('data-source-route-'))element.removeAttribute(attribute.name);
   }
   element.removeAttribute('data-testid');element.removeAttribute('autofocus');element.setAttribute('tabindex','-1');
 }
 clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');
 clone.style.pointerEvents='none';clone.style.position='absolute';clone.style.inset='0';clone.style.margin='0';clone.style.width='100%';clone.style.height='100%';
 return {element:clone,dispose:()=>clone.remove(),restore:()=>{for(let i=0;i<copies.length;i++){if(copies[i] instanceof HTMLElement && originals[i] instanceof HTMLElement){(copies[i] as HTMLElement).scrollTop=(originals[i] as HTMLElement).scrollTop;(copies[i] as HTMLElement).scrollLeft=(originals[i] as HTMLElement).scrollLeft;}}}};
}
export function RouteSnapshotView({snapshot,x,y}:{snapshot:RouteSnapshot;x:number;y:number;width:number;height:number}){
 const host=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{host.current?.appendChild(snapshot.element);snapshot.restore();return()=>snapshot.element.remove();},[snapshot]);
 return createElement('div',{ref:host,'aria-hidden':true,inert:true,'data-source-route-snapshot':true,style:{position:'absolute',inset:0,pointerEvents:'none',transform:`translate(${x}px,${y}px)`}});
}
