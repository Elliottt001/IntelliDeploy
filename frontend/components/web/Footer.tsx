import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { landingThemeTokens, type LandingTheme } from './landingTheme';

interface FooterProps {
  theme: LandingTheme;
}

export default function Footer({ theme }: FooterProps) {
  const colors = landingThemeTokens[theme];
  const isDark = theme === 'dark';

  return (
    <View
      style={[
        styles.container,
        { borderTopColor: isDark ? colors.borderSoft : 'rgba(200,200,220,0.3)' },
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.brandArea}>
            <Text
              style={[
                styles.logo,
                { color: colors.textPrimary },
                Platform.OS === 'web' && ({ fontFamily: 'Pixelify Sans, monospace' } as any),
              ]}
            >
              IntelliDeploy
            </Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(255,255,255,0.6)',
                  borderColor: isDark ? colors.border : 'rgba(200,200,220,0.5)',
                },
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  { color: colors.textPrimary },
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="帮我部署一下这个环境！"
                placeholderTextColor={colors.inputPlaceholder}
              />
              <TouchableOpacity style={styles.sendButton}>
                <Text style={styles.sendButtonText}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View
            style={[
              styles.promptArea,
              {
                backgroundColor: isDark
                  ? 'rgba(156,139,255,0.12)'
                  : 'rgba(124,98,255,0.08)',
                borderColor: isDark ? colors.border : 'transparent',
              },
            ]}
          >
            <Text style={[styles.promptText, { color: colors.accent }]}>我想做一款可以提升执行力的App！</Text>
          </View>
        </View>

        <View
          style={[
            styles.bottomRow,
            { borderTopColor: isDark ? colors.borderSoft : 'rgba(200,200,220,0.2)' },
          ]}
        >
          <Text style={[styles.copyright, { color: colors.textMuted }]}>
            IntelliDeploy © 2026. All rights reserved.
          </Text>
          <View style={styles.links}>
            <TouchableOpacity>
              <Text style={[styles.linkText, { color: colors.textMuted }]}>Terms & condition</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={[styles.linkText, { color: colors.textMuted }]}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%' as any,
    paddingVertical: 60,
    paddingHorizontal: 24,
    borderTopWidth: 1,
  },
  inner: {
    maxWidth: 1200,
    width: '100%' as any,
    alignSelf: 'center' as any,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 40,
    flexWrap: 'wrap',
    gap: 24,
  },
  brandArea: {
    flex: 1,
    minWidth: 300,
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 4,
    maxWidth: 400,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 14,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  promptArea: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
  },
  promptText: {
    fontSize: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 16,
  },
  copyright: {
    fontSize: 14,
  },
  links: {
    flexDirection: 'row',
    gap: 24,
  },
  linkText: {
    fontSize: 14,
  },
});
