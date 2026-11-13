// @vitest-environment happy-dom
import React,{forwardRef,useState,act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({frames:[] as FrameRequestCallback[],captures:[] as string[],disposed:0}));
vi.mock('react-native',()=>({
 View:forwardRef<any,any>((props,ref)=>{React.useEffect(()=>props.onLayout?.({nativeEvent:{layout:{width:375,height:812}}}),[]);return <div ref={ref} data-root="capture">{props.children}</div>;}),
 AppState:{currentState:'active',addEventListener:()=>({remove(){}})},PixelRatio:{get:()=>2},StyleSheet:{absoluteFill:{}},useWindowDimensions:()=>({width:375,height:812}),
}));
vi.mock('@shopify/react-native-skia',()=>({makeImageFromView:async(ref:any)=>{state.captures.push(ref.current.innerHTML);return {width:()=>750,height:()=>1624,dispose(){state.disposed++;}};}}));
import {LiveGlassBackdrop,useLiveGlassBackdrop} from '../components/mobile/glass/LiveGlassBackdrop.native';
it('captures actual updated prefix siblings while current optics/foreground stay outside every capture and prior optics use parent input',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.requestAnimationFrame=callback=>{state.frames.push(callback);return state.frames.length;};globalThis.cancelAnimationFrame=()=>{};
 const inputSizes:number[]=[];let set!:(value:string)=>void;
 function PriorOptics(){inputSizes.push(useLiveGlassBackdrop().layers.length);return <span>prior optical scene</span>;}
 function Fixture(){const [text,update]=useState('REAL PRIOR TEXT');set=update;return <LiveGlassBackdrop mode="flow" underlay={<><span>{text}</span><PriorOptics/></>}><span>CURRENT OPTICS</span><span>CURRENT FOREGROUND</span></LiveGlassBackdrop>;}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 await act(async()=>root.render(<Fixture/>));await act(async()=>state.frames.shift()!(40));
 expect(state.captures[0]).toContain('REAL PRIOR TEXT');expect(state.captures[0]).not.toContain('CURRENT');expect(inputSizes.every(size=>size===0)).toBe(true);
 await act(async()=>set('CHANGED LIVE TEXT'));
 for(let i=0;i<5&&state.captures.length<2;i++)await act(async()=>state.frames.shift()!(80+i*40));
 expect(state.captures.at(-1)).toContain('CHANGED LIVE TEXT');expect(state.captures.at(-1)).not.toContain('CURRENT');
 await act(async()=>root.unmount());expect(state.disposed).toBeGreaterThan(0);host.remove();
});
