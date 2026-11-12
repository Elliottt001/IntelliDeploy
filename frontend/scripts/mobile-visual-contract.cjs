const {createHash}=require('node:crypto');
const pairs = [['login',1],['home',2],['store',3],...[29,30,31,32,33,34,35].map(n=>['home',n]),['store',40],...[46,47,48,49,50,51,52,53,54,55,58].map(n=>['chatbot',n]),['products',56],['products',57],['community',59],['community',60]].map(([family,n])=>[`${family}-page-${String(n).padStart(2,'0')}.png`,`page-${String(n).padStart(2,'0')}.png`]);
function comparePixels(a,b,width=375,height=812) {
  let absolute=0,changed=0,compared=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const bottomCorner=y>height-40&&((x<40&&Math.hypot(x-40,y-(height-40))>40)||(x>width-40&&Math.hypot(x-(width-40),y-(height-40))>40));
    if(y<44||x<5||x>=width-5||y>=height-5||bottomCorner)continue;
    const i=(y*width+x)*4,dr=Math.abs(a[i]-b[i]),dg=Math.abs(a[i+1]-b[i+1]),db=Math.abs(a[i+2]-b[i+2]);
    absolute+=dr+dg+db;changed+=Math.max(dr,dg,db)>32?1:0;compared++;
  }
  const meanAbsoluteError=absolute/(compared*3*255),changedPixelRatio=changed/compared;
  return {meanAbsoluteError,changedPixelRatio,comparedPixels:compared,status:meanAbsoluteError<=.08&&changedPixelRatio<=.03?'PASS':'FAIL'};
}
function assertVisualApproval(report) {
 if(report.formal?.length!==26)throw Error('Baseline approval requires all 26 formal comparisons');
 for(const [actual,reference]of pairs){
  const rows=report.formal.filter(row=>row.actual===actual&&row.reference===reference);
  if(rows.length!==1||rows[0].status!=='PASS'||!(rows[0].meanAbsoluteError<=.08)||!(rows[0].changedPixelRatio<=.03))throw Error(`Baseline approval requires strict PASS for ${actual}`);
 }
}
const imageHash=bytes=>createHash('sha256').update(bytes).digest('hex');

module.exports={pairs,comparePixels,assertVisualApproval,imageHash};
