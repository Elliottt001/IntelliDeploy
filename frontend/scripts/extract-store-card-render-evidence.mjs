import fs from 'node:fs/promises';
const source=process.env.INTELLIDEPLOY_FIGMA_SOURCE;if(!source)throw Error('Set INTELLIDEPLOY_FIGMA_SOURCE');
const document=JSON.parse(await fs.readFile(`${source}/design-data/document.kiwi.json`,'utf8'));
const nodes=new Map(document.nodeChanges.map(n=>[`${n.guid.sessionID}:${n.guid.localID}`,n])),node=id=>nodes.get(id);
const color=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();
const text=id=>{const n=node(id);return {sourceNodeId:id,fontSize:n.fontSize,fontName:n.fontName,lineHeight:n.lineHeight.value,size:n.size,textColor:color(n.fillPaints[0].color)};};
const titleParent=node('270:26717'),iconParent=node('270:26714'),icon=node('270:26715'),summary=node('270:26732'),preview=node('270:26754');
const result={sourceNodeId:'270:26712',size:node('270:26712').size,backgroundColor:color(node('270:26713').fillPaints[0].color),title:{...text('270:26718'),position:titleParent.transform},secondaryText:text('270:26719'),initial:{sourceNodeId:'270:26715',size:icon.size,x:iconParent.transform.m02+icon.transform.m02,y:iconParent.transform.m12+icon.transform.m12,cornerRadius:icon.cornerRadius,backgroundColor:color(icon.fillPaints[0].color)},summary:{...text('270:26732'),position:summary.transform},preview:{sourceNodeId:'270:26754',size:preview.size,position:preview.transform,clipsContent:preview.frameMaskDisabled===false}};
await fs.writeFile(new URL('../design/storeCardRenderEvidence.ts',import.meta.url),`// Actual source typography and native card slots; no rating, award or preview content fallback.\nexport const storeCardRenderEvidence=${JSON.stringify(result,null,2)} as const;\n`);
