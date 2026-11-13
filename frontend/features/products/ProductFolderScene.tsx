import type {PropsWithChildren} from 'react';
export type ProductFolderSceneProps=PropsWithChildren<{width:number;height:number;sourceHeight:number;viewBoxY:number;items:readonly {id:string;name:string}[];presentation:number;back:string;front:string}>;
export function ProductFolderScene({children}:ProductFolderSceneProps){return <>{children}</>;}
