import {useLocalSearchParams} from 'expo-router';
import PublicationScreen from '../../screens/community/PublicationScreen';
export default function Page(){const{id}=useLocalSearchParams<{id:string}>();return <PublicationScreen id={id}/>;}
