import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { landingThemeTokens, type LandingTheme } from './landingTheme';

interface TestimonialSectionProps {
  theme: LandingTheme;
}

const TESTIMONIALS = [
  {
    quote: [
      { text: 'Before ', bold: false },
      { text: 'Calyra', bold: true },
      { text: ', I never realized how disconnected I was from my own emotions. Days would blur together, and I couldn\'t clearly explain why I felt stressed or unmotivated. ', bold: false },
      { text: 'Calyra', bold: true },
      { text: ' helped me slow down and reflect in a simple, structured way. Seeing my moods visualized over weeks and months made a huge difference in understanding my triggers. The app feels thoughtful, easy to use, and non-judgmental, which makes it something I genuinely want to return to every day.', bold: false },
    ],
    author: '本期小编：Alice',
    role: 'Project Manager at Brightwave Solutions',
  },
];

const GRADIENT_TEXT = 'linear-gradient(90deg, #6D8EFF 0%, #A393FF 50%, #FFC58A 100%)';

const supportsGradientTextOnWeb = () => {
  if (Platform.OS !== 'web') return false;
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;

  const supportsGradient = CSS.supports('background-image', 'linear-gradient(90deg, #000, #fff)');
  const supportsClip =
    CSS.supports('-webkit-background-clip', 'text') ||
    CSS.supports('background-clip', 'text');
  const supportsTextFill =
    CSS.supports('-webkit-text-fill-color', 'transparent') ||
    CSS.supports('color', 'transparent');

  return supportsGradient && supportsClip && supportsTextFill;
};

const getGradientTextStyle = (
  enableGradient: boolean,
  gradient: string,
  fallbackColor: string
): React.CSSProperties =>
  enableGradient
    ? {
        display: 'inline-block',
        color: 'transparent',
        backgroundImage: gradient,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
        WebkitTextFillColor: 'transparent',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
      }
    : {
        color: fallbackColor,
      };

const ArrowLeft = ({ stroke }: { stroke: string }) => (
  <svg width="29" height="29" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.7618 14.0811H4.40039" stroke={stroke} strokeWidth="2.8162" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12.321 6.16064L4.40039 14.0812L12.321 22.0018" stroke={stroke} strokeWidth="2.8162" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowRight = ({ stroke }: { stroke: string }) => (
  <svg width="29" height="29" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.40039 14.0811H23.7618" stroke={stroke} strokeWidth="2.8162" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.8408 6.16064L23.7614 14.0812L15.8408 22.0018" stroke={stroke} strokeWidth="2.8162" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const NavButton: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  outerStyle: any;
  innerStyle: any;
}> = ({ onPress, children, outerStyle, innerStyle }) => (
  <Pressable onPress={onPress} style={[styles.navOuter, outerStyle]}>
    <View style={[styles.navInner, innerStyle]}>{children}</View>
  </Pressable>
);

const TestimonialSection: React.FC<TestimonialSectionProps> = ({ theme }) => {
  const colors = landingThemeTokens[theme];
  const isDark = theme === 'dark';
  const supportsGradientText = supportsGradientTextOnWeb();
  const quoteGradient = isDark
    ? 'linear-gradient(90deg, #A6B7FF 0%, #C6B8FF 48%, #FFD0A1 100%)'
    : GRADIENT_TEXT;
  const fallbackHighlightColor = isDark ? '#D7CFFF' : colors.accent;
  const highlightStyle = getGradientTextStyle(
    supportsGradientText,
    quoteGradient,
    fallbackHighlightColor
  );
  const [index, setIndex] = useState(0);
  const current = TESTIMONIALS[index % TESTIMONIALS.length];
  const navOuterStyle = {
    borderColor: isDark ? 'rgba(214, 220, 255, 0.12)' : 'rgba(124, 98, 255, 0.18)',
    backgroundColor: isDark ? 'rgba(24, 30, 58, 0.88)' : 'rgba(124, 98, 255, 0.14)',
  };
  const navInnerStyle = {
    backgroundColor: isDark ? 'rgba(11, 16, 34, 0.94)' : 'rgba(255, 255, 255, 0.92)',
  };
  const navStroke = isDark ? '#E7EBFF' : '#4A4472';

  const prev = () => setIndex((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  const next = () => setIndex((i) => (i + 1) % TESTIMONIALS.length);

  if (Platform.OS !== 'web') {
    // Simplified mobile fallback
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={[styles.quoteTextMobile, { color: colors.textSecondary }]}>
          {current.quote.map((s) => s.text).join('')}
        </Text>
        <Text style={[styles.authorMobile, { color: colors.textPrimary }]}>{current.author}</Text>
        <Text style={[styles.roleMobile, { color: colors.textMuted }]}>{current.role}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? 'rgba(10, 14, 30, 0.98)' : colors.surface },
      ]}
    >
      {/* Background glow */}
      <div
        style={{
          ...webStyles.glowBg,
          background: isDark
            ? 'linear-gradient(90deg, #091122 0%, #0E1730 38%, #111D3A 75%, #0A1227 100%)'
            : 'linear-gradient(90deg, #EEF2FF 0%, #F5F3FF 38%, #FBF7FF 72%, #FFFFFF 100%)',
        }}
      />
      <div
        style={{
          ...webStyles.glowSpot,
          background: isDark
            ? 'radial-gradient(ellipse, rgba(140, 118, 255, 0.22) 0%, rgba(113, 146, 255, 0.12) 38%, transparent 72%)'
            : 'radial-gradient(ellipse, rgba(164, 150, 255, 0.18) 0%, rgba(175, 201, 246, 0.1) 36%, transparent 72%)',
        }}
      />

      <div style={webStyles.inner}>
        {/* Header */}
        <div style={webStyles.header}>
          <div
            style={{
              ...webStyles.badge,
              border: isDark
                ? '1.4px solid rgba(156, 139, 255, 0.42)'
                : '1.4px solid rgba(124, 98, 255, 0.3)',
              background: isDark ? 'rgba(156, 139, 255, 0.16)' : 'rgba(124, 98, 255, 0.08)',
              boxShadow: isDark
                ? '0 8px 24px 0 rgba(4, 8, 22, 0.35)'
                : '0 2.8px 4.2px 0 rgba(183,183,183,0.25)',
              color: isDark ? '#C9BEFF' : '#7C62FF',
            }}
          >
            Contacts
          </div>
          <div style={{ ...webStyles.title, color: isDark ? '#F5F7FF' : '#1F0B4C' }}>
            第15届"金咪奖"出炉：<br />《寻爪》动物爱好者的天堂
          </div>
          <div
            style={{
              ...webStyles.subtitle,
              color: isDark ? 'rgba(227, 232, 255, 0.82)' : '#353849',
            }}
          >
            每季度最瞩目的奖项出炉——来看看有什么好的项目被发掘到吧。<br />
            登上"金咪奖"，即可获得丰厚的创作者激励！
          </div>
        </div>

        {/* Testimonial row */}
        <div style={webStyles.testimonialRow}>
          <NavButton onPress={prev} outerStyle={navOuterStyle} innerStyle={navInnerStyle}>
            <ArrowLeft stroke={navStroke} />
          </NavButton>

          <div
            style={{
              ...webStyles.quoteText,
              color: isDark ? 'rgba(240, 244, 255, 0.9)' : '#272835',
            }}
          >
            {current.quote.map((seg, i) =>
              seg.bold ? (
                <span
                  key={i}
                  style={{
                    ...webStyles.quoteHighlight,
                    ...highlightStyle,
                  }}
                >
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </div>

          <NavButton onPress={next} outerStyle={navOuterStyle} innerStyle={navInnerStyle}>
            <ArrowRight stroke={navStroke} />
          </NavButton>
        </div>

        {/* Footer */}
        <div style={webStyles.footer}>
          <div style={webStyles.starsRow}>
            {[0.4, 0.4, 0.4, 0.4, 1, 0.4, 0.4, 0.4, 0.4].map((op, i) => (
              <div
                key={i}
                style={{
                  ...webStyles.starDot,
                  background:
                    op === 1
                      ? (isDark
                          ? 'linear-gradient(135deg, #D6CEFF, #8D79FF)'
                          : 'linear-gradient(135deg, #C2B8FF, #7C62FF)')
                      : (isDark
                          ? 'linear-gradient(135deg, #5B618A, #3A4167)'
                          : 'linear-gradient(135deg, #C2B8FF, #7C62FF)'),
                  opacity: op,
                  width: op === 1 ? 40 : 24,
                  height: op === 1 ? 40 : 24,
                  borderRadius: op === 1 ? 6 : 5,
                }}
              />
            ))}
          </div>
          <div style={webStyles.authorInfo}>
            <div
              style={{
                ...webStyles.authorName,
                ...highlightStyle,
              }}
            >
              {current.author}
            </div>
            <div
              style={{
                ...webStyles.authorRole,
                color: isDark ? 'rgba(202, 210, 245, 0.72)' : '#666D80',
              }}
            >
              {current.role}
            </div>
          </div>
        </div>
      </div>
    </View>
  );
};

const webStyles: Record<string, React.CSSProperties> = {
  glowBg: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, #F3F2FF 0%, #F9F8FF 40%, #FFFBFE 75%, #FFFFFF 100%)',
    pointerEvents: 'none',
  },
  glowSpot: {
    position: 'absolute',
    top: '-60px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '320px',
    height: '200px',
    background: 'radial-gradient(ellipse, rgba(255, 200, 240, 0.3) 0%, transparent 70%)',
    filter: 'blur(30px)',
    pointerEvents: 'none',
  },
  inner: {
    position: 'relative',
    width: '100%',
    maxWidth: 1100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 56,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    width: '100%',
    maxWidth: 760,
  },
  badge: {
    display: 'inline-flex',
    padding: '8px 20px',
    borderRadius: 999,
    border: '1.4px solid rgba(124, 98, 255, 0.3)',
    background: 'rgba(124, 98, 255, 0.08)',
    boxShadow: '0 2.8px 4.2px 0 rgba(183,183,183,0.25)',
    color: '#7C62FF',
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontWeight: 500,
    fontSize: 16,
    lineHeight: '24px',
  },
  title: {
    color: '#1F0B4C',
    textAlign: 'center',
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontWeight: 600,
    fontSize: 'clamp(22px, 2.8vw, 36px)',
    lineHeight: 1.5,
    letterSpacing: '-1px',
  },
  subtitle: {
    color: '#353849',
    textAlign: 'center',
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontWeight: 400,
    fontSize: 'clamp(13px, 1.2vw, 16px)',
    lineHeight: 2.2,
  },
  testimonialRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'clamp(16px, 4vw, 64px)',
    width: '100%',
  },
  quoteText: {
    flex: 1,
    maxWidth: 700,
    color: '#272835',
    textAlign: 'center',
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontWeight: 400,
    fontSize: 'clamp(14px, 1.4vw, 20px)',
    lineHeight: 1.8,
    letterSpacing: '-0.2px',
  },
  quoteHighlight: {
    fontFamily: "'Ibarra Real Nova', Georgia, serif",
    fontWeight: 600,
    fontStyle: 'italic',
    color: '#7C62FF',
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
  },
  starsRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starDot: {
    background: 'linear-gradient(135deg, #C2B8FF, #7C62FF)',
    borderRadius: 5,
  },
  authorInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    textAlign: 'center',
    fontFamily: "'Ibarra Real Nova', Georgia, serif",
    fontWeight: 600,
    fontSize: 'clamp(16px, 1.6vw, 24px)',
    lineHeight: 1.2,
    letterSpacing: '-0.8px',
    color: '#7C62FF',
  } as React.CSSProperties,
  authorRole: {
    color: '#666D80',
    textAlign: 'center',
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontWeight: 400,
    fontSize: 'clamp(12px, 1vw, 15px)',
    lineHeight: 1.5,
  },
};

const styles = StyleSheet.create({
  container: {
    width: '100%' as any,
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
    position: 'relative' as any,
    overflow: 'hidden' as any,
  },
  navOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#FFF',
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  navInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteTextMobile: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  authorMobile: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  roleMobile: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default TestimonialSection;
