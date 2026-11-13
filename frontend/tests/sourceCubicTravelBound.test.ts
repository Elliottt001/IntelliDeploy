import {it,expect} from 'vitest';
import {sourceCubicTravelBound} from '../e2e/sourceCubicTravelBound';
import {sourceNode} from './figmaSource';
it('original Mibo source curve allows29.16pt in one60Hz frame, so the former25pt ceiling was invalid',()=>{
 const raw=sourceNode('852:4150').prototypeInteractions.flatMap((e:any)=>e.actions??[]).find((a:any)=>a.transitionNodeID?.localID===4391||a.transitionNodeId?.localID===4391);
 const action=raw??sourceNode('852:4150').prototypeInteractions[0].actions[0];
 expect(action.easingFunction).toEqual([0.41999998688697815,0,0.5799999833106995,1]);
 const maximum=sourceCubicTravelBound(action.easingFunction,action.transitionDuration*1000,812,1000/60);
 expect(maximum).toBeCloseTo(29.1585942,4);expect(maximum).toBeGreaterThan(25);
 expect(sourceCubicTravelBound(action.easingFunction,action.transitionDuration*1000,812,0)).toBe(0);
});
