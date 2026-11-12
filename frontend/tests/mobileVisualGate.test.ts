import { describe, expect, it } from 'vitest';
import { comparePixels, pairs } from '../scripts/compare-mobile-visuals.mjs';
describe('strict formal comparison',()=>{
 it('covers exactly all 26 immutable formal references',()=>{expect(pairs).toHaveLength(26);expect(new Set(pairs.map(p=>p[1])).size).toBe(26);});
 it('does not mask real screen content or widen changed ratio',()=>{
  const blank=new Uint8ClampedArray(375*812*4);const actual=blank.slice();
  for(let y=300;y<400;y++)for(let x=100;x<200;x++)actual[(y*375+x)*4]=255;
  expect(comparePixels(actual,blank).status).toBe('FAIL');
  expect(comparePixels(blank,blank).status).toBe('PASS');
 });
 it('masks only authorized status and outer frame pixels',()=>{
 const b=new Uint8ClampedArray(375*812*4),a=b.slice();for(let y=0;y<44;y++)for(let x=0;x<375;x++)a[(y*375+x)*4]=255;
 expect(comparePixels(a,b).changedPixelRatio).toBe(0);
 a[(44*375+5)*4]=255;expect(comparePixels(a,b).changedPixelRatio).toBeGreaterThan(0);
 });
});

it('rejects baseline approval for failed or incomplete formal comparisons', async()=>{
 const {assertVisualApproval}=await import('../scripts/compare-mobile-visuals.mjs');
 expect(()=>assertVisualApproval({formal:[]})).toThrow(/26/);
 const formal=pairs.map(([actual,reference])=>({actual,reference,status:'PASS',meanAbsoluteError:0,changedPixelRatio:0}));
 formal[0].changedPixelRatio=.03001;
 expect(()=>assertVisualApproval({formal})).toThrow(/strict/);
});
