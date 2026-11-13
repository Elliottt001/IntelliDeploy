// Independent test oracle: invert authored cubic x, evaluate its y, then bound
// travel in the recorded paint interval. This does not change runtime motion.
export function sourceCubicTravelBound(tuple:readonly number[],durationMs:number,distance:number,intervalMs:number){
 if(tuple.length!==4||durationMs<=0||intervalMs<0)throw Error('Invalid source cubic bounds');
 const [x1,y1,x2,y2]=tuple,span=Math.min(1,intervalMs/durationMs);
 const cubic=(t:number,a:number,b:number)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
 const sample=(x:number)=>{let lo=0,hi=1;for(let i=0;i<32;i++){const t=(lo+hi)/2;if(cubic(t,x1,x2)<x)lo=t;else hi=t;}return cubic((lo+hi)/2,y1,y2);};
 let bound=0;for(let i=0;i<=10000;i++){const t=(1-span)*i/10000;bound=Math.max(bound,Math.abs(sample(t+span)-sample(t)));}
 return bound*Math.abs(distance);
}
