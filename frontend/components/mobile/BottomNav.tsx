import {SourceGlassSurface} from './glass/SourceGlassSurface';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  type FigmaEffectEvidence,
  type FigmaPaintEvidence,
  figmaComponentEvidence,
} from '../../design/figmaComponentEvidence';
import {
  bottomNavItems,
  getBottomNavTarget,
  type MobileNavKey,
  type MobileRoute,
} from '../../features/navigation/mobileNavigation';
import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';
import { MobileIcon } from './CircleAction';
import {FigmaText} from './FigmaText';
import {bottomNavRenderEvidence as source} from '../../design/bottomNavRenderEvidence';

type BottomNavProps = {
  active: MobileNavKey;
  onNavigate: (href: MobileRoute) => void;
  testID?: string;
};

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

export function BottomNav({ active, onNavigate, testID }: BottomNavProps) {
  const shell = figmaComponentEvidence.bottomNav;
  const surfaceFills = shell.surfaceFills as readonly FigmaPaintEvidence[] | undefined;
  const surfaceStrokes =
    shell.surfaceStrokes as readonly FigmaPaintEvidence[] | undefined;
  const surfaceEffects =
    shell.surfaceEffects as readonly FigmaEffectEvidence[] | undefined;
  const shadow = (surfaceEffects ?? []).find(
    (effect) => effect.type === 'DROP_SHADOW',
  );
  const shellFill = (surfaceFills ?? []).find(
    (paint) => 'color' in paint && paint.color,
  );
  const shellStroke = (surfaceStrokes ?? []).find(
    (paint) => 'color' in paint && paint.color,
  );
  const activeSize = figmaComponentEvidence.home.size.width;
  const shellBorderWidth=shell.borderWidths?.top ?? 1.3;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.shell,
        {
          backgroundColor:
            toRgba(shellFill?.color, shellFill?.opacity ?? 1) ??
            'rgba(255, 255, 255, 0.70)',
          borderColor: shellStroke?.color ?? '#FFFFFF',
          borderRadius:
            shell.cornerRadii?.topLeft ?? figmaComponentEvidence.bottomNav.size.height / 2,
          borderWidth: 0,
          height: figmaComponentEvidence.bottomNav.size.height,
          maxWidth: figmaComponentEvidence.bottomNav.size.width,
          shadowColor: shadow?.color ?? '#BABABA',
          shadowOffset: shadow?.offset
            ? { height: shadow.offset.y, width: shadow.offset.x }
            : { width: 0, height: 2 },
          shadowOpacity: shadow?.opacity ?? 0.25,
          shadowRadius: shadow?.radius ?? 3,
        },
      ]}
      testID={testID}
    >
      <SourceGlassSurface sourceNodeId={shell.surfaceNodeId}/>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderWidth:shellBorderWidth,borderColor:shellStroke?.color??'#FFFFFF',borderRadius:shell.cornerRadii?.topLeft??27}]} />
      {bottomNavItems.map((item,index) => {
        const selected = item.key === active;
        const art=source.items[index];
        const content = (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={{position:'absolute',left:art.icon.x,top:art.icon.y}}><MobileIcon color={selected?'#FFFFFF':source.inactiveColor} name={item.icon} size={art.icon.size.x}/></View>
            <View style={{position:'absolute',left:art.label.x,top:art.label.y}}><FigmaText evidence={art.label.evidence} color={selected?'#FFFFFF':source.inactiveColor} testID={`bottom-nav-label-${item.key}`}/></View>
          </View>
        );

        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.key}
            onPress={() => onNavigate(getBottomNavTarget(item.key))}
            style={[styles.item,{left:`${(58.527027+index*74)/335*100}%`,marginLeft:-24}]}
          >
            {selected ? (
              <LinearGradient
                colors={source.selected.colors}
                start={source.selected.start}
                end={source.selected.end}
                style={[
                  styles.activeItem,
                  {
                    borderRadius: activeSize / 2,
                    height: activeSize,
                    width: activeSize,
                  },
                ]}
              >
                {content}
              </LinearGradient>
            ) : (
              <View style={[styles.inactiveItem,{backgroundColor:`rgba(255,255,255,${source.inactive.fillOpacity})`,borderRadius:source.inactive.cornerRadius,shadowColor:'#BABABA',shadowOffset:{width:source.inactive.shadow.offset.x,height:source.inactive.shadow.offset.y},shadowOpacity:source.inactive.shadow.color.a,shadowRadius:source.inactive.shadow.radius}]}><View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderWidth:source.inactive.borderWidth,borderColor:'#FFFFFF',borderRadius:source.inactive.cornerRadius}]}/>{content}</View>
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
    flexDirection: 'row',
    width: '100%',
  },
  item: {
    position: 'absolute',
    top: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  activeItem: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#939393',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  inactiveItem: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  label: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.pingFang,
    fontWeight: '500',
    fontSize: 7,
    lineHeight: 10,
    marginTop: 2,
  },
  activeLabel: {
    color: '#FFFFFF',
  },
});
