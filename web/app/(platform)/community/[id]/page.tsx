import {CommunityDetail} from '@/components/Community';
import {publicApi} from '@/lib/community';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const{id}=await params;const p=await publicApi.getPublication(id).catch(()=>null);return {title:p?`${p.name} · IntelliDeploy`:'应用社区 · IntelliDeploy',description:p?.summary};}
export default async function Detail({params}:{params:Promise<{id:string}>}){const{id}=await params;const initial=await publicApi.getPublication(id).catch(()=>null);return <CommunityDetail id={id} initial={initial}/>;}
