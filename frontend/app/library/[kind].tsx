import { useLocalSearchParams } from 'expo-router';
import LibraryScreen from '../../features/products/LibraryScreen';
import { parseLibraryKind } from '../../features/products/productViewModel';
export default function Page() {
  const { kind } = useLocalSearchParams<{ kind: string | string[] }>();
  return <LibraryScreen kind={parseLibraryKind(kind)} />;
}
