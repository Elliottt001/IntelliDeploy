import type {FigmaTreeNode} from '../FigmaTree';
import type {FigmaVectorLayer} from '../../../design/figmaComponentEvidence';
import type {GlassSourceNode,RawShellPaint} from './sourceGlassModel';
const identity={m00:1,m01:0,m02:0,m10:0,m11:1,m12:0};
const hex=(c:NonNullable<RawShellPaint['color']>)=>`#${[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')}`;
export function sourceShellNode(source:GlassSourceNode,id:string,transform?:string):FigmaTreeNode{
 const geometry:FigmaVectorLayer[]=[];
 for(const [paths,paints] of [[source.paths,source.fillPaints],[source.strokePaths,source.strokePaints]] as const){
  for(const paint of paints??[]){if(paint.visible===false)continue;
   const m=paint.transform;
   for(const path of paths??[])geometry.push({...path,sourceNodeId:id as `${number}:${number}`,opacity:(paint.opacity??1)*(paint.color?.a??1),fill:paint.color?hex(paint.color):undefined,paint:{type:paint.type as NonNullable<FigmaVectorLayer['paint']>['type'],opacity:paint.opacity??1,variableIds:[],transform:m?`matrix(${m.m00} ${m.m10} ${m.m01} ${m.m11} ${m.m02} ${m.m12})`:undefined,gradientStops:paint.stops?.map(stop=>({color:hex(stop.color),opacity:stop.color.a,position:stop.position,variableIds:[]}))}});
  }
 }
 const values=transform?.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number);
 const matrix=values?{m00:values[0],m10:values[1],m01:values[2],m11:values[3],m02:values[4],m12:values[5]}:identity;
 const base={size:source.size,transform:identity,opacity:1,visible:true,clipsContent:false,mask:false,booleanOperation:false,maskPaths:[],geometry:[],effects:[],children:[]};
 return {...base,sourceNodeId:'source-shared-shell',children:[{...base,sourceNodeId:id,transform:matrix,geometry,effects:source.effects}]};
}
