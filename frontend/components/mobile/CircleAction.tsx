import {SourceGlassSurface} from './glass/SourceGlassSurface';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  type FigmaEffectEvidence,
  type FigmaPaintEvidence,
  type FigmaPrimitiveEvidence,
  type FigmaVectorLayer,
  figmaComponentEvidence,
  figmaMobileIcons,
  getFigmaMobileIcon,
} from '../../design/figmaComponentEvidence';
import { formalMobileControls } from '../../design/formalMobileControls';
import { mobileColors, mobileSpacing } from '../../theme/tokens';

export type MobileIconName = keyof typeof figmaMobileIcons | 'home-arrow';

export type MobileIconProps = {
  color?: string;
  name: MobileIconName;
  size?: number;
  strokeWidth?: number;
};

function iconDefinition(name:MobileIconName){return name==='home-arrow'?figmaMobileIcons.settings:name==='settings'?formalMobileControls.settings:getFigmaMobileIcon(name);}

function toShadowOffset(effect?: FigmaEffectEvidence) {
  return effect?.offset
    ? { height: effect.offset.y, width: effect.offset.x }
    : undefined;
}

function toRgba(color?: string, opacity = 1) {
  if (!color) {
    return undefined;
  }
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) {
    return color;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity.toFixed(2)})`;
}

function firstSolidPaint(paints: readonly FigmaPaintEvidence[]) {
  return paints.find((paint) => paint.type === 'SOLID' && paint.color);
}

function firstGradientPaint(paints: readonly FigmaPaintEvidence[]) {
  return paints.find(
    (paint) =>
      paint.type === 'GRADIENT_LINEAR' &&
      (paint.gradientStops?.length ?? 0) >= 2,
  );
}

export function figmaLinearGradientEndpoints(paint?:FigmaPaintEvidence) {
 const matrix=paint?.transform?.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number);
 if(!matrix)return {start:paint?.start,end:paint?.end};
 const [a,,c,,e]=matrix,denominator=a*a+c*c;
 return {start:{x:-e*a/denominator,y:-e*c/denominator},end:{x:(1-e)*a/denominator,y:(1-e)*c/denominator}};
}

function iconUsesSingleColor(name: MobileIconName) {
  const definition = iconDefinition(name);
  const colors = new Set<string>();
  for (const layer of definition.layers as readonly FigmaVectorLayer[]) {
    if (layer.fill) {
      colors.add(layer.fill);
    }
    if (layer.stroke) {
      colors.add(layer.stroke);
    }
  }
  return colors.size <= 1;
}

export function MobileIcon({
  color = mobileColors.text,
  name,
  size = 18,
  strokeWidth = 1.8,
}: MobileIconProps) {
  const definition = iconDefinition(name);
  const overrideColor = iconUsesSingleColor(name) ? color : undefined;
  const layers = definition.layers as readonly FigmaVectorLayer[];

  return (
    <Svg
      {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessibilityElementsHidden: true })}
      style={name==='home-arrow'?{transform:[{rotate:'180deg'}]}:undefined}
      height={size}
      viewBox={definition.viewBox}
      width={size}
    >
      {layers.map((layer, index) => {
        return (
          <Path
            d={layer.path}
            fill={layer.fill ? overrideColor ?? layer.fill : 'none'}
            fillRule={layer.fillRule}
            key={`${layer.sourceNodeId}-${index}`}
            opacity={layer.opacity}
            stroke={layer.stroke ? overrideColor ?? layer.stroke : undefined}
            strokeLinecap={layer.strokeLinecap}
            strokeLinejoin={layer.strokeLinejoin}
            strokeWidth={layer.strokeWidth ?? strokeWidth}
            transform={layer.transform}
          />
        );
      })}
    </Svg>
  );
}

export type CircleActionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: MobileIconName;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: 'glass' | 'primary';
  decorative?:boolean;
  surfaceOffset?:{x:number;y:number};
  iconOffset?:{x:number;y:number};
};

export function CircleAction({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
  style,
  testID,
  variant = 'glass',
  surfaceOffset,iconOffset,decorative=false,
}: CircleActionProps) {
  const primary = variant === 'primary';
  const Container=decorative?View:Pressable;
  const shellEvidence = (primary
    ? figmaComponentEvidence.send
    : figmaComponentEvidence.circleAction) as FigmaPrimitiveEvidence;
  const surfaceFills = shellEvidence.surfaceFills as readonly FigmaPaintEvidence[] | undefined;
  const surfaceStrokes =
    shellEvidence.surfaceStrokes as readonly FigmaPaintEvidence[] | undefined;
  const surfaceEffects =
    shellEvidence.surfaceEffects as readonly FigmaEffectEvidence[] | undefined;
  const shadow = (surfaceEffects ?? []).find(
    (effect) => effect.type === 'DROP_SHADOW',
  );
  const shellStroke = (surfaceStrokes ?? []).find(
    (paint) => paint.type === 'SOLID' && paint.color,
  );
  const gradient = primary ? firstGradientPaint(surfaceFills ?? []) : undefined;
  const solidFill = firstSolidPaint(surfaceFills ?? []);
  const surfaceSize = shellEvidence.size.width;
  const backgroundColor = toRgba(solidFill?.color, solidFill?.opacity ?? 1);
  const gradientColors: [string, string, ...string[]] = gradient?.gradientStops
    ? [
        toRgba(gradient.gradientStops[0]?.color, gradient.gradientStops[0]?.opacity) ??
          '#FFFFFF',
        toRgba(gradient.gradientStops[1]?.color, gradient.gradientStops[1]?.opacity) ??
          '#FFFFFF',
        ...gradient.gradientStops
          .slice(2)
          .map((stop) => toRgba(stop.color, stop.opacity) ?? '#FFFFFF'),
      ]
    : ['transparent', 'transparent'];
  const gradientLocations = gradient?.gradientStops
    ? (gradient.gradientStops.map((stop) => stop.position) as [
        number,
        number,
        ...number[],
      ])
    : undefined;

  return (
    <Container
      {...(decorative?(Platform.OS==='web'?{'aria-hidden':true}:{accessibilityElementsHidden:true}):{})}
      accessibilityLabel={decorative?undefined:accessibilityLabel}
      accessibilityRole={decorative?undefined:"button"}
      disabled={decorative?undefined:disabled}
      onPress={decorative?undefined:onPress}
      style={[
        styles.target,
        disabled && !primary && styles.disabled,
        style,
        styles.minimumTarget,
      ]}
      testID={testID}
    >
      <LinearGradient
        colors={gradientColors}
        end={figmaLinearGradientEndpoints(gradient).end}
        locations={gradientLocations}
        start={figmaLinearGradientEndpoints(gradient).start}
        style={[
          styles.surface,
          {
            backgroundColor,
            borderColor:
              shellStroke?.opacity === 1
                ? shellStroke.color
                : toRgba(shellStroke?.color, shellStroke?.opacity ?? 1),
            borderRadius: shellEvidence.cornerRadii?.topLeft,
            borderWidth: shellStroke ? shellEvidence.borderWidths?.top : 0,
            height: surfaceSize,
            opacity: gradient?.opacity,
            shadowColor: shadow?.color,
            shadowOffset: toShadowOffset(shadow),
            shadowOpacity: shadow?.opacity,
            shadowRadius: shadow?.radius,
            width: surfaceSize,
            transform:surfaceOffset?[{translateX:surfaceOffset.x},{translateY:surfaceOffset.y}]:undefined,
          },
        ]}
      >
        <SourceGlassSurface sourceNodeId={shellEvidence.surfaceNodeId}/>
        <View style={iconOffset?{transform:[{translateX:iconOffset.x},{translateY:iconOffset.y}]}:undefined}><MobileIcon
          color={primary ? '#FFFFFF' : mobileColors.text}
          name={icon}
          size={primary?12:Math.max(...iconDefinition(icon).viewBox.split(' ').slice(2).map(Number))}
        /></View>
      </LinearGradient>
    </Container>
  );
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimumTarget: {
    minHeight: mobileSpacing.controlMin,
    minWidth: mobileSpacing.controlMin,
  },
  disabled: {
    opacity: 0.45,
  },
  surface: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
