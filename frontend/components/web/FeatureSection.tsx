import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { landingThemeTokens, type LandingTheme } from './landingTheme';

interface FeatureSectionProps {
  theme: LandingTheme;
  tag?: string;
  title: string;
  description: string;
  buttonText: string;
  image: any;
  reverse?: boolean;
  onPress?: () => void;
}

const FeatureSection: React.FC<FeatureSectionProps> = ({
  theme,
  tag = 'Our Features',
  title,
  description,
  buttonText,
  image,
  reverse = false,
  onPress,
}) => {
  const colors = landingThemeTokens[theme];
  const isDark = theme === 'dark';

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: isDark ? colors.border : 'rgba(200, 200, 220, 0.5)',
        },
        Platform.OS === 'web'
          ? ({
              background: isDark
                ? 'linear-gradient(180deg, rgba(16,20,41,0.98) 0%, rgba(11,14,31,0.92) 100%)'
                : 'linear-gradient(220deg, rgba(238, 242, 255, 0.88) 0%, rgba(245, 243, 255, 0.94) 42%, rgba(255, 255, 255, 0.98) 100%)',
              boxShadow: isDark
                ? '0px 30px 80px rgba(2, 6, 20, 0.38)'
                : '0px 16px 40px rgba(155, 165, 210, 0.08)',
            } as any)
          : { backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.row, reverse ? styles.rowReverse : undefined]}>
        <View style={styles.textArea}>
          <View
            style={[
              styles.tagPill,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(255, 255, 255, 0.4)',
                borderColor: isDark ? colors.border : '#FFFFFF',
              },
              Platform.OS === 'web'
                ? ({
                    boxShadow: isDark
                      ? '0px 10px 24px rgba(0, 0, 0, 0.18)'
                      : '0px 4px 12px rgba(0, 0, 0, 0.06)',
                  } as any)
                : {},
            ]}
          >
            <Text style={[styles.tagText, { color: colors.textSecondary }, webStyles.tagText]}>
              {tag}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }, webStyles.title]}>
            {title}
          </Text>

          <Text
            style={[styles.description, { color: colors.textSecondary }, webStyles.description]}
          >
            {description}
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[
              styles.ctaButton,
              {
                backgroundColor: colors.accent,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF',
              },
              Platform.OS === 'web'
                ? ({
                    boxShadow: isDark
                      ? '0px 10px 32px rgba(140, 118, 255, 0.26)'
                      : '0px 6px 20px rgba(124, 98, 255, 0.35)',
                    cursor: 'pointer',
                  } as any)
                : {},
            ]}
          >
            <Text style={[styles.ctaButtonText, webStyles.ctaButtonText]}>
              {buttonText.toUpperCase()}
            </Text>
            <View
              style={[
                styles.ctaExperiencePill,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF',
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.ctaExperienceText,
                  { color: isDark ? '#F5F7FF' : '#404040' },
                  webStyles.ctaExperienceText,
                ]}
              >
                现在体验！
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.imageArea}>
          <Image source={image} style={styles.featureImage} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%' as any,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 56,
    gap: 40,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textArea: {
    flex: 1,
    gap: 24,
  },
  tagPill: {
    alignSelf: 'flex-start',
    borderWidth: 1.4,
    borderRadius: 140,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  tagText: {
    fontSize: 19,
    fontWeight: '500',
  },
  title: {
    fontSize: 50,
    fontWeight: '600',
    letterSpacing: -1,
  },
  description: {
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 42,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 100,
    paddingLeft: 28,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 16,
    marginTop: 8,
  },
  ctaButtonText: {
    fontSize: 19,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ctaExperiencePill: {
    borderRadius: 40,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  ctaExperienceText: {
    fontSize: 19,
  },
  imageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureImage: {
    width: '100%' as any,
    height: 400,
  },
});

const webStyles = {
  tagText:
    Platform.OS === 'web'
      ? ({
          fontFamily: '"Inter", sans-serif',
        } as any)
      : {},
  title:
    Platform.OS === 'web'
      ? ({
          fontFamily: '"Inter", sans-serif',
          letterSpacing: '-0.02em',
        } as any)
      : {},
  description:
    Platform.OS === 'web'
      ? ({
          fontFamily: '"Inter", sans-serif',
          lineHeight: '1.76em',
        } as any)
      : {},
  ctaButtonText:
    Platform.OS === 'web'
      ? ({
          fontFamily: '"Geist", sans-serif',
          textTransform: 'uppercase',
        } as any)
      : {},
  ctaExperienceText:
    Platform.OS === 'web'
      ? ({
          fontFamily: '"Geist", sans-serif',
        } as any)
      : {},
};

export default FeatureSection;
