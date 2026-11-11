import '../global.css';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';
import { isPublicPath } from '../features/navigation/routePolicy';
import { authAPI } from '../services/api';
import { mobileFontAssets } from '../theme/fonts';

if (Platform.OS !== 'web') {
  LogBox.ignoreLogs(['Some of the used filters are not yet supported on native platforms']);
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      try {
        const token = await authAPI.getToken();
        if (isMounted) {
          setIsAuthenticated(Boolean(token));
        }
      } catch {
        console.warn('Auth bootstrap failed');
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    bootstrapAuth();

    const unsubscribe = authAPI.subscribe((token) => {
      if (isMounted) {
        setIsAuthenticated(Boolean(token));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    const isPublicRoute = isPublicPath(pathname);

    if (isPublicRoute) {
      return;
    }

    if (!isAuthenticated) {
      router.replace({ pathname: '/login', params: { next: pathname } });
    }
  }, [isAuthenticated, isCheckingAuth, pathname, router]);

  const isPublicRoute = isPublicPath(pathname);
  const shouldShowAuthOverlay = isCheckingAuth && !isPublicRoute;


  const [fontsLoaded] = useFonts(mobileFontAssets);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#EFF3FF',
        }}
      >
        <ActivityIndicator color="#7C62FF" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        <Stack.Screen name="store" options={{ title: '应用商店', headerShown: false }} />
        <Stack.Screen name="store/ranking" options={{ title: '热门榜单', headerShown: false }} />
        <Stack.Screen name="app-gallery" options={{ title: 'App Gallery' }} />
        <Stack.Screen name="chatbot" options={{ title: 'Mibo', headerShown: false }} />
        <Stack.Screen name="app-detail/[id]" options={{ title: '应用与对话', headerShown: false }} />
        <Stack.Screen name="billing" options={{ title: '额度与用量', headerShown: false }} />
      </Stack>

      {shouldShowAuthOverlay && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#EFF3FF',
          }}
        >
          <ActivityIndicator color="#7C62FF" size="large" />
        </View>
      )}
    </View>
  );
}
