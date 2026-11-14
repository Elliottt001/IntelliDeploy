import {getSourceMotion} from '../../design/sourceMotionEvidence';
import type {HomeCardKey} from './homeContent';
export function getHomeMiboMotion({avatarHovered=false,avatarPressed=false,avatarSourceNodeId,cloudPressed=false,cloudSourceNodeId,expandedCard}: {avatarHovered?:boolean;avatarPressed?:boolean;avatarSourceNodeId?:string;cloudPressed?:boolean;cloudSourceNodeId?:string;expandedCard?:HomeCardKey|null}){
 const owner=avatarHovered||avatarPressed||avatarSourceNodeId==='188:16338'?'188:16337'
  :cloudPressed||cloudSourceNodeId==='188:16981'||cloudSourceNodeId==='188:16759'?'188:16805'
  :({store:'268:22950',products:'268:23284',community:'268:23618',profile:'268:23952'} as Record<string,string>)[expandedCard??'']??'266:21193';
 return getSourceMotion(owner,'ON_CLICK');
}
