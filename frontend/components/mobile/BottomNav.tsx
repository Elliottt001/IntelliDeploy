import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  bottomNavItems,
  getBottomNavTarget,
  type MobileNavKey,
  type MobileRoute,
} from '../../features/navigation/mobileNavigation';
import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';
import { MobileIcon } from './CircleAction';

type BottomNavProps = {
  active: MobileNavKey;
  onNavigate: (href: MobileRoute) => void;
  testID?: string;
};

export function BottomNav({ active, onNavigate, testID }: BottomNavProps) {
  return (
    <View accessibilityRole="tablist" style={styles.shell} testID={testID}>
      {bottomNavItems.map((item) => {
        const selected = item.key === active;
        const content = (
          <>
            <MobileIcon
              color={selected ? '#FFFFFF' : mobileColors.text}
              name={item.icon}
            />
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
