import { Pressable, StyleSheet, Text, View } from 'react-native';

import { darkTokens, lightLayout, lightTokens } from './mainHomeTokens';
import type { BottomNavItem, MainHomeNavId, MainHomeTheme } from './mainHomeTypes';

const lightItems: BottomNavItem[] = [
  { id: 'home', label: '首页', icon: '⌂' },
  { id: 'apps', label: '应用', icon: '▦' },
  { id: 'square', label: '广场', icon: '◎' },
  { id: 'profile', label: '我的', icon: '♙' },
];

const darkItems: BottomNavItem[] = [
  { id: 'home', label: '首页', icon: '⌂' },
  { id: 'apps', label: '分类', icon: '▦' },
  { id: 'square', label: '发现', icon: '◎' },
  { id: 'profile', label: '我的', icon: '♙' },
];

type MainHomeBottomNavProps = {
  theme: MainHomeTheme;
  activeTab: MainHomeNavId;
  onSelect: (id: MainHomeNavId) => void;
};

export default function MainHomeBottomNav({ theme, activeTab, onSelect }: MainHomeBottomNavProps) {
  const isDark = theme === 'dark';
  const items = isDark ? darkItems : lightItems;

  return (
    <View style={isDark ? styles.darkNav : styles.lightNav}>
      {items.map((item) => {
        const active = activeTab === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              isDark ? styles.darkItem : styles.lightItem,
              active && (isDark ? styles.darkItemActive : styles.lightItemActive),
              pressed && styles.pressed,
            ]}
          >
            <Text style={[isDark ? styles.darkIcon : styles.lightIcon, active && (isDark ? styles.darkActive : styles.lightActive)]}>
              {item.icon}
            </Text>
            <Text style={[isDark ? styles.darkLabel : styles.lightLabel, active && (isDark ? styles.darkActive : styles.lightActive)]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lightNav: {
    position: 'absolute',
    left: lightLayout.bottomNav.left,
    top: lightLayout.bottomNav.top,
    width: lightLayout.bottomNav.width,
    height: lightLayout.bottomNav.height,
    borderRadius: lightTokens.radii.nav,
    borderWidth: 1.3,
    borderColor: lightTokens.colors.white,
    backgroundColor: lightTokens.colors.glass,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...lightTokens.shadow.soft,
    zIndex: 100,
    elevation: 12,
  },
  lightItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: lightTokens.colors.white,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    ...lightTokens.shadow.soft,
  },
  lightItemActive: {
    backgroundColor: lightTokens.colors.primary,
    ...lightTokens.shadow.purple,
  },
  lightIcon: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 15,
  },
  lightLabel: {
    color: '#6B7280',
    fontSize: lightTokens.typography.navLabel,
  },
  darkNav: {
    height: 63,
    borderTopWidth: 1,
    borderTopColor: darkTokens.colors.border,
    backgroundColor: darkTokens.colors.background,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  darkItem: {
    width: 46,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  darkItemActive: {},
  darkIcon: {
    color: darkTokens.colors.dim,
    fontSize: 18,
    lineHeight: 20,
  },
  darkLabel: {
    color: darkTokens.colors.dim,
    fontSize: darkTokens.typography.navLabel,
    lineHeight: 16,
  },
  lightActive: {
    color: lightTokens.colors.white,
  },
  darkActive: {
    color: darkTokens.colors.primary,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
});
