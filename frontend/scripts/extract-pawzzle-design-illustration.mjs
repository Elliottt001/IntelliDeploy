import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

// Restore the reviewed exact RAW+UV+parent clip as STATIC_DESIGN_ILLUSTRATION.
// It is illustrative Pawzzle phone UI from the design, never a Publication API screenshot.
const source=process.env.INTELLIDEPLOY_FIGMA_SOURCE;
if(!source)throw Error('Set INTELLIDEPLOY_FIGMA_SOURCE to regenerate the reviewed static design illustration');
const output = new URL('../assets/mobile/static-design/', import.meta.url);
const provenance=JSON.parse(await readFile(new URL('pawzzle-phone-illustration.provenance.json',output),'utf8'));
const documentBytes=await readFile(`${source}/design-data/document.kiwi.json`),document=JSON.parse(documentBytes);
const node=id=>document.nodeChanges.find(n=>`${n.guid.sessionID}:${n.guid.localID}`===id);
const parent=node(provenance.parentClip.id),leaf=node(provenance.sourceLeaf.id),paint=leaf.fillPaints.find(p=>p.type==='IMAGE'&&p.visible!==false);
const hash=value=>createHash('sha256').update(value).digest('hex');
const rawHash=Buffer.from(paint.image.hash.data,'base64').toString('hex'),raw=await readFile(`${source}/raw-assets/${rawHash}.png`);
if(rawHash!==provenance.imageFill.originalRawHash||hash(raw)!==provenance.imageFill.originalRawSha256||parent.frameMaskDisabled!==false||parent.size.x!==214||parent.size.y!==184)throw Error('Reviewed source asset/clip changed');
function pathFor(index){const bytes=Buffer.from(document.blobs[index].bytes.data,'base64');let offset=0;const commands=[];while(offset<bytes.length){const op=bytes[offset++],letter={0:'Z',1:'M',2:'L',3:'Q',4:'C'}[op];if(!letter)throw Error('Unknown source geometry');const count=op===0?0:op===4?6:op===3?4:2,values=[];for(let i=0;i<count;i++){values.push(bytes.readFloatLE(offset));offset+=4;}commands.push(`${letter}${values.join(' ')}`);}return commands.join(' ');}
const clip=n=>(n.fillGeometry??[]).map(g=>({path:pathFor(g.commandsBlob),rule:g.windingRule==='ODD'?'evenodd':'nonzero'}));
const browser=await chromium.launch();let bytes,browserVersion;
try{
 browserVersion=browser.version();const page=await browser.newPage();
 const dataURL=await page.evaluate(async({raw,uv,parentSize,leafSize,leafTransform,parentPaths,leafPaths,opacity})=>{
  const image=new Image();image.src=`data:image/png;base64,${raw}`;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=parentSize.x;canvas.height=parentSize.y;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  for(const p of parentPaths)ctx.clip(new Path2D(p.path),p.rule);
  ctx.transform(leafTransform.m00,leafTransform.m10,leafTransform.m01,leafTransform.m11,leafTransform.m02,leafTransform.m12);
  for(const p of leafPaths)ctx.clip(new Path2D(p.path),p.rule);
  const determinant=uv.m00*uv.m11-uv.m01*uv.m10,inv={m00:uv.m11/determinant,m01:-uv.m01/determinant,m02:(uv.m01*uv.m12-uv.m11*uv.m02)/determinant,m10:-uv.m10/determinant,m11:uv.m00/determinant,m12:(uv.m10*uv.m02-uv.m00*uv.m12)/determinant};
  ctx.globalAlpha=opacity;ctx.transform(leafSize.x*inv.m00/image.width,leafSize.y*inv.m10/image.width,leafSize.x*inv.m01/image.height,leafSize.y*inv.m11/image.height,leafSize.x*inv.m02,leafSize.y*inv.m12);ctx.drawImage(image,0,0);
  return canvas.toDataURL('image/png');
 },{raw:raw.toString('base64'),uv:paint.transform,parentSize:parent.size,leafSize:leaf.size,leafTransform:leaf.transform,parentPaths:clip(parent),leafPaths:clip(leaf),opacity:(leaf.opacity??1)*(paint.opacity??1)});
 bytes=Buffer.from(dataURL.split(',')[1],'base64');
}finally{await browser.close();}
const sha256=hash(bytes);
if(sha256!=='d192dc7d4e2e0e05fe7b40c1e0827d79df52ab884909237a195e0d586b0e963a'||sha256!==provenance.sha256)throw Error('Source regeneration differs from reviewed illustration');
await mkdir(output, {recursive: true});
await writeFile(new URL('pawzzle-phone-illustration.png', output), bytes);
await writeFile(new URL('pawzzle-phone-illustration.provenance.json', output), JSON.stringify({...provenance,sourceRegeneration:{sourceDocumentSha256:hash(documentBytes),rawSha256:hash(raw),browserVersion,method:'Actual source paths and inverse UV through default Chromium Canvas.toDataURL; not a page screenshot; no ignored candidate prerequisite.'}}, null, 2) + '\n');
console.info(`Regenerated STATIC_DESIGN_ILLUSTRATION ${sha256}`);
