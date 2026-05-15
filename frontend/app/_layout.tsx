import { Stack, usePathname, useRouter } from 'expo-router';
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
  const isRedirectingToHome = !isCheckingAuth && isAuthenticated && isPublicRoute;

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

      {(isCheckingAuth || isRedirectingToLogin || isRedirectingToHome) && (
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
