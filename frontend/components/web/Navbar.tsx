import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { landingThemeTokens, type LandingTheme } from './landingTheme';

interface NavbarProps {
  theme: LandingTheme;
  onToggleTheme: () => void;
}

function PersonIcon({ theme }: { theme: LandingTheme }) {
  const colors = landingThemeTokens[theme];

  return (
    <View
      style={[
        iconStyles.circle,
        {
          backgroundColor: colors.iconSurface,
          borderColor: colors.iconBorder,
        },
      ]}
    >
      <View
        style={[iconStyles.personHead, { backgroundColor: colors.iconForeground }]}
      />
      <View
        style={[iconStyles.personBody, { backgroundColor: colors.iconForeground }]}
      />
    </View>
  );
}

function MailIcon({ theme }: { theme: LandingTheme }) {
  const colors = landingThemeTokens[theme];

  return (
    <View
      style={[
        iconStyles.circle,
        {
          backgroundColor: colors.iconSurface,
          borderColor: colors.iconBorder,
        },
      ]}
    >
      <Text style={[iconStyles.mailEmoji, { color: colors.iconForeground }]}>✉</Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  personHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 2,
  },
  personBody: {
    width: 20,
    height: 10,
    borderRadius: 10,
  },
  mailEmoji: {
    fontSize: 16,
  },
});

export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const router = useRouter();
  const colors = landingThemeTokens[theme];
  const isDark = theme === 'dark';

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
          },
          isDark ? webStyles.containerDark : webStyles.container,
        ]}
      >
        <View style={styles.logoContainer}>
          <Text style={[styles.logoText, { color: colors.textPrimary }, webStyles.logoText]}>
            Mibo
          </Text>
        </View>

        <View style={styles.navLinks}>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[styles.navLink, { color: colors.textPrimary }, webStyles.navLink]}>
              Appstore
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[styles.navLink, { color: colors.textPrimary }, webStyles.navLink]}>
              Community
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggleTheme}
            style={[
              styles.themeToggle,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(255, 255, 255, 0.72)',
                borderColor: isDark ? colors.border : '#FFFFFF',
              },
              Platform.OS === 'web'
                ? ({
                    boxShadow: isDark
                      ? '0px 10px 32px rgba(0, 0, 0, 0.28)'
                      : '0px 6px 18px rgba(141, 141, 141, 0.18)',
                    cursor: 'pointer',
                  } as any)
                : {},
            ]}
          >
            <View
              style={[
                styles.themeThumb,
                {
                  alignSelf: isDark ? 'flex-end' : 'flex-start',
                  backgroundColor: isDark ? colors.accent : '#F6F4FF',
                },
              ]}
            >
              <Text style={styles.themeThumbText}>{isDark ? '☾' : '☼'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/login')}
          >
            <Text style={[styles.signInText, { color: colors.textMuted }, webStyles.signInText]}>
              Sign in
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signUpButton, webStyles.signUpButton]}
            activeOpacity={0.7}
            onPress={() => router.push('/register')}
          >
            <Text style={[styles.signUpText, webStyles.signUpText]}>Sign up</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} style={styles.iconButton}>
            <PersonIcon theme={theme} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} style={styles.iconButton}>
            <MailIcon theme={theme} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingHorizontal: 40,
    paddingTop: 20,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1400,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 100,
    borderWidth: 3,
  },
  logoContainer: {
    flex: 1,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
    flex: 2,
    justifyContent: 'center',
  },
  navLink: {
    fontSize: 24,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    justifyContent: 'flex-end',
  },
  themeToggle: {
    width: 68,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  themeThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeThumbText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  signInText: {
    fontSize: 18,
  },
  signUpButton: {
    backgroundColor: '#7C62FF',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 50,
  },
  signUpText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  iconButton: {
    marginLeft: 4,
  },
});

const webStyles = {
  container:
    Platform.OS === 'web'
      ? ({
          backgroundColor: 'rgba(255, 255, 255, 0.24)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0px 9px 20px rgba(141, 141, 141, 0.25)',
        } as any)
      : {
          backgroundColor: 'rgba(255, 255, 255, 0.24)',
        },
  containerDark:
    Platform.OS === 'web'
      ? ({
          backgroundColor: 'rgba(12, 16, 34, 0.78)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow: '0px 18px 44px rgba(0, 0, 0, 0.35)',
        } as any)
      : {
          backgroundColor: 'rgba(12, 16, 34, 0.78)',
        },
  logoText:
    Platform.OS === 'web'
      ? ({
          fontFamily: '"Pixelify Sans", sans-serif',
        } as any)
      : {},
  navLink:
    Platform.OS === 'web'
      ? ({
          fontFamily:
            '"PingFang SC", "Helvetica Neue", Helvetica, Arial, sans-serif',
          cursor: 'pointer',
        } as any)
      : {},
  signInText:
    Platform.OS === 'web'
      ? ({
          fontFamily:
            '"PingFang SC", "Helvetica Neue", Helvetica, Arial, sans-serif',
          cursor: 'pointer',
        } as any)
      : {},
  signUpButton:
    Platform.OS === 'web'
      ? ({
          boxShadow: '0px 4px 12px rgba(124, 98, 255, 0.4)',
          cursor: 'pointer',
        } as any)
      : {},
  signUpText:
    Platform.OS === 'web'
      ? ({
          fontFamily:
            '"PingFang SC", "Helvetica Neue", Helvetica, Arial, sans-serif',
        } as any)
      : {},
};
