import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { landingThemeTokens, type LandingTheme } from './landingTheme';

const miboCatHero = require('../../assets/images/mibo-cat-hero.png');
const atmosphereBg = require('../../assets/images/atmosphere-bg.png');

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const existingStyleTag = document.getElementById('breathing-glow-keyframes');

  if (!existingStyleTag) {
    const styleTag = document.createElement('style');
    styleTag.id = 'breathing-glow-keyframes';
    styleTag.textContent = `
      @keyframes breathingGlow {
        0%, 100% {
          opacity: 1;
          box-shadow: 0 0 6px 2px rgba(54, 255, 171, 0.4);
        }
        50% {
          opacity: 0.5;
          box-shadow: 0 0 14px 6px rgba(54, 255, 171, 0.7);
        }
      }
    `;
    document.head.appendChild(styleTag);
  }
}

interface HeroSectionProps {
  theme: LandingTheme;
}

export default function HeroSection({ theme }: HeroSectionProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const colors = landingThemeTokens[theme];
  const isDark = theme === 'dark';

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <Image
        source={atmosphereBg}
        style={[styles.atmosphereBg, isDark && styles.atmosphereBgDark]}
        resizeMode="cover"
      />

      {Platform.OS === 'web' && (
        <View style={styles.waveDecorationsContainer}>
          <View
            style={[
              styles.waveDecoration,
              {
                background: isDark
                  ? 'radial-gradient(ellipse at 20% 50%, rgba(132,115,255,0.28) 0%, transparent 72%)'
                  : 'radial-gradient(ellipse at 20% 50%, rgba(164,150,255,0.12) 0%, transparent 70%)',
                top: 0,
                left: 0,
                right: 0,
                height: 400,
              } as any,
            ]}
          />
          <View
            style={[
              styles.waveDecoration,
              {
                background: isDark
                  ? 'radial-gradient(ellipse at 80% 30%, rgba(113,146,255,0.22) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse at 80% 30%, rgba(175,201,246,0.10) 0%, transparent 70%)',
                top: 100,
                left: 0,
                right: 0,
                height: 350,
              } as any,
            ]}
          />
          <View
            style={[
              styles.waveDecoration,
              {
                background: isDark
                  ? 'radial-gradient(ellipse at 50% 80%, rgba(188,143,255,0.18) 0%, transparent 60%)'
                  : 'radial-gradient(ellipse at 50% 80%, rgba(124,98,255,0.06) 0%, transparent 60%)',
                top: 200,
                left: 0,
                right: 0,
                height: 300,
              } as any,
            ]}
          />
        </View>
      )}

      <View style={styles.content}>
        <View
          style={[
            styles.titleHalo,
            isDark ? styles.titleHaloDark : styles.titleHaloLight,
          ]}
        />

        <Text
          style={[
            styles.title,
            Platform.OS === 'web'
              ? ({
                  backgroundImage: isDark
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(169,148,255,0.86) 58%, rgba(92,103,255,0.12) 100%)'
                    : 'linear-gradient(0deg, rgba(175,201,246,0) 13%, rgba(164,150,255,1) 58%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: isDark ? '0px 8px 32px rgba(140, 118, 255, 0.18)' : 'none',
                } as any)
              : { color: isDark ? '#F5F7FF' : '#A496FF' },
          ]}
        >
          IntelliDeploy
        </Text>

        <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
          {'欢迎来到知界！\n一键变代码为云上产品 享受你的专属灵感落地加速器'}
        </Text>

        <View
          style={[
            styles.ctaButton,
            {
              borderColor: isDark ? 'rgba(156, 139, 255, 0.35)' : '#7C62FF',
              backgroundColor: isDark
                ? 'rgba(15, 18, 40, 0.72)'
                : 'rgba(255, 255, 255, 0.42)',
            },
            Platform.OS === 'web'
              ? ({
                  boxShadow: isDark
                    ? '0px 20px 44px rgba(3, 6, 18, 0.35)'
                    : '0px 10px 24px rgba(124, 98, 255, 0.08)',
                } as any)
              : {},
          ]}
        >
          <View style={styles.ctaInner}>
            {Platform.OS === 'web' ? (
              <View
                style={[
                  styles.greenDot,
                  {
                    animationName: 'breathingGlow',
                    animationDuration: '2.4s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                  },
                ] as any}
              />
            ) : (
              <Animated.View style={[styles.greenDot, { opacity: pulseAnim }]} />
            )}
            <Text style={[styles.ctaText, { color: colors.textPrimary }]}>
              点击你的Mibo 开始今天的探索🚀
            </Text>
          </View>
        </View>

        <Image source={miboCatHero} style={styles.miboCat} resizeMode="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%' as any,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  atmosphereBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%' as any,
    height: '100%' as any,
    opacity: 0.6,
  },
  atmosphereBgDark: {
    opacity: 0.28,
  },
  waveDecorationsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  waveDecoration: {
    position: 'absolute',
  },
  content: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 24,
    zIndex: 1,
    width: '100%' as any,
  },
  titleHalo: {
    position: 'absolute',
    top: 30,
    width: 760,
    height: 300,
    borderRadius: 999,
  },
  titleHaloLight: {
    backgroundColor: 'rgba(164, 150, 255, 0.08)',
  },
  titleHaloDark: {
    backgroundColor: 'rgba(131, 104, 255, 0.22)',
  },
  title: {
    fontSize: Platform.OS === 'web' ? 120 : 64,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 32,
    fontFamily: Platform.OS === 'web' ? "'PingFang SC', sans-serif" : undefined,
    textAlign: 'center',
    lineHeight: 48,
    marginBottom: 40,
  },
  ctaButton: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 48,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#36FFAB',
    marginRight: 10,
  },
  ctaText: {
    fontSize: 20,
    fontFamily: Platform.OS === 'web' ? "'PingFang SC', sans-serif" : undefined,
  },
  miboCat: {
    width: 320,
    height: 320,
  },
});
