import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {extractMobileComponentEvidence} from './extract-mobile-component-evidence.mjs';
const source=process.env.INTELLIDEPLOY_FIGMA_SOURCE;if(!source)throw Error('Set INTELLIDEPLOY_FIGMA_SOURCE');
const document=JSON.parse(await readFile(`${source}/design-data/document.kiwi.json`,'utf8')),id=g=>`${g.sessionID}:${g.localID}`,nodes=new Map(document.nodeChanges.map(n=>[id(n.guid),n])),children=new Map();
for(const n of document.nodeChanges)if(n.parentIndex?.guid){const parent=id(n.parentIndex.guid);children.set(parent,[...(children.get(parent)??[]),id(n.guid)]);}
const root='825:6080',members=[root];for(const key of members)members.push(...(children.get(key)??[]));
if(members.some(key=>['INSTANCE','SYMBOL'].includes(nodes.get(key).type)))throw Error('Editable mascot source required');
function maskPath(index){const bytes=Buffer.from(document.blobs[index].bytes.data,'base64'),commands=[];let offset=0;while(offset<bytes.length){const op=bytes[offset++],letter={0:'Z',1:'M',2:'L',3:'Q',4:'C'}[op];if(!letter)throw Error('Unknown source path operation');const count=op===0?0:op===4?6:op===3?4:2,values=[];for(let i=0;i<count;i++){values.push(Number(bytes.readFloatLE(offset).toFixed(6)));offset+=4;}commands.push(`${letter}${values.join(' ')}`);}return commands.join(' ').replace(/^(?:Z\s*)+/,'');}
const temporary=await mkdtemp(path.join(tmpdir(),'community-avatar-source-'));
try{
 const outputPath=path.join(temporary,'primitive.ts');await extractMobileComponentEvidence({designSource:source,outputPath,auditedRoots:{home:[root]},iconRoots:{}});
 const module=await readFile(outputPath,'utf8'),primitive=JSON.parse(module.match(/export const figmaComponentEvidence = ([\s\S]*?) as const satisfies/)[1]).home;
 const build=(n,inherited=1)=>({sourceNodeId:id(n.guid),size:n.size,transform:n.transform,opacity:n.opacity??1,visible:n.visible!==false,clipsContent:n.type==='FRAME'&&n.frameMaskDisabled===false,mask:n.mask===true,booleanOperation:n.type==='BOOLEAN_OPERATION',maskPaths:(n.fillGeometry??[]).map(g=>({path:maskPath(g.commandsBlob),fillRule:g.windingRule==='ODD'?'evenodd':'nonzero'})),effects:n.effects?.filter(e=>e.visible!==false)??[],geometry:primitive.geometry.filter(g=>g.sourceNodeId===id(n.guid)).map(g=>({...g,opacity:g.opacity/(inherited*(n.opacity??1)||1),transform:undefined,sourceEffects:[]})),children:(children.get(id(n.guid))??[]).sort((a,b)=>nodes.get(a).parentIndex.position<nodes.get(b).parentIndex.position?-1:1).map(key=>build(nodes.get(key),inherited*(n.opacity??1)))});
 await writeFile(new URL('../design/communityAvatarRenderEvidence.ts',import.meta.url),`// Static editable brand mascot, not a creator portrait or account fact.\nexport const communityAvatarRenderEvidence=${JSON.stringify({sourceNodeId:root,nodeCount:members.length,noSymbolReason:'no-instance-or-symbol-in-audited-subtree',tree:build(nodes.get(root))},null,2)} as const;\n`);
}finally{await rm(temporary,{recursive:true,force:true});}
