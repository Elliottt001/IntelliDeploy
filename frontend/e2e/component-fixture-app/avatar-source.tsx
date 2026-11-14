import {ScrollView,View,Text} from 'react-native';
import {SourceAvatarMotion} from '../../components/mobile/SourceAvatarMotion';
// Source control owners only. No creator/post/account data or API request.
const owners=['825:6080','825:6100','825:6133','825:6153','825:6434','825:6491','825:6532','825:6588','825:6606','825:6640'];
export default function AvatarSourceFixture(){return <ScrollView><View style={{flexDirection:'row',flexWrap:'wrap'}}>{owners.map(sourceNodeId=><View key={sourceNodeId} style={{width:175,height:180,padding:10}}><Text>{sourceNodeId}</Text><SourceAvatarMotion sourceNodeId={sourceNodeId} interactive testID={`avatar-${sourceNodeId}`}/></View>)}</View></ScrollView>;}
