import type { PropsWithChildren } from 'react';
import Svg from 'react-native-svg';
import {MobileBackdrop} from './MobileBackdrop';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { getMobileLayout } from '../../theme/responsive';

type AppBackgroundProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  insets?: { left: number; right: number };
  style?: StyleProp<ViewStyle>;
  testID?: string;
  width?: number;
  atmosphere?: 'default' | 'chatbot' | 'profile';
}>;

export function AppBackground({
  children,
  contentStyle,
  insets = { left: 0, right: 0 },
  style,
  testID,
  width,
  atmosphere = 'default',
}: AppBackgroundProps) {
  const window = useWindowDimensions();
  const viewportWidth = width ?? window.width;
  const layout = getMobileLayout(viewportWidth, insets);

  return (
    <View style={[styles.background, style]} testID={testID}>
      <Svg testID="mobile-source-atmosphere" pointerEvents="none" {...(Platform.OS==='web'?{'aria-hidden':true}:{accessibilityElementsHidden:true})} style={StyleSheet.absoluteFill} width="100%" height="100%">
        <MobileBackdrop width={viewportWidth} height={window.height} variant={atmosphere}/>
      </Svg>
      <View
        style={[
          styles.safeArea,
          {
            paddingLeft: insets.left + layout.gutter,
            paddingRight: insets.right + layout.gutter,
            width: viewportWidth,
          },
        ]}
      >
        <View
          style={[
            styles.content,
            { width: layout.contentWidth },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 560,
  },
  safeArea: {
    alignItems: 'center',
    flex: 1,
  },
});
