import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  type FigmaVectorLayer,
  figmaComponentEvidence,
} from '../../design/figmaComponentEvidence';
import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';

type BrandHeaderProps = {
  action?: ReactNode;
  logo?: ReactNode;
  subtitle?: string;
  testID?: string;
  title?: string;
};

const DEFAULT_SUBTITLE = 'Powered by Sealos | GitHub';
const DEFAULT_TITLE = 'INTELLIDEPLOY';

function BrandMark() {
  const evidence = figmaComponentEvidence.brandMark;

  return (
    <Svg
      accessibilityElementsHidden
      height={evidence.size.height}
      viewBox={`0 0 ${evidence.size.width} ${evidence.size.height}`}
      width={evidence.size.width}
    >
      {evidence.geometry.map((definitionLayer, index) => {
        const layer = definitionLayer as FigmaVectorLayer;
        return (
          <Path
            d={layer.path}
            fill={layer.fill ?? 'none'}
            fillRule={layer.fillRule}
            key={`${layer.sourceNodeId}-${index}`}
            opacity={layer.opacity}
            stroke={layer.stroke}
            strokeLinecap={layer.strokeLinecap}
            strokeLinejoin={layer.strokeLinejoin}
            strokeWidth={layer.strokeWidth}
            transform={layer.transform}
          />
        );
      })}
    </Svg>
  );
}

function BrandCopy({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <View style={styles.brand}>
      <View accessibilityLabel={title} style={styles.brandMarkWrapper}>
        <BrandMark />
      </View>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function BrandHeader({
  action,
  logo,
  subtitle = DEFAULT_SUBTITLE,
  testID,
  title = DEFAULT_TITLE,
}: BrandHeaderProps) {
  const useDefaultMark = !logo && subtitle === DEFAULT_SUBTITLE && title === DEFAULT_TITLE;

  return (
    <View style={styles.header} testID={testID}>
      {useDefaultMark ? (
        <View accessibilityLabel={title} style={styles.brandMarkWrapper}>
          <BrandMark />
        </View>
      ) : (
        logo ?? <BrandCopy subtitle={subtitle} title={title} />
      )}
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
  brandMarkWrapper: {
    height: figmaComponentEvidence.brandMark.size.height,
    justifyContent: 'center',
    width: figmaComponentEvidence.brandMark.size.width,
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
