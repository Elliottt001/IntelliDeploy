import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';

type BrandHeaderProps = {
  action?: ReactNode;
  logo?: ReactNode;
  subtitle?: string;
  testID?: string;
  title?: string;
};

function BrandMark() {
  return (
    <View style={styles.mark}>
      <Svg
        accessibilityElementsHidden
        height={20}
        viewBox="0 0 24 20"
        width={24}
      >
        <Path
          d="M7 14.5h10a4 4 0 0 0 .4-7.98A5.7 5.7 0 0 0 6.6 6.2 4.15 4.15 0 0 0 7 14.5Z"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.7}
        />
        <Circle cx={9} cy={10.5} fill="#FFFFFF" r={1.15} />
        <Circle cx={15} cy={10.5} fill="#FFFFFF" r={1.15} />
        <Path
          d="M10.5 13h3"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeWidth={1.3}
        />
      </Svg>
    </View>
  );
}

export function BrandHeader({
  action,
  logo,
  subtitle = 'Powered by Sealos | GitHub',
  testID,
  title = 'INTELLIDEPLOY',
}: BrandHeaderProps) {
  return (
    <View style={styles.header} testID={testID}>
      <View style={styles.brand}>
        {logo ?? <BrandMark />}
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    width: '100%',
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    height: 32,
    justifyContent: 'center',
    shadowColor: '#BABABA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    width: 32,
  },
  copy: {
    justifyContent: 'center',
  },
  title: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.inter,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  subtitle: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.inter,
    fontSize: 5,
    lineHeight: 7,
    textAlign: 'center',
  },
});
