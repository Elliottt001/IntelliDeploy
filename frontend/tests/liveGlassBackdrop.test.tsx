import {it,expect} from 'vitest';
import {liveBackdropCapture} from '../components/mobile/glass/liveBackdropCapture';
it('keeps capture single-flight and discards stale generations and unmounted images',async()=>{
 const pending:Array<(v:any)=>void>=[];const disposed:number[]=[];const published:any[]=[];
 const state=liveBackdropCapture(()=>new Promise(resolve=>pending.push(resolve)),v=>published.push(v));
 const a=state.update();state.invalidate();void state.update();expect(pending.length).toBe(1);
 pending[0]({dispose(){disposed.push(1);}});await a;expect(disposed).toEqual([1]);expect(pending.length).toBe(2);
 state.stop();pending[1]({dispose(){disposed.push(2);}});await Promise.resolve();await Promise.resolve();
 expect(disposed).toEqual([1,2]);expect(published).toEqual([null]);
});
it('publishes a slow valid capture when another frame requests work while busy',async()=>{
 let resolve!:(v:any)=>void;const published:any[]=[];
 const owner=liveBackdropCapture(()=>new Promise(done=>{resolve=done;}),v=>published.push(v));
 const first=owner.update();void owner.update();const image={dispose(){}};resolve(image);await first;
 expect(published).toEqual([image]);owner.stop();
});
it('reports producer failure and clears stale input rather than claiming a live old frame',async()=>{
 const output:any[]=[];const errors:unknown[]=[];let fail=false;
 const owner=liveBackdropCapture(async()=>{if(fail)throw Error('native capture failed');return {dispose(){}};},value=>output.push(value),image=>image.dispose(),error=>errors.push(error));
 await owner.update();fail=true;await owner.update();
 expect(output.at(-1)).toBeNull();expect(String(errors[0])).toContain('native capture failed');owner.stop();
});
