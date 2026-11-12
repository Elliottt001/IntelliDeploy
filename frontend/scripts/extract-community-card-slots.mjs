import fs from 'node:fs/promises';
const root=process.env.INTELLIDEPLOY_FIGMA_SOURCE;if(!root)throw Error('Set INTELLIDEPLOY_FIGMA_SOURCE');
const doc=JSON.parse(await fs.readFile(`${root}/design-data/document.kiwi.json`,'utf8'));
const nodes=new Map(doc.nodeChanges.map(n=>[`${n.guid.sessionID}:${n.guid.localID}`,n]));
const slot=id=>{const n=nodes.get(id);return {sourceNodeId:id,x:n.transform.m02,y:n.transform.m12,width:n.size.x,height:n.size.y};};
const result={header:slot('270:24545'),avatar:slot('825:6080'),copy:slot('270:24547'),creator:slot('270:24550'),summary:slot('270:24552'),preview:slot('825:6172')};
await fs.writeFile(new URL('../design/communityCardSlots.ts',import.meta.url),`// Original editable card slots only; all names, creators, summaries and previews remain API fields.\nexport const communityCardSlots=${JSON.stringify(result,null,2)} as const;\n`);
