import { Stack } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, StatusBar as NativeStatusBar } from 'react-native';

const nativeFlyTransition =
  Platform.OS === 'web'
    ? {}
    : {
        animation: 'slide_from_bottom' as const,
        animationDuration: 600,
        gestureDirection: 'vertical' as const,
      };

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const hideNativeStatusBar = () => {
      const hideStatusBar = () => {
        NativeStatusBar.setHidden(true, 'none');
        NativeStatusBar.setTranslucent(true);
        NativeStatusBar.setBackgroundColor('transparent', false);
      };

      hideStatusBar();
      NavigationBar.setVisibilityAsync('hidden')
        .then(hideStatusBar)
        .catch(hideStatusBar);
      setTimeout(hideStatusBar, 120);
      setTimeout(hideStatusBar, 360);
    };

    hideNativeStatusBar();
    const firstPass = setTimeout(hideNativeStatusBar, 80);
    const secondPass = setTimeout(hideNativeStatusBar, 320);
    const appStateSubscription = AppState.addEventListener('change', hideNativeStatusBar);
    const guard = setInterval(hideNativeStatusBar, 500);

    return () => {
      clearTimeout(firstPass);
      clearTimeout(secondPass);
      clearInterval(guard);
      appStateSubscription.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" hidden translucent backgroundColor="transparent" />
      <Stack
        initialRouteName={Platform.OS === 'web' ? 'index' : 'splash'}
        screenOptions={{
          ...nativeFlyTransition,
          statusBarHidden: Platform.OS !== 'web',
          statusBarTranslucent: true,
          statusBarBackgroundColor: 'transparent',
          statusBarStyle: 'dark',
          headerStyle: { backgroundColor: '#4A90D9' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen
          name="splash"
          options={{
            title: '启动',
            headerShown: false,
          }}
        />
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
        <Stack.Screen name="my-products" options={{ title: '我的产品' }} />
        <Stack.Screen name="square" options={{ title: '广场' }} />
        <Stack.Screen name="chatbot" options={{ title: 'Mibo ChatBot' }} />
      </Stack>
    </>
  );
}
