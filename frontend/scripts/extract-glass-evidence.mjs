import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// A compact runtime contract. No source-package path is imported by the app.
export async function extractGlassEvidence({source=process.env.INTELLIDEPLOY_FIGMA_SOURCE,output=process.env.INTELLIDEPLOY_GLASS_OUTPUT??fileURLToPath(new URL('../design/glassEvidence.ts',import.meta.url))}={}){
 if(!source)throw Error('INTELLIDEPLOY_FIGMA_SOURCE required');
 const doc=JSON.parse(await readFile(path.join(source,'design-data/document.kiwi.json'),'utf8'));
 const evidence={};
 const selected=new Set(Object.keys(JSON.parse(await readFile(new URL('../../.superpowers/sdd/2026-11-13-mobile-glass-motion/glass-source-preflight.json',import.meta.url),'utf8'))));
 for(const n of doc.nodeChanges){
  if(!n.effects?.some(e=>e.type==='GLASS'||e.type==='NOISE'))continue;
  const id=`${n.guid.sessionID}:${n.guid.localID}`;
  if(!selected.has(id))continue;
  const decode=index=>{const bytes=Buffer.from(doc.blobs[index].bytes.data,'base64');let offset=0,commands=[];while(offset<bytes.length){const op=bytes[offset++],letter={0:'Z',1:'M',2:'L',3:'Q',4:'C'}[op];if(!letter)throw Error('Invalid Kiwi path opcode');const count=op===0?0:op===4?6:op===3?4:2;commands.push(letter+Array.from({length:count},()=>{const value=bytes.readFloatLE(offset);offset+=4;return Number(value.toFixed(6));}).join(' '));}return commands.join(' ').replace(/^(?:Z\s*)+/,'');};
  evidence[id]={type:n.type,size:n.size,cornerRadius:n.cornerRadius??0,paths:(n.fillGeometry??[]).map(g=>({path:decode(g.commandsBlob),fillRule:g.windingRule==='ODD'?'evenodd':'nonzero'})),effects:n.effects.map(({authoredColor,secondaryAuthoredColor,...effect})=>effect)};
 }
 await mkdir(path.dirname(output),{recursive:true});
 const temporary=`${output}.tmp-${process.pid}`;
 await writeFile(temporary,`// Generated from original Kiwi effect records. Geometry stays in its existing source adapter.\nimport type {GlassSourceNode} from '../components/mobile/glass/sourceGlassModel';\nexport const glassEvidence: Record<string,GlassSourceNode> = ${JSON.stringify(evidence)};\n`);
 await rename(temporary,output);
 return Object.keys(evidence).length;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(`Extracted ${await extractGlassEvidence()} glass/noise source nodes`);
