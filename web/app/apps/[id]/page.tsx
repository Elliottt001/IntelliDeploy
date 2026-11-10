import AppConversation from '../../../components/AppConversation';
export default async function AppPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;return <AppConversation key={id} appId={id}/>;
}
