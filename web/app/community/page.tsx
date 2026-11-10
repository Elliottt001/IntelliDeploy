import {CommunityList} from '../../components/Community';
import {publicApi} from '../../lib/community';
export const dynamic='force-dynamic';
export const metadata={title:'应用社区 · IntelliDeploy',description:'浏览和使用社区应用，创建独立副本'};
export default async function Community(){const initial=await publicApi.listPublications().catch(()=>null);return <><h1>应用社区</h1><CommunityList initial={initial}/></>;}
