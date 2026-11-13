import {it,expect} from 'vitest';
import {nativeFrameResources} from '../components/mobile/glass/nativeFrameResources';
it('reclaims every temporary native factory result while retaining only explicitly cached resources',()=>{
 let allocated=0,disposed=0;const api={Factory:{Make(){allocated++;return {dispose(){disposed++;}};}}};
 const frame=nativeFrameResources(api),a=frame.api.Factory.Make(),b=frame.api.Factory.Make();
 frame.release(a);frame.retain(b);frame.api.Factory.Make();const stats=frame.finish();
 expect(allocated).toBe(3);expect(disposed).toBe(2);expect(stats).toEqual({created:3,released:2,live:0});b.dispose();expect(disposed).toBe(3);
});
