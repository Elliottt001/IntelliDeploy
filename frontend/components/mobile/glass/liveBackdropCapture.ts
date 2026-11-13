// Single-flight capture ownership, independent of RN/Skia so late result and
// disposal behavior can be verified without claiming device rendering.
export function liveBackdropCapture<T extends {dispose():void}>(capture:()=>Promise<T|null>,publish:(image:T|null)=>void){
 let active=true,busy=false,generation=0,current:T|null=null,dirty=false;
 const invalidate=()=>{generation++;dirty=true;};
 const update=async()=>{
  if(!active)return;if(busy){invalidate();return;}busy=true;dirty=false;
  const started=generation;
  try{
   const image=await capture();
   if(!active||started!==generation){image?.dispose();return;}
   const old=current;current=image;publish(image);old?.dispose();
  }finally{busy=false;if(active&&dirty)void update();}
 };
 return {update,invalidate,stop(){active=false;generation++;publish(null);current?.dispose();current=null;},get busy(){return busy;}};
}
