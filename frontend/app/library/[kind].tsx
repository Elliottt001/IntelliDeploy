import {useLocalSearchParams} from 'expo-router';
import CommunityScreen from '../../screens/community/CommunityScreen';
export default function Page(){const{kind}=useLocalSearchParams<{kind:string}>();return <CommunityScreen library={kind==='favorites'?'favorites':'recent'}/>;}
