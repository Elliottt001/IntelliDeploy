import type {Segment} from './nativeGlassShader';
export function sourcePathSegments(commands:readonly (readonly number[])[]):Segment[]{
 const segments:Segment[]=[];let x=0,y=0,sx=0,sy=0;
 const line=(nx:number,ny:number)=>{segments.push([x,y,nx,ny]);x=nx;y=ny;};
 for(const c of commands){
  if(c[0]===0){x=sx=c[1];y=sy=c[2];}
  else if(c[0]===1)line(c[1],c[2]);
  else if(c[0]===5)line(sx,sy);
  else{const px=x,py=y;for(let i=1;i<=24;i++){const t=i/24,u=1-t;
   if(c[0]===2)line(u*u*px+2*u*t*c[1]+t*t*c[3],u*u*py+2*u*t*c[2]+t*t*c[4]);
   else if(c[0]===4)line(u*u*u*px+3*u*u*t*c[1]+3*u*t*t*c[3]+t*t*t*c[5],u*u*u*py+3*u*u*t*c[2]+3*u*t*t*c[4]+t*t*t*c[6]);
   else if(c[0]===3){const w=c[5],den=u*u+2*w*u*t+t*t;line((u*u*px+2*w*u*t*c[1]+t*t*c[3])/den,(u*u*py+2*w*u*t*c[2]+t*t*c[4])/den);}
  }}
 }
 return segments;
}
