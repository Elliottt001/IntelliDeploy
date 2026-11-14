/** @vitest-environment happy-dom */
import {act,createElement,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {sampleSourceEasing} from '../features/navigation/sourceMotionPolicy';
import {getSourceMotion} from '../design/sourceMotionEvidence';
const driver=vi.hoisted(()=>({platform:{OS:'web'},animations:[] as Array<{value:any;config:any;complete?:(result:{finished:boolean})=>void;stop:ReturnType<typeof vi.fn>}>,app:new Set<(state:string)=>void>()}));
vi.mock('react-native',async()=>{
 const web=await vi.importActual<any>('react-native-web');
 return {...web,Platform:driver.platform,Animated:{...web.Animated,timing:(value:any,config:any)=>{const animation={value,config,stop:vi.fn(),complete:undefined as undefined|((r:{finished:boolean})=>void)};driver.animations.push(animation);return {stop:animation.stop,start:(complete:any)=>{animation.complete=complete;}};}},AccessibilityInfo:{isReduceMotionEnabled:()=>Promise.resolve(false),addEventListener:()=>({remove(){}})},AppState:{currentState:'active',addEventListener:(_event:string,listener:(state:string)=>void)=>{driver.app.add(listener);return {remove:()=>driver.app.delete(listener)};}}};
});
vi.mock('../components/mobile/FigmaTree',()=>({FigmaTree:({node}:any)=>createElement('output',{'data-tree':JSON.stringify(node)})}));
import {SourceAnimatedControl} from '../components/mobile/SourceAnimatedControl';
import {SourceRouteTransition,useSourceRouteTransition} from '../components/mobile/SourceRouteTransition';
const roots=new Set<Root>();
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;driver.animations.length=0;driver.app.clear();driver.platform.OS='web';vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));});
afterEach(()=>{act(()=>roots.forEach(root=>root.unmount()));roots.clear();document.body.innerHTML='';vi.useRealTimers();vi.unstubAllGlobals();});
function mount(node:any){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.add(root);act(()=>root.render(node));return {host,root};}
const animation=()=>driver.animations.at(-1)!;
function sample(t:number){const a=animation();act(()=>a.value.setValue(a.config.easing(t)));}
function finish(){const a=animation();act(()=>{a.value.setValue(a.config.toValue);a.complete?.({finished:true});});}
function tree(host:HTMLElement){return JSON.parse(host.querySelector('output')!.getAttribute('data-tree')!);}
test('actual control renders source start/mid/end and reverses from current presentation',()=>{
 const {host}=mount(createElement(SourceAnimatedControl,{kind:'settings',accessibilityLabel:'source setting',testID:'control'}));
 const button=host.querySelector('[role="button"]')!;
 expect(tree(host).size.x).toBe(38);
 act(()=>{document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));button.dispatchEvent(new PointerEvent('pointerenter',{bubbles:false,pointerType:'mouse'}));});
 expect(driver.animations.length).toBe(1);
 sample(.15);const current=tree(host).size.x;
 expect(current).toBeCloseTo(38+(44.999996185302734-38)*sampleSourceEasing(getSourceMotion('248:20538','ON_HOVER')!,.15),6);
 act(()=>button.dispatchEvent(new PointerEvent('pointerleave',{bubbles:false,pointerType:'mouse',relatedTarget:document.body})));
 expect(tree(host).size.x).toBe(current);sample(.5);finish();expect(tree(host).size.x).toBe(38);
 expect(getComputedStyle(button).minWidth).toBe('44px');
});
test('reaction follows visual timeout only in isolated mode and clears pending work on background',()=>{
 vi.useFakeTimers();
 const {host}=mount(createElement(SourceAnimatedControl,{kind:'reaction',visualOnly:true,accessibilityLabel:'visual reaction'}));
 const button=host.querySelector('[role="button"]')!;
 act(()=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 expect(tree(host).sourceNodeId).toBe('228:19794');sample(.5);expect(tree(host).geometry.length).toBe(0);finish();
 expect(tree(host).sourceNodeId).toBe('228:19793');act(()=>vi.advanceTimersByTime(2));finish();
 expect(tree(host).sourceNodeId).toBe('228:19791');
 act(()=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));finish();
 act(()=>driver.app.forEach(listener=>listener('background')));act(()=>vi.advanceTimersByTime(2000));
 expect(tree(host).sourceNodeId).toBe('228:19794');
});
test('production reaction callback never invents selected success or schedules the visual chain',()=>{
 const onPress=vi.fn();const {host}=mount(createElement(SourceAnimatedControl,{kind:'reaction',accessibilityLabel:'reaction',onPress}));
 act(()=>host.querySelector('[role="button"]')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 expect(onPress).toHaveBeenCalledTimes(1);expect(driver.animations).toHaveLength(0);expect(tree(host).sourceNodeId).toBe('228:19794');
});
test('route freezes actual prior presentation and releases inert old DOM after the source endpoint',async()=>{
 const motion=getSourceMotion('825:5828','ON_CLICK')!;
 function Page(){const [page,setPage]=useState('old');const navigate=useSourceRouteTransition();return createElement('main',null,createElement('span',{id:'real-page'},page),createElement('svg',null,createElement('defs',null,createElement('clipPath',{id:'same-def'})),createElement('path',{clipPath:'url(#same-def)'})),createElement('button',{onClick:()=>navigate(motion,()=>setPage('new'),'/')},'go'));}
 const {host}=mount(createElement(SourceRouteTransition,null,createElement(Page)));
 await act(async()=>host.querySelector('button')!.click());
 const snapshot=host.querySelector('[data-source-route-snapshot]')!;
 expect(snapshot.textContent).toContain('old');expect(snapshot.querySelector('[inert]')).not.toBeNull();expect(snapshot.querySelector('#real-page')).toBeNull();
 const ids=Array.from(host.querySelectorAll('[id]'),node=>node.id);expect(new Set(ids).size).toBe(ids.length);
 sample(.5);expect(Number(host.querySelector('[data-source-route-progress]')!.getAttribute('data-source-route-progress'))).toBeCloseTo(sampleSourceEasing(motion,.5),6);
 finish();expect(host.querySelector('[data-source-route-snapshot]')).toBeNull();expect(host.textContent).toContain('new');
});

test('avatar and cloud source trees animate matched properties and preserve the sampled pose during reversal',async()=>{
 const {SourceAvatarMotion}=await import('../components/mobile/SourceAvatarMotion');
 const {sourceControlStates}=await import('../design/sourceControlMotionEvidence');
 const {useSourceTreeMotion}=await import('../components/mobile/useSourceTreeMotion');
 const avatar=mount(createElement(SourceAvatarMotion,{active:false}));
 act(()=>avatar.root.render(createElement(SourceAvatarMotion,{active:true})));
 sample(.3);const width=tree(avatar.host).size.x;expect(width).not.toBe(sourceControlStates['270:26291'].size.x);
 act(()=>avatar.root.render(createElement(SourceAvatarMotion,{active:false})));
 expect(tree(avatar.host).size.x).toBe(width);finish();expect(tree(avatar.host).size).toEqual(sourceControlStates['270:26291'].size);
 function Cloud({pressed}:{pressed:boolean}){const value=useSourceTreeMotion(sourceControlStates[pressed?'188:16981':'270:26318'],getSourceMotion('266:21221','ON_PRESS'));return createElement('output',{'data-tree':JSON.stringify(value)});}
 const cloud=mount(createElement(Cloud,{pressed:false}));act(()=>cloud.root.render(createElement(Cloud,{pressed:true})));
 sample(.3);expect(tree(cloud.host).children.length).toBeGreaterThan(0);finish();expect(tree(cloud.host)).toEqual(sourceControlStates['188:16981']);
});
test('every source community avatar owner has a real visual consumer with its own initial geometry and raw hover action',async()=>{
 const {SourceAvatarMotion}=await import('../components/mobile/SourceAvatarMotion');
 const {sourceControlStates}=await import('../design/sourceControlMotionEvidence');
 for(const owner of ['825:6080','825:6100','825:6133','825:6153','825:6434','825:6491','825:6532','825:6588','825:6606','825:6640']){
  const {host,root}=mount(createElement(SourceAvatarMotion,{sourceNodeId:owner,interactive:true}));
  expect(tree(host).size).toEqual(sourceControlStates[owner].size);
  act(()=>host.querySelector('[role="button"]')!.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'})));
  expect(animation().config.duration).toBe(getSourceMotion(owner,'ON_HOVER')!.durationMs);
  sample(.3);expect(tree(host).size.x).not.toBe(sourceControlStates[owner].size.x);finish();expect(tree(host).size).toEqual(sourceControlStates['188:16338'].size);
  act(()=>root.unmount());roots.delete(root);host.remove();
 }
});
