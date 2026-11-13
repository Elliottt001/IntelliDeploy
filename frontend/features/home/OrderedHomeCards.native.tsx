import {Children,type ReactElement} from 'react';
import {View} from 'react-native';
import {LiveGlassBackdrop} from '../../components/mobile/glass/LiveGlassBackdrop.native';
import type {OrderedHomeCardsProps} from './OrderedHomeCards';
// Source card slots retain 70pt flow spacing; expanded z10 paints after z1.
// Capture each actual preceding RN card (including its glyphs, data and optics)
// exactly once. Current card is rendered against the parent prefix and cannot
// consume its own capture. Bounds include the195pt source artwork overflow.
export function OrderedHomeCards({children,expandedKey,style}:OrderedHomeCardsProps){
 const cards=Children.toArray(children) as ReactElement<{card:{key:string}}>[];
 const order=cards.map((card,index)=>({card,index})).sort((a,b)=>Number(a.card.props.card.key===expandedKey)-Number(b.card.props.card.key===expandedKey));
 const paint=(index:number):ReactElement|null=>{
  const entry=order[index];if(!entry)return null;
  const underlay=<View style={{position:'absolute',top:entry.index*70,left:0,right:0}}>{entry.card}</View>;
  return <LiveGlassBackdrop underlay={underlay} interactiveUnderlay captureStyle={{height:cards.length*70+125,bottom:undefined}}>{paint(index+1)}</LiveGlassBackdrop>;
 };
 return <View style={[style,{height:cards.length*70,overflow:'visible'}]}>{paint(0)}</View>;
}
