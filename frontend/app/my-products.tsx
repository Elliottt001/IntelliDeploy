import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import {
  Platform,
  Pressable,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const ARTBOARD_WIDTH = 375;
const ARTBOARD_HEIGHT = 812;

export default function MyProducts() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const artboardScale =
    Platform.OS === 'web'
      ? 1
      : Math.min(viewportWidth / ARTBOARD_WIDTH, viewportHeight / ARTBOARD_HEIGHT);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      NativeStatusBar.setHidden(true, 'none');
      NativeStatusBar.setTranslucent(true);
      NativeStatusBar.setBackgroundColor('transparent', false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        NativeStatusBar.setHidden(true, 'none');
        NativeStatusBar.setTranslucent(true);
        NativeStatusBar.setBackgroundColor('transparent', false);
      }
    }, [])
  );

  return (
    <View style={styles.shell}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" hidden translucent backgroundColor="transparent" />
      <View
        style={[
          styles.artboardShell,
          {
            width: ARTBOARD_WIDTH * artboardScale,
            height: ARTBOARD_HEIGHT * artboardScale,
          },
        ]}
      >
      <View style={[styles.artboard, { transform: [{ scale: artboardScale }] }]}>
        <PageHeader title="我的产品" onBack={() => router.back()} />

        <View style={styles.copy}>
          <Text style={styles.heading}>COLLECTION</Text>
          <Text style={styles.subheading}>点击查看我收藏的应用</Text>
        </View>

        <View style={styles.folderStage}>
          <View style={[styles.folderTab, styles.folderTabGreen]} />
          <View style={[styles.folderTab, styles.folderTabBlue]} />
          <View style={[styles.folderTab, styles.folderTabPink]} />
          <View style={[styles.folderTab, styles.folderTabRed]} />
          <View style={styles.folderBack} />
          <View style={styles.folderGlow} />
          <View style={styles.folderFront}>
            <View style={styles.folderFrontGlow} />
            <Text style={styles.folderLine}>MY <Text style={styles.folderAccent}>COLLECTION</Text></Text>
            <Text style={styles.folderLine}>OF</Text>
            <Text style={styles.folderLine}>THE <Text style={styles.folderAccent}>WORLD</Text></Text>
          </View>
        </View>

        <Text style={styles.footer}>世界在你掌心…</Text>
      </View>
      </View>
    </View>
  );
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.circleButton} onPress={onBack}>
        <BackGlyph />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable style={styles.circleButton}>
        <ShareGlyph />
      </Pressable>
    </View>
  );
}

function ShareGlyph() {
  return (
    <View style={styles.shareGlyph}>
      <View style={[styles.shareNode, styles.shareNodeTop]} />
      <View style={[styles.shareNode, styles.shareNodeLeft]} />
      <View style={[styles.shareNode, styles.shareNodeRight]} />
      <View style={[styles.shareLink, styles.shareLinkLeft]} />
      <View style={[styles.shareLink, styles.shareLinkRight]} />
    </View>
  );
}

function BackGlyph() {
  return (
    <View style={styles.backGlyph}>
      <View style={styles.backShaft} />
      <View style={[styles.backWing, styles.backWingTop]} />
      <View style={[styles.backWing, styles.backWingBottom]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  artboardShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboard: {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    backgroundColor: '#F2F4FF',
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 45,
    left: 27,
    right: 27,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    width: 16,
    height: 14,
    position: 'relative',
  },
  backShaft: {
    position: 'absolute',
    left: 3,
    top: 6,
    width: 12,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  backWing: {
    position: 'absolute',
    left: 2,
    width: 8,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  backWingTop: {
    top: 3,
    transform: [{ rotate: '-45deg' }],
  },
  backWingBottom: {
    top: 9,
    transform: [{ rotate: '45deg' }],
  },
  shareGlyph: {
    width: 18,
    height: 18,
    position: 'relative',
  },
  shareNode: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#494A64',
    zIndex: 2,
  },
  shareNodeTop: {
    top: 1,
    left: 10,
  },
  shareNodeLeft: {
    top: 10,
    left: 1,
  },
  shareNodeRight: {
    top: 12,
    left: 12,
  },
  shareLink: {
    position: 'absolute',
    height: 1.6,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  shareLinkLeft: {
    top: 8,
    left: 4,
    width: 9,
    transform: [{ rotate: '-34deg' }],
  },
  shareLinkRight: {
    top: 10,
    left: 10,
    width: 7,
    transform: [{ rotate: '45deg' }],
  },
  headerTitle: {
    color: '#161823',
    fontSize: 18,
    fontWeight: '700',
  },
  copy: {
    position: 'absolute',
    left: 24,
    top: 139,
  },
  heading: {
    color: '#3C3D53',
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  subheading: {
    color: '#7F80A1',
    fontSize: 12,
    marginTop: 14,
  },
  folderStage: {
    position: 'absolute',
    left: 44,
    top: 241,
    width: 284,
    height: 286,
  },
  folderTab: {
    position: 'absolute',
    top: 45,
    width: 82,
    height: 94,
    borderRadius: 24,
    zIndex: 2,
  },
  folderTabGreen: {
    left: 79,
    backgroundColor: '#5DE5B8',
  },
  folderTabBlue: {
    left: 53,
    backgroundColor: '#35A6FF',
  },
  folderTabPink: {
    left: 105,
    backgroundColor: '#F48CB7',
  },
  folderTabRed: {
    left: 131,
    backgroundColor: '#F0646A',
  },
  folderBack: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 284,
    height: 188,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 22,
    backgroundColor: '#8E58FF',
    zIndex: 1,
  },
  folderGlow: {
    position: 'absolute',
    left: 34,
    top: 90,
    width: 218,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255,255,255,0.18)',
    zIndex: 2,
  },
  folderFront: {
    position: 'absolute',
    left: 0,
    top: 105,
    width: 284,
    height: 171,
    borderRadius: 22,
    backgroundColor: 'rgba(154,135,245,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingLeft: 21,
    paddingTop: 110,
    zIndex: 3,
    overflow: 'hidden',
  },
  folderFrontGlow: {
    position: 'absolute',
    left: -16,
    right: -16,
    bottom: -20,
    height: 92,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  folderLine: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  folderAccent: {
    color: '#F04BD7',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 31,
    color: '#8B8FAF',
    fontSize: 14,
    textAlign: 'center',
  },
});
