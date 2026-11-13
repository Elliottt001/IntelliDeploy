import {it,expect} from 'vitest';
import {liveBackdropCapture} from '../components/mobile/glass/liveBackdropCapture';
it('keeps capture single-flight and discards stale generations and unmounted images',async()=>{
 const pending:Array<(v:any)=>void>=[];const disposed:number[]=[];const published:any[]=[];
 const state=liveBackdropCapture(()=>new Promise(resolve=>pending.push(resolve)),v=>published.push(v));
 const a=state.update();void state.update();expect(pending.length).toBe(1);
 pending[0]({dispose(){disposed.push(1);}});await a;expect(disposed).toEqual([1]);expect(pending.length).toBe(2);
 state.stop();pending[1]({dispose(){disposed.push(2);}});await Promise.resolve();await Promise.resolve();
 expect(disposed).toEqual([1,2]);expect(published).toEqual([null]);
});
