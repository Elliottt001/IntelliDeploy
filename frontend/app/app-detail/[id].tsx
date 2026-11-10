import { useLocalSearchParams } from 'expo-router';
import AppDetailScreen from '../../screens/app-detail/AppDetailScreen';

export default function AppDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AppDetailScreen appId={id} />;
}
