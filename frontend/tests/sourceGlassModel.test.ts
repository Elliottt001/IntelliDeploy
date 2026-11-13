import {describe,it,expect} from 'vitest';
import {evaluateGlassField} from '../components/mobile/glass/sourceGlassModel';
import {glassEvidence} from '../design/glassEvidence';
import fs from 'node:fs';
const node=()=>glassEvidence['270:26624'];
const point={x:2,y:18,width:295,height:36,distance:2,normal:{x:-1,y:0}};
describe('source optical controls',()=>{
 it('keeps raw source effects and source units',()=>{
  const source=process.env.INTELLIDEPLOY_FIGMA_SOURCE;
  if(!source)throw Error('INTELLIDEPLOY_FIGMA_SOURCE required for raw audit');
  const doc=JSON.parse(fs.readFileSync(`${source}/design-data/document.kiwi.json`,'utf8'));
  const raw=doc.nodeChanges.find((n:any)=>`${n.guid.sessionID}:${n.guid.localID}`==='270:26624');
  expect(node().effects).toEqual(raw.effects.map(({authoredColor,secondaryAuthoredColor,...e}:any)=>e));
  expect(node().size).toEqual(raw.size);
 });
 it('zero refraction removes displacement; dispersion/light/reflection are independent',()=>{
  const e=node().effects.find(e=>e.type==='GLASS')!;
  const a=evaluateGlassField(e,point);
  expect(a.displacement.x).not.toBe(0);
  expect(evaluateGlassField({...e,refractionIntensity:0},point).displacement).toEqual({x:0,y:0});
  expect(evaluateGlassField({...e,chromaticAberration:0},point).dispersion).toBe(0);
  expect(evaluateGlassField({...e,specularIntensity:0},point).light).toBe(0);
  expect(evaluateGlassField({...e,bevelSize:0},point).bevel).toBe(0);
  expect(evaluateGlassField({...e,reflectionDistance:0},point).reflection).toEqual({x:0,y:0});
  expect(evaluateGlassField({...e,reflectionDistance:4},point).reflection).not.toEqual({x:0,y:0});
 });
 it('noise seed repeats and zero opacity/density remove noise',()=>{
  const e={...node().effects[0],type:'NOISE'};
  expect(evaluateGlassField(e,point)).toEqual(evaluateGlassField(e,point));
  expect(evaluateGlassField({...e,opacity:0},point).noiseAlpha).toBe(0);
  expect(evaluateGlassField({...e,density:0},point).noiseAlpha).toBe(0);
  expect(evaluateGlassField({...e,seed:200},point).noise).not.toBe(evaluateGlassField(e,point).noise);
 });
});
