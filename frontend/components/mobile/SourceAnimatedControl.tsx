import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { sourceControlStates } from '../../design/sourceControlMotionEvidence';
import { getSourceMotion, type SourceMotion } from '../../design/sourceMotionEvidence';
import { FigmaTree } from './FigmaTree';
import { interpolateSourceControl, type SourceControlState } from './sourceControlInterpolation';
import { useSourceMotion } from './useSourceMotion';

type Transition = { from: SourceControlState; to: SourceControlState; motion: SourceMotion; generation: number };
export type SourceAnimatedControlProps = {
  kind: 'settings' | 'reaction'; accessibilityLabel: string; onPress?: () => void;
  selected?: boolean; visualOnly?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
};
/** Reaction visualOnly is an isolated component demonstration. Production
 * selection comes from its owner/API; this component never mutates a Job or count. */
export function SourceAnimatedControl({ kind, accessibilityLabel, onPress, selected=false, visualOnly=false, disabled=false, style, testID }: SourceAnimatedControlProps) {
  const resting = kind === 'settings' ? '248:20538' : selected ? '228:19791' : '228:19794';
  const [state,setState] = useState(sourceControlStates[resting]);
  const [transition,setTransition] = useState<Transition|null>(null);
  const current = useRef(state), stateId = useRef(resting), generation = useRef(0), timeout = useRef<ReturnType<typeof setTimeout>|null>(null), foreground = useRef(AppState.currentState !== 'background');
  const api = useSourceMotion(transition?.motion ?? null);
  const previousSelected=useRef(selected);
  const clearTimeoutChain = useCallback(() => { if(timeout.current !== null) clearTimeout(timeout.current); timeout.current=null; },[]);
  const beginRef = useRef<(target:string,motion:SourceMotion)=>void>(()=>{});
  const begin = useCallback((target:string,motion:SourceMotion) => {
    clearTimeoutChain(); api.cancel();
    const to=sourceControlStates[target]; if(!to)return;
    stateId.current=target;
    setTransition({from:current.current,to,motion,generation:++generation.current});
  },[api.cancel,clearTimeoutChain]);
  beginRef.current=begin;
  useEffect(()=>{const listener=api.progress.addListener(({value})=>{if(!transition||generation.current!==transition.generation)return;const presentation=interpolateSourceControl(transition.from,transition.to,value);current.current=presentation;setState(presentation);});return()=>api.progress.removeListener(listener);},[api.progress,transition]);
  useLayoutEffect(()=>{
    if(!transition)return;
    const expected=transition.generation;
    api.start(()=>{
      if(generation.current!==expected)return;
      current.current=transition.to;setState(transition.to);
      const follow=getSourceMotion(transition.to.sourceNodeId,'AFTER_TIMEOUT');
      if(follow?.targetNodeId && kind==='reaction' && foreground.current){
        timeout.current=setTimeout(()=>{timeout.current=null;if(generation.current===expected&&foreground.current)beginRef.current(follow.targetNodeId!,follow);},follow.prototypeDelayMs);
      }
    });
  },[transition,api.start,kind]);
  useEffect(()=>{
    if(kind!=='reaction'||visualOnly)return;
    if(previousSelected.current!==selected){previousSelected.current=selected;const click=getSourceMotion(selected?'228:19794':'228:19791','ON_CLICK');if(click?.targetNodeId){begin(click.targetNodeId,click);return;}}
  },[selected,kind,visualOnly,begin]);
  useEffect(()=>{if(!disabled)return;clearTimeoutChain();generation.current++;api.cancel();const stable=sourceControlStates[resting];current.current=stable;stateId.current=resting;setState(stable);setTransition(null);},[disabled,resting,api.cancel,clearTimeoutChain]);
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',next=>{
      foreground.current=next==='active';
      if(next==='active')return;
      clearTimeoutChain();generation.current++;api.cancel();
      const stable=sourceControlStates[resting];current.current=stable;stateId.current=resting;setState(stable);setTransition(null);
    });
    return()=>{subscription.remove();clearTimeoutChain();generation.current++;api.cancel();};
  },[api.cancel,clearTimeoutChain,resting]);
  const hover=(enter:boolean)=>{
    if(disabled||kind!=='settings')return;
    const motion=getSourceMotion('248:20538','ON_HOVER');
    if(motion)begin(enter?'248:20537':'248:20538',motion);
  };
  const click=()=>{
    if(disabled)return;
    onPress?.();
    if(kind==='reaction'&&visualOnly){const motion=getSourceMotion(stateId.current,'ON_CLICK');if(motion?.targetNodeId)begin(motion.targetNodeId,motion);}
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={kind==='reaction'?{selected,disabled}:{disabled}} disabled={disabled} onHoverIn={()=>hover(true)} onHoverOut={()=>hover(false)} onPressIn={()=>{if(Platform.OS!=='web')hover(true);}} onPressOut={()=>{if(Platform.OS!=='web')hover(false);}} onPress={click} testID={testID} style={[styles.target,style]}>
    <View pointerEvents="none" accessibilityElementsHidden {...(Platform.OS==='web'?{'aria-hidden':true,dataSet:{sourceControlState:stateId.current,sourceControlWidth:String(state.size.x)}}: {})} style={{width:state.size.x,height:state.size.y}}>
      <FigmaTree node={state} prefix={`${testID??kind}-source-control`} />
    </View>
  </Pressable>;
}
const styles=StyleSheet.create({target:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}});
