import { expect, test } from 'vitest';
import { toPublicationDetailCard, selectFeaturedPublication, unavailablePostCopy } from '../features/community/communityViewModel';
const publication = { id: 'p', app_id: 'a', instance_id: 'i', version_id: 'v', name: '共享笔记', summary: '', features: [], creator: '作者', preview_url: null, url: null, available: true, payer_policy: 'VISITOR' as const, sponsor_period: 'DAY' as const, sponsor_limit_units: 10, copy_url: '/copy', updated_at: '2026-11-10T00:00:00Z' };
test('publication detail cards remain publication-backed without becoming community posts', () => {
 expect(toPublicationDetailCard(publication)).toEqual({ id: 'p', title: '共享笔记', summary: '查看应用介绍', creator: '作者', previewUrl: null, availability: '可使用' });
 expect(toPublicationDetailCard({...publication, summary:' 真实摘要 ', available:false, preview_url:'https://preview.example/image.png'})).toEqual({id:'p',title:'共享笔记',summary:'真实摘要',creator:'作者',previewUrl:'https://preview.example/image.png',availability:'暂不可用'});
 expect(unavailablePostCopy).toEqual({author:null,time:null,body:null});
});
test('featured layout uses first available, otherwise first loaded, and has no empty placeholder', () => {
 const first={...publication,id:'first',available:false}; const second={...publication,id:'second'};
 expect(selectFeaturedPublication([first,second,publication])).toBe(second);
 expect(selectFeaturedPublication([first,{...second,available:false}])).toBe(first);
 expect(selectFeaturedPublication([])).toBeUndefined();
});

import {existsSync,mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {communityEvidence as source} from '../features/community/communityEvidence';
test('formal rail and featured retain measured shells, clipping, glyphs and decoration geometry',()=>{
 expect(source.frames.map(f=>[f.sourceNodeId,f.nodeCount,f.instanceCount])).toEqual([['168:6358',218,0],['825:6452',221,0]]);
 expect(source.tall.size).toEqual({width:145.5,height:345.5});expect(source.standard.size).toEqual({width:280.049988,height:185});
 expect(source.featured.surfaceNodeId).toBe('825:6570');expect(source.featured.size).toEqual({width:441.549988,height:200.5});expect(source.featuredNode.clipsContent).toBe(true);
 expect(source.featured.cornerRadii?.topLeft).toBe(24);expect(source.featured.surfaceFills[0].opacity).toBeCloseTo(.65);expect(source.featured.surfaceEffects.find(e=>e.type==='BACKGROUND_BLUR')?.radius).toBe(16);
 expect(source.title.glyphs.every(g=>g.path.startsWith('M'))).toBe(true);expect(source.title.fontSize).toBe(24);expect(Math.atan2(source.decoration.transform.m10,source.decoration.transform.m00)*180/Math.PI).toBeCloseTo(12,4);
});
const designSource=process.env.INTELLIDEPLOY_FIGMA_SOURCE;
const evidenceModule=(text:string)=>JSON.parse(text.match(/export const communityEvidence = ([\s\S]*?) as const;/)![1]);
test.skipIf(!designSource)('provided Kiwi/FIG/mobile/CSV/raw assets independently match runtime sources',()=>{
 const document=JSON.parse(readFileSync(join(designSource!,'design-data/document.kiwi.json'),'utf8'));const mobile=JSON.parse(readFileSync(join(designSource!,'design-data/移动端UI.nodes.json'),'utf8'));
 const id=(guid:{sessionID:number;localID:number})=>`${guid.sessionID}:${guid.localID}`;const nodes=new Map<string,any>(document.nodeChanges.map((n:any)=>[id(n.guid),n]));
 expect(readFileSync(join(designSource!,'original/IntelliDeploy.fig')).subarray(0,4).toString('hex')).toBe('504b0304');
 for(const frame of source.frames){const descendants=new Set([frame.sourceNodeId]);let count=0;while(descendants.size!==count){count=descendants.size;for(const n of nodes.values())if(n.parentIndex?.guid&&descendants.has(id(n.parentIndex.guid) as any))descendants.add(id(n.guid) as any);}expect(descendants.size).toBe(frame.nodeCount);expect([...descendants].filter(k=>['INSTANCE','SYMBOL'].includes(nodes.get(k).type))).toEqual([]);expect(mobile.nodes.find((n:any)=>id(n.guid)===frame.sourceNodeId).size).toEqual({x:375,y:812});}
 for(const [key,nodeId]of [['tall','270:24544'],['standard','270:24568'],['featured','825:6570']] as const){const n=nodes.get(nodeId);expect(source[key].surfaceNodeId).toBe(nodeId);expect(source[key].size.width).toBeCloseTo(n.size.x,5);expect(source[key].cornerRadii.topLeft).toBe(n.cornerRadius);expect(source[key].surfaceFills.map(p=>p.opacity)).toEqual(n.fillPaints.filter((p:any)=>p.visible!==false).map((p:any)=>Number(p.opacity.toFixed(6))));expect(source[key].surfaceEffects.map(e=>e.radius).sort((a,b)=>a-b)).toEqual(n.effects.filter((e:any)=>e.visible!==false).map((e:any)=>e.radius).sort((a:number,b:number)=>a-b));}
 for(const key of ['title','subtitle'] as const){const n=nodes.get(source[key].sourceNodeId);expect(source[key].characters).toBe(n.textData.characters);expect(source[key].glyphs.length).toBe(n.derivedTextData.glyphs.length);
  n.derivedTextData.glyphs.forEach((glyph:any,index:number)=>{const bytes=Buffer.from(document.blobs[glyph.commandsBlob].bytes.data,'base64');const sourceValues:number[]=[];for(let offset=0;offset<bytes.length;){const opcode=bytes[offset++];expect([0,1,2,3,4]).toContain(opcode);const count=opcode===0?0:opcode===4?6:opcode===3?4:2;for(let j=0;j<count;j++){sourceValues.push(bytes.readFloatLE(offset));offset+=4;}}
   const runtimeValues=(source[key].glyphs[index].path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)??[]).map(Number);expect(runtimeValues.length).toBe(sourceValues.length);runtimeValues.forEach((value,i)=>expect(value).toBeCloseTo(sourceValues[i],5));expect(source[key].glyphs[index].position).toEqual(glyph.position);expect(source[key].glyphs[index].fontSize).toBe(glyph.fontSize);const styleId=n.textData.characterStyleIDs?.[glyph.firstCharacter]??0;const override=n.textData.styleOverrideTable?.find((style:any)=>style.styleID===styleId);const paint=(override?.fillPaints??n.fillPaints).find((paint:any)=>paint.visible!==false);const color=`#${[paint.color.r,paint.color.g,paint.color.b].map((value:number)=>Math.round(value*255).toString(16).padStart(2,'0')).join('').toUpperCase()}`;expect(source[key].glyphs[index].fill).toBe(color);expect(source[key].glyphs[index].opacity).toBe((paint.opacity??1)*(paint.color.a??1));
  });
 }
 for(const layer of source.atmosphere.geometry){const n=nodes.get(layer.sourceNodeId);const bytes=Buffer.from(document.blobs[n.fillGeometry[0].commandsBlob].bytes.data,'base64');const sourceValues:number[]=[];for(let offset=0;offset<bytes.length;){const opcode=bytes[offset++];const count=opcode===0?0:opcode===4?6:opcode===3?4:2;for(let j=0;j<count;j++){sourceValues.push(bytes.readFloatLE(offset));offset+=4;}}const runtimeValues=(layer.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)??[]).map(Number);expect(runtimeValues.length).toBe(sourceValues.length);runtimeValues.forEach((value,i)=>expect(value).toBeCloseTo(sourceValues[i],5));expect(layer.opacity).toBeCloseTo(n.opacity*n.fillPaints[0].opacity*nodes.get('168:6378').opacity,5);}
 for(const key of ['cardTitle','creatorLine','summary','featuredTitle','featuredSummary'] as const){const n=nodes.get(source[key].sourceNodeId);expect(source[key].fontSize).toBe(n.fontSize);expect(source[key].lineHeight).toEqual(n.lineHeight);}
 expect(source.background.fillPaints).toEqual(nodes.get('168:6358').fillPaints);expect(source.decorationContainer.opacity).toBe(nodes.get('825:6572').opacity);
 expect(source.decoration.transform).toEqual(nodes.get('825:6573').transform);expect(source.preview.clipsContent).toBe(nodes.get('825:6172').frameMaskDisabled===false);
 expect(readFileSync(join(designSource!,'design-data/frames.csv'),'utf8')).toContain('825:6570,FRAME,Feed Item 3 (Full Width Featured)');expect(readFileSync(join(designSource!,'design-data/text.csv'),'utf8')).toContain('818:5811,探索社区广场');
 expect(readFileSync(join(designSource!,'design-data/fonts.csv'),'utf8')).toContain('PingFang SC,Heavy');expect(readFileSync(join(designSource!,'design-data/colors.csv'),'utf8')).toContain('#494A64');
 const raw=JSON.parse(readFileSync(join(designSource!,'design-data/raw-assets.json'),'utf8'));const asset=raw.find((a:any)=>a.archive_path==='images/cf4137a92d5c522da12ba616a0dabfbfcb7da314');expect(asset).toBeTruthy();expect(readFileSync(join(designSource!,asset.local_path))).toEqual(readFileSync(join(import.meta.dirname,'../assets/mobile/generated/825-6573-cf4137a92d5c522da12ba616a0dabfbfcb7da314.png')));
});

test.skipIf(!designSource)('community evidence generator writes isolated deterministic output with raw atmosphere effects',async()=>{
 const {writeCommunityEvidence}=await import('../features/community/extractCommunityEvidence.mjs') as {writeCommunityEvidence:(designSource:string,outputPath:string)=>Promise<unknown>};
 const directory=mkdtempSync(join(tmpdir(),'task10-community-evidence-')),first=join(directory,'first.ts'),second=join(directory,'second.ts');
 const trackedPath=join(import.meta.dirname,'../features/community/communityEvidence.ts'),before=readFileSync(trackedPath);
 await writeCommunityEvidence(designSource!,first);await writeCommunityEvidence(designSource!,second);
 expect(existsSync(first)).toBe(true);expect(existsSync(second)).toBe(true);expect(readFileSync(first)).toEqual(readFileSync(second));expect(readFileSync(trackedPath)).toEqual(before);expect(readFileSync(first)).toEqual(before);
 const generated=evidenceModule(readFileSync(first,'utf8'));
 const document=JSON.parse(readFileSync(join(designSource!,'design-data/document.kiwi.json'),'utf8'));const id=(guid:{sessionID:number;localID:number})=>`${guid.sessionID}:${guid.localID}`;const nodes=new Map<string,any>(document.nodeChanges.map((n:any)=>[id(n.guid),n]));
 const raw=generated.atmosphere.effects.map((effect:any)=>nodes.get(effect.sourceNodeId).effects.find((sourceEffect:any)=>sourceEffect.type===effect.rawType&&sourceEffect.seed===effect.seed));
 expect(generated.atmosphere.effects.map((effect:any)=>effect.sourceNodeId)).toEqual(['168:6379','168:6380']);
 expect(generated.atmosphere.effects.map((effect:any)=>effect.type)).toEqual(raw.map((effect:any)=>effect.type));
 expect(generated.atmosphere.effects.map((effect:any)=>effect.rawPayload)).toEqual(raw);
});
