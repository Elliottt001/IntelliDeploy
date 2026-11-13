import '../../global.css';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { mobileFontAssets } from '../../theme/fonts';

export default function ComponentFixtureLayout() {
  const [fontsLoaded] = useFonts(mobileFontAssets);
  if (!fontsLoaded) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF3FF' }}><ActivityIndicator color="#7C62FF" size="large" /></View>;
  }
  return <SafeAreaProvider><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>;
}
