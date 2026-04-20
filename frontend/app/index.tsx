import React, { useCallback, useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../components/Button';

// Web landing page components
import Navbar from '../components/web/Navbar';
import HeroSection from '../components/web/HeroSection';
import StatsSection from '../components/web/StatsSection';
import FeatureSection from '../components/web/FeatureSection';
import TestimonialSection from '../components/web/TestimonialSection';
import PricingSection from '../components/web/PricingSection';
import Footer from '../components/web/Footer';

const featureChatImage = require('../assets/images/feature-chat.png');
const featureAppstoreImage = require('../assets/images/feature-appstore.png');
const featureCommunity1Image = require('../assets/images/feature-community1.png');

function WebHome() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hasManualTheme, setHasManualTheme] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (matchesDark: boolean) => {
      if (!hasManualTheme) {
        setTheme(matchesDark ? 'dark' : 'light');
      }
    };

    applyTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [hasManualTheme]);

  const handleToggleTheme = useCallback(() => {
    setHasManualTheme(true);
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const isDark = theme === 'dark';

  return (
    <ScrollView
      style={[webStyles.scrollView, isDark && webStyles.scrollViewDark]}
      contentContainerStyle={webStyles.scrollContent}
    >
      <View style={[webStyles.page, isDark && webStyles.pageDark]}>
        <Navbar theme={theme} onToggleTheme={handleToggleTheme} />
        <HeroSection theme={theme} />
        <StatsSection theme={theme} />

        <View style={webStyles.featuresContainer}>
          <FeatureSection
            theme={theme}
            title="领养你的专属Mibo 沉浸式vibecoding"
            description="Mibo是知界独有的电子宠物，也是个人专属的coding助手。你可以定制ta的形象、给ta分发任务，在这里，你与ta共成长。"
            buttonText="Mibo ChatBot"
            image={featureChatImage}
          />
          <FeatureSection
            theme={theme}
            title="各种有趣的开源项目一网打尽 打造专属项目库"
            description="地毯式集成了市面上优秀的开源项目，并打包集成为Appstore中的微软件，实现一键部署、即刻使用。你可以将软件下载到自己的库中，打造个人项目库！"
            buttonText="App Store"
            image={featureAppstoreImage}
            reverse
          />
          <FeatureSection
            theme={theme}
            title="社区乐园为用户提供交流机会 你的声音值得被听见"
            description="用户可以以个人身份在广场上发帖交流，包括但不限于求助、答疑、求资源、学知识，这里链接了有创意的用户和有技术的大牛，实现灵感与价值的转化。"
            buttonText="Community"
            image={featureCommunity1Image}
          />
        </View>

        <TestimonialSection theme={theme} />
        <PricingSection theme={theme} />
        <Footer theme={theme} />
      </View>
    </ScrollView>
  );
}

function MobileHome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>IntelliDeploy</Text>
        <Text style={styles.subtitle}>智能部署平台</Text>
        <Text style={styles.description}>
          一站式智能部署解决方案，让您的应用部署更加简单高效
        </Text>

        <View style={styles.buttonGroup}>
          <Button
            title="登录"
            onPress={() => router.push('/login')}
            style={styles.button}
          />
          <Button
            title="注册"
            onPress={() => router.push('/register')}
            variant="secondary"
            style={styles.button}
          />
        </View>
      </View>
    </View>
  );
}

export default function Home() {
  if (Platform.OS === 'web') {
    return <WebHome />;
  }
  return <MobileHome />;
}

const webStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FAFBFF',
  },
  scrollViewDark: {
    backgroundColor: '#060816',
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          background:
            'linear-gradient(211deg, rgba(239, 243, 255, 1) 6%, rgba(255, 255, 255, 1) 100%)',
        } as any)
      : {}),
  },
  pageDark: {
    ...(Platform.OS === 'web'
      ? ({
          background:
            'radial-gradient(circle at top, rgba(117, 84, 255, 0.22) 0%, rgba(15, 18, 40, 0.96) 32%, rgba(6, 8, 22, 1) 74%)',
        } as any)
      : {
          backgroundColor: '#060816',
        }),
  },
  featuresContainer: {
    width: '100%' as any,
    maxWidth: 1200,
    paddingHorizontal: 24,
    gap: 60,
    paddingVertical: 60,
    alignSelf: 'center' as any,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4A90D9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
  },
});
