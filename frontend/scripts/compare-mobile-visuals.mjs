import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {pairs,comparePixels,assertVisualApproval,imageHash} from './mobile-visual-contract.cjs';
export {pairs,comparePixels,assertVisualApproval,imageHash};
async function main(){
 const root=path.resolve('artifacts/figma/mobile');await mkdir(path.join(root,'overlays'),{recursive:true});
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:375,height:812}});const formal=[];
 const data=async file=>`data:image/png;base64,${(await readFile(file)).toString('base64')}`;
 try{for(const[actual,reference]of pairs){
  const actualUrl=await data(path.join(root,'actual',actual)),referenceUrl=await data(path.join(root,'reference',reference));
  const result=await page.evaluate(async({actualUrl,referenceUrl,compare})=>{
   const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
   const[a,b]=await Promise.all([load(actualUrl),load(referenceUrl)]);if(a.width!==375||a.height!==812)throw Error('Actual images must be exactly 375x812');if(!((b.width===832&&b.height===1800)||(b.width===375&&b.height===812)))throw Error('Unexpected immutable Figma reference dimensions');
   const c=document.createElement('canvas');c.width=375;c.height=812;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(a,0,0);const ap=ctx.getImageData(0,0,375,812).data;ctx.clearRect(0,0,375,812);ctx.drawImage(b,0,0,375,812);const bp=ctx.getImageData(0,0,375,812).data;
   const metrics=(0,eval)(`(${compare})`)(ap,bp);ctx.globalAlpha=.5;ctx.drawImage(a,0,0);return {...metrics,overlay:c.toDataURL('image/png')};
  },{actualUrl,referenceUrl,compare:comparePixels.toString()});
  await writeFile(path.join(root,'overlays',actual),Buffer.from(result.overlay.split(',')[1],'base64'));delete result.overlay;formal.push({actual,reference,actualSha256:imageHash(await readFile(path.join(root,'actual',actual))),referenceSha256:imageHash(await readFile(path.join(root,'reference',reference))),...result});
  console.log(`${actual}: ${result.status} MAE=${result.meanAbsoluteError.toFixed(6)} changed=${result.changedPixelRatio.toFixed(6)}`);
 }}finally{await browser.close();}
 const pending=['/register','/billing','/app-detail/[id]:secondary','/community/[id]'].map(route=>({route,status:'VISUAL_PENDING'}));
 const native={ios:{status:'NOT_RUN',prerequisite:'Maestro executable and booted matching cn.elliotttzhang.intellideploy build required; installed react-native-svg native FeMorphology is unimplemented, so negative-spread source shadows require native rendering support'},android:{status:'NOT_RUN',prerequisite:'Maestro executable and connected matching cn.elliotttzhang.intellideploy build required; installed react-native-svg native FeMorphology is unimplemented, so negative-spread source shadows require native rendering support'}};
 await writeFile(path.join(root,'visual-report.json'),JSON.stringify({thresholds:{meanAbsoluteError:.08,changedPixelRatio:.03,channelDelta:32},mask:'status bar y<44; outer 5pt edge; bottom 40pt device-frame corners only',formal,pending,native},null,2)+'\n');if(formal.some(p=>p.status!=='PASS'))process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname)await main();
