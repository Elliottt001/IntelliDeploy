// Task-owned source extraction. Shared extractor validates original FIG/mobile/Instance/Symbol/style sources.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { extractMobileComponentEvidence } from '../../scripts/extract-mobile-component-evidence.mjs';
const id = guid => `${guid.sessionID}:${guid.localID}`;
export function auditCommunityFrames(nodeChanges) {
 const nodes=new Map(nodeChanges.map(n=>[id(n.guid),n])); const children=new Map();
 for(const n of nodeChanges) { if(!n.parentIndex?.guid)continue; const p=id(n.parentIndex.guid); children.set(p,[...(children.get(p)??[]),id(n.guid)]); }
 return ['168:6358','825:6452'].map(sourceNodeId=>{
  if(nodes.get(sourceNodeId)?.type!=='FRAME')throw Error(`Missing formal frame ${sourceNodeId}`);
  const subtree=new Set([sourceNodeId]); for(const k of subtree)for(const c of children.get(k)??[])subtree.add(c);
  const instanceCount=[...subtree].filter(k=>['INSTANCE','SYMBOL'].includes(nodes.get(k).type)).length;
  if(instanceCount)throw Error('Resolve community Instance/Symbol before regeneration');
  return {sourceNodeId,nodeCount:subtree.size,instanceCount,noSymbolReason:'no-instance-or-symbol-in-audited-subtree'};
 });
}
export async function extractCommunityEvidence(designSource) {
 const temporary=await mkdtemp(path.join(tmpdir(),'community-source-'));
 try {
  const outputPath=path.join(temporary,'evidence.ts');
  await extractMobileComponentEvidence({designSource,outputPath,auditedRoots:{home:['168:6378'],community:['270:24544'],store:['270:24568'],products:['270:24618'],glassCard:['825:6570']},iconRoots:{}});
  const module=await readFile(outputPath,'utf8'); const primitives=JSON.parse(module.match(/export const figmaComponentEvidence = ([\s\S]*?) as const satisfies/)[1]);
  const document=JSON.parse(await readFile(path.join(designSource,'design-data/document.kiwi.json'),'utf8')); const nodes=new Map(document.nodeChanges.map(n=>[id(n.guid),n]));
  const node=sourceNodeId=>{const n=nodes.get(sourceNodeId);return {sourceNodeId,size:n.size,transform:n.transform,cornerRadius:n.cornerRadius??0,opacity:n.opacity??1,clipsContent:n.frameMaskDisabled===false,fillPaints:n.fillPaints??[],strokePaints:n.strokePaints??[],effects:n.effects??[],fontSize:n.fontSize??null,lineHeight:n.lineHeight??null,textColor:n.fillPaints?.find(p=>p.visible!==false&&p.color)?.color?colorHex(n.fillPaints.find(p=>p.visible!==false&&p.color).color):null};};
  function glyphPath(index) { const bytes=Buffer.from(document.blobs[index].bytes.data,'base64'); let offset=0; const commands=[];
   while(offset<bytes.length){const opcode=bytes[offset++];const letter={0:'Z',1:'M',2:'L',3:'Q',4:'C'}[opcode];if(!letter)throw Error(`Unsupported glyph ${opcode}`);const count=opcode===0?0:opcode===4?6:opcode===3?4:2;const values=Array.from({length:count},()=>{const value=bytes.readFloatLE(offset);offset+=4;return Number(value.toFixed(6));});commands.push(`${letter}${values.join(' ')}`);}return commands.join(' ').replace(/^(?:Z\s*)+/,'');
  }
  const colorHex=color=>`#${[color.r,color.g,color.b].map(value=>Math.round(value*255).toString(16).padStart(2,'0')).join('').toUpperCase()}`;
  const text=sourceNodeId=>{const n=nodes.get(sourceNodeId);return {...node(sourceNodeId),characters:n.textData.characters,fontName:n.fontName,glyphs:n.derivedTextData.glyphs.map(g=>{const styleId=n.textData.characterStyleIDs?.[g.firstCharacter]??0;const override=n.textData.styleOverrideTable?.find(style=>style.styleID===styleId);const paint=(override?.fillPaints??n.fillPaints).find(p=>p.visible!==false);return {path:glyphPath(g.commandsBlob),position:g.position,fontSize:g.fontSize,firstCharacter:g.firstCharacter,styleId,fill:paint?.color?colorHex(paint.color):'none',opacity:(paint?.opacity??1)*(paint?.color?.a??1)};})};};
  const surface=p=>({...p,sourceNodeIds:[p.surfaceNodeId],geometry:p.geometry.filter(layer=>layer.sourceNodeId===p.surfaceNodeId),fills:p.surfaceFills,strokes:p.surfaceStrokes,effects:p.surfaceEffects});
  return {frames:auditCommunityFrames(document.nodeChanges),background:node('168:6358'),atmosphereNode:node('168:6378'),atmosphere:primitives.home,tall:surface(primitives.community),standard:surface(primitives.store),square:surface(primitives.products),featured:surface(primitives.glassCard),
   rail:node('825:5887'),railTarget:node('825:6488'),tallNode:node('270:24544'),standardNode:node('270:24568'),squareNode:node('270:24618'),featuredNode:node('825:6570'),preview:node('825:6172'),decoration:node('825:6573'),decorationContainer:node('825:6572'),glow:node('825:6571'),title:text('818:5811'),subtitle:text('818:5810'),featuredContent:node('825:6574'),summary:node('270:24553'),cardTitle:node('270:24549'),creatorLine:node('270:24551'),featuredTitle:node('825:6582'),featuredTitleSlot:node('825:6581'),featuredSummary:node('825:6584'),featuredSummarySlot:node('825:6583'),featuredCaption:node('825:6580'),availabilitySlot:node('825:6585')};
 } finally {await rm(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const designSource=process.env.INTELLIDEPLOY_FIGMA_SOURCE;if(!designSource)throw Error('Set INTELLIDEPLOY_FIGMA_SOURCE to full local Figma pack');
 const result=await extractCommunityEvidence(designSource);
 await writeFile(path.join(path.dirname(fileURLToPath(import.meta.url)),'communityEvidence.ts'),`// Generated from actual formal Kiwi nodes; regenerate with extractCommunityEvidence.mjs.\nexport const communityEvidence = ${JSON.stringify(result,null,2)} as const;\n`);
 console.log('Extracted community frame/source shells, paint visibility/effects, glyphs, clipping, rotation and slots.');
}
