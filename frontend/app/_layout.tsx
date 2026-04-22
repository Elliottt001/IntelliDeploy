import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#4A90D9' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'IntelliDeploy',
          headerShown: Platform.OS !== 'web',
        }}
      />
      <Stack.Screen name="login" options={{ title: '登录' }} />
      <Stack.Screen name="register" options={{ title: '注册' }} />
      {/* tabs 容器，headerShown: false 让各 tab 自己管 header */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
