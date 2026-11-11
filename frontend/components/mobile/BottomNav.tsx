import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  bottomNavItems,
  getBottomNavTarget,
  type MobileNavKey,
  type MobileRoute,
} from '../../features/navigation/mobileNavigation';
import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';

type BottomNavProps = {
  active: MobileNavKey;
  onNavigate: (href: MobileRoute) => void;
  testID?: string;
};

type NavIconName = (typeof bottomNavItems)[number]['icon'];

function NavIcon({ active, name }: { active: boolean; name: NavIconName }) {
  const color = active ? '#FFFFFF' : mobileColors.text;
  const common = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };

  return (
    <Svg
      accessibilityElementsHidden
      height={18}
      viewBox="0 0 24 24"
      width={18}
    >
      {name === 'house' && (
        <>
          <Path d="m3 10.5 9-7.5 9 7.5" {...common} />
          <Path d="M5.5 9v11h13V9M9.5 20v-6h5v6" {...common} />
        </>
      )}
      {name === 'layout-grid' && (
        <>
          <Path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" {...common} />
        </>
      )}
      {name === 'compass' && (
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Path d="m15.7 8.3-2.1 5.3-5.3 2.1 2.1-5.3 5.3-2.1Z" {...common} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx={12} cy={8} r={3.2} {...common} />
          <Path d="M5.5 20c.7-3.5 3-5.5 6.5-5.5s5.8 2 6.5 5.5" {...common} />
        </>
      )}
    </Svg>
  );
}

export function BottomNav({ active, onNavigate, testID }: BottomNavProps) {
  return (
    <View accessibilityRole="tablist" style={styles.shell} testID={testID}>
      {bottomNavItems.map((item) => {
        const selected = item.key === active;
        const content = (
          <>
            <NavIcon active={selected} name={item.icon} />
            <Text style={[styles.label, selected && styles.activeLabel]}>
              {item.label}
            </Text>
          </>
        );

        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.key}
            onPress={() => onNavigate(getBottomNavTarget(item.key))}
            style={styles.item}
          >
            {selected ? (
              <LinearGradient
                colors={['#C05CF6', mobileColors.primary]}
                style={styles.activeItem}
              >
                {content}
              </LinearGradient>
            ) : (
              <View style={styles.inactiveItem}>{content}</View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    borderColor: '#FFFFFF',
    borderRadius: 27,
    borderWidth: 1.3,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-around',
    maxWidth: 335,
    paddingHorizontal: 13,
    shadowColor: '#BABABA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    width: '100%',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  activeItem: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    shadowColor: '#939393',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    width: 48,
  },
  inactiveItem: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  label: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.body,
    fontSize: 8,
    lineHeight: 11,
    marginTop: 2,
  },
  activeLabel: {
    color: '#FFFFFF',
  },
});
