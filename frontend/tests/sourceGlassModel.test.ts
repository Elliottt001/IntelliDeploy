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
it('invisible effects remove all optics and NOISE does not enable inherited refraction fields',()=>{
 const glass=glassEvidence['270:26624'].effects[0];
 expect(evaluateGlassField({...glass,visible:false},point).displacement).toEqual({x:0,y:0});
 expect(evaluateGlassField({...glass,type:'NOISE'},point).displacement).toEqual({x:0,y:0});
});
it('audits every selected raw field and original effect array order against Kiwi',()=>{
 const doc=JSON.parse(fs.readFileSync(`${process.env.INTELLIDEPLOY_FIGMA_SOURCE}/design-data/document.kiwi.json`,'utf8'));
 const index=new Map(doc.nodeChanges.map((n:any)=>[`${n.guid.sessionID}:${n.guid.localID}`,n]));
 for(const [id,actual] of Object.entries(glassEvidence)){
  const raw=index.get(id) as any;expect(actual.size).toEqual(raw.size);
  expect(actual.effects).toEqual(raw.effects.map(({authoredColor,secondaryAuthoredColor,...e}:any)=>e));
 }
});
it('extracts deterministic runtime evidence only to the requested temporary output',async()=>{
 const {mkdtemp,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');
 const {extractGlassEvidence}=await import('../scripts/extract-glass-evidence.mjs');const directory=await mkdtemp(`${tmpdir()}/glass-evidence-`);
 try{
  await extractGlassEvidence({source:process.env.INTELLIDEPLOY_FIGMA_SOURCE,output:`${directory}/one.ts`});
  await extractGlassEvidence({source:process.env.INTELLIDEPLOY_FIGMA_SOURCE,output:`${directory}/two.ts`});
  expect(await readFile(`${directory}/one.ts`,'utf8')).toBe(await readFile(`${directory}/two.ts`,'utf8'));
 }finally{await rm(directory,{recursive:true,force:true});}
});
