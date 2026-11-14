import {expect,test} from 'vitest';
import {getSourceMotion} from '../design/sourceMotionEvidence';
import {sourceRouteOffsets} from '../components/mobile/sourceRouteMotion';
test('source slide direction uses live viewport without a page fade',()=>{
 const motion=getSourceMotion('825:5828','ON_CLICK')!;
 for(const height of [568,812,932]){
   expect(sourceRouteOffsets(motion,0,{width:375,height}).incoming).toEqual({x:0,y:-height});
   expect(sourceRouteOffsets(motion,.5,{width:375,height}).outgoing).toEqual({x:-0,y:height/2});
   expect(sourceRouteOffsets(motion,1,{width:375,height}).incoming).toEqual({x:0,y:-0});
 }
});
