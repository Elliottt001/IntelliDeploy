import '../global.css';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { authAPI } from '../services/api';

const PUBLIC_ROUTES = new Set(['/login', '/register']);

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const token = await authAPI.getToken();
      if (!token) {
        setIsAuthenticated(false);
        return false;
      }

      await authAPI.getMe();
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.warn('Auth check failed', error);
      await authAPI.clearToken();
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      await checkAuth();
      if (isMounted) {
        setIsCheckingAuth(false);
      }
    }

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [checkAuth]);

  useEffect(() => {
    let isMounted = true;

    async function enforceAuth() {
      if (isCheckingAuth) {
        return;
      }

      const isPublicRoute = PUBLIC_ROUTES.has(pathname);

      if (isPublicRoute) {
        if (isAuthenticated) {
          router.replace('/');
        }
        return;
      }

      if (isAuthenticated) {
        return;
      }

      setIsCheckingAuth(true);
      const hasValidSession = await checkAuth();
      if (!isMounted) {
        return;
      }

      setIsCheckingAuth(false);
      if (!hasValidSession) {
        router.replace('/login');
      }
    }

    enforceAuth();

    return () => {
      isMounted = false;
    };
  }, [checkAuth, isAuthenticated, isCheckingAuth, pathname, router]);

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const isRedirectingToLogin = !isCheckingAuth && !isAuthenticated && !isPublicRoute;
  const shouldShowAuthOverlay = !isPublicRoute && (isCheckingAuth || isRedirectingToLogin);


  const [fontsLoaded] = useFonts({
    ZiTiQuanWeiJunHei: require('../assets/fonts/ZiTiQuanWeiJunHei-W3.ttf'),
    AlibabaPuHuiTiThin: require('../assets/fonts/Alibaba_PuHuiTi_2.0_35_Thin_35_Thin.ttf'),
    AlibabaPuHuiTiLight: require('../assets/fonts/Alibaba_PuHuiTi_2.0_45_Light_45_Light.ttf'),
    AlibabaPuHuiTiRegular: require('../assets/fonts/Alibaba_PuHuiTi_2.0_55_Regular_55_Regular.ttf'),
    AlibabaPuHuiTiSemiBold: require('../assets/fonts/Alibaba_PuHuiTi_2.0_75_SemiBold_75_SemiBold.ttf'),
    AlibabaPuHuiTiBold: require('../assets/fonts/Alibaba_PuHuiTi_2.0_55_Regular_85_Bold.ttf'),
  });

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
        <Stack.Screen name="app-gallery" options={{ title: 'App Gallery' }} />
        <Stack.Screen name="chatbot" options={{ title: 'Mibo AI Chatbot', headerShown: false }} />
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
