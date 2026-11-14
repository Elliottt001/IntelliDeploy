import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {SourceMotion} from '../../design/sourceMotionEvidence';
import {interpolateSourceControl,type SourceControlState} from './sourceControlInterpolation';
import {useSourceMotion} from './useSourceMotion';
/** A replacement captures actual sampled presentation before resetting the
 * timing channel. Local geometry/paint/root matrices all use the same sample. */
export function useSourceTreeMotion(target:SourceControlState,motion:SourceMotion|null){
 const current=useRef(target),generation=useRef(0),[state,setState]=useState(target);
 const [transition,setTransition]=useState<{from:SourceControlState;to:SourceControlState;motion:SourceMotion|null;generation:number}|null>(null);
 const api=useSourceMotion(transition?.motion??null);
 useLayoutEffect(()=>{
  if(current.current===target)return;
  api.cancel();setTransition({from:current.current,to:target,motion:motion?{...motion}:null,generation:++generation.current});
 },[target,motion,api.cancel]);
 useEffect(()=>{const id=api.progress.addListener(({value})=>{
  if(!transition||generation.current!==transition.generation)return;
  const presentation=interpolateSourceControl(transition.from,transition.to,value);current.current=presentation;setState(presentation);
 });return()=>api.progress.removeListener(id);},[api.progress,transition]);
 useLayoutEffect(()=>{if(!transition)return;api.start(()=>{if(generation.current!==transition.generation)return;current.current=transition.to;setState(transition.to);});},[api.start,transition]);
 return state;
}
