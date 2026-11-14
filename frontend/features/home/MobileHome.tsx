import {getHomeMiboMotion} from './homeMotionPolicy';
import {SourceRouteNode} from '../../components/mobile/sourceRouteShared';
import {useSourceTreeMotion} from '../../components/mobile/useSourceTreeMotion';
import {sourceControlStates} from '../../design/sourceControlMotionEvidence';
import {FigmaTree} from '../../components/mobile/FigmaTree';
import {HomeFooterBackdrop,HomeControlBackdrop} from './HomeMotionBackdrop';
import { useSourceRouteTransition } from '../../components/mobile/SourceRouteTransition';
import {OrderedHomeCards} from './OrderedHomeCards';
import {LiveGlassBackdrop} from '../../components/mobile/glass/LiveGlassBackdrop';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import {
  AppBackground,
  BottomNav,
  BrandHeader,
  CircleAction,
  MobileIcon,
} from "../../components/mobile";
import { useSourceMotion } from "../../components/mobile/useSourceMotion";
import { FigmaText } from "../../components/mobile/FigmaText";
import { FigmaGeometry } from "../../components/mobile/FigmaGeometry";
import { homeRenderEvidence as source } from "../../design/homeRenderEvidence";
import type { FigmaVectorLayer } from "../../design/figmaComponentEvidence";
import { authAPI } from "../../services/api";
import { mobileFontFamilies } from "../../theme/typography";
import { fitSourceWidth, getMobileLayout } from "../../theme/responsive";
import { getSourceMotion } from "../../design/sourceMotionEvidence";
import {
  homeCards,
  homeFigmaEvidence,
  homeSuggestions,
  type HomeCardKey,
} from "./homeContent";
import { HomeAvatar, HomeCardArtwork, matrix } from "./HomeArtwork";

const sourceCardWidth = 321;

function HomeCard({
  card,
  cardWidth,
  expanded,
  navigate,
  onOpen,
  onToggle,
}: {
  card: (typeof homeCards)[number];
  cardWidth: number;
  expanded: boolean;
  navigate: (href: string) => void;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const sourceNavigate = useSourceRouteTransition();
  const e = homeFigmaEvidence.cards.find((item) => item.key === card.key)!;
  const target = homeFigmaEvidence.homeStateTargets.find(
    (item) => item.card === card.key,
  )!;
  const motion = useMemo(
    () =>
      getSourceMotion(
        target.interactionNodeId,
        "ON_HOVER",
        target.motionTargetNodeId,
      ),
    [target.interactionNodeId, target.motionTargetNodeId],
  );
  const hoverOpened = useRef(false);
  const right = card.key === "products" || card.key === "profile";
  const sourceCopy =
    card.key === "profile" ? null : source.cardCopy[card.key];
  const sourceX = (value: number) => (value / sourceCardWidth) * cardWidth;
  const copyWidth = Math.max(160, cardWidth - sourceX(right ? 49 : 48) - 44.5);
  const { animateTo, cancel, progress } = useSourceMotion(motion);

  useEffect(() => {
    const timer = setTimeout(() => animateTo(expanded ? 1 : 0), 16);
    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, [animateTo, cancel, expanded]);

  const animatedStyle = {
    height: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [e.closed.height, e.expandedSurface.height],
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, target.sourceY.expanded - target.sourceY.closed],
        }),
      },
    ],
  };

  return (
    <View
      testID={`home-card-${card.key}-shell`}
      style={[
        styles.cardSlot,
        { width: cardWidth, zIndex: expanded ? 10 : 1 },
      ]}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <SourceRouteNode sourceNodeId={({store:"270:26345",products:"270:26431",community:"270:26460",profile:"270:26504"} as Record<string,string>)[card.key]} captureHeight={e.expandedSurface.height} contentHeight={animatedStyle.height} style={StyleSheet.absoluteFill}><Pressable
          accessibilityRole="button"
          accessibilityLabel={`${sourceCopy?.title.characters ?? card.title}，${sourceCopy?.description.characters ?? card.description}`}
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          testID={`home-card-${card.key}`}
          onHoverIn={() => {
            if (!expanded) {
              hoverOpened.current = true;
              onOpen();
            }
          }}
          onPress={() => {
            if (expanded && hoverOpened.current) {
              hoverOpened.current = false;
              onOpen();
              return;
            }
            onToggle();
          }}
          style={StyleSheet.absoluteFill}
        />
        <HomeControlBackdrop artwork={<>
        <HomeCardArtwork
          cardWidth={cardWidth}
          kind={card.key}
          progress={progress}
        />
        <View
          pointerEvents="none"
          testID={`home-card-${card.key}-copy`}
          style={[
            styles.cardCopy,
            { top: sourceCopy?.title.transform.m12 ?? 12 },
            right
              ? { right: sourceX(27), width: copyWidth }
              : { left: sourceX(31), width: copyWidth },
          ]}
        >
          {sourceCopy ? (
            <View style={right ? { position: "absolute", right: 1 } : undefined}>
              <FigmaText
                evidence={sourceCopy.title}
                testID={`home-${card.key}-source-title`}
              />
            </View>
          ) : (
            <Text style={[styles.cardTitle, right && { textAlign: "right" }]}>
              {card.title}
            </Text>
          )}
          {sourceCopy ? (
            <View
              style={[
                {
                  position: "absolute",
                  top:
                    sourceCopy.description.transform.m12 -
                    sourceCopy.title.transform.m12,
                },
                right ? { right: 1 } : undefined,
              ]}
            >
              <FigmaText evidence={sourceCopy.description} />
            </View>
          ) : (
            <Text
              style={[
                styles.cardDescription,
                right && { right: 0, textAlign: "right" },
              ]}
            >
              {card.description}
            </Text>
          )}
        </View>
        </>}>
        {!expanded && (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            style={[
              styles.arrow,
              right ? { left: sourceX(22) } : { right: sourceX(17) },
            ]}
          >
            <CircleAction
              accessibilityLabel="展开"
              decorative
              icon="home-arrow"
              onPress={() => undefined}
            />
          </View>
        )}
        {expanded && (
          <CircleAction
            accessibilityLabel={`进入${card.title}`}
            icon="home-arrow"
            testID={`home-card-${card.key}-open`}
            sourceMotion={getSourceMotion(({store:'268:23006',products:'268:23426',community:'268:23789'} as Record<string,string>)[card.key]??'','ON_CLICK')}
            canonicalTarget={card.href}
            onPress={() => navigate(card.href)}
            style={[
              styles.arrow,
              right ? { left: sourceX(22) } : { right: sourceX(17) },
            ]}
          />
        )}
        </HomeControlBackdrop>
        {expanded && card.key === "store" && (
          <Text pointerEvents="none" style={styles.detail}>
            探索公开应用，发现适合你的工具
          </Text>
        )}
        {expanded && card.key === "community" && (
          <Text pointerEvents="none" style={styles.detail}>
            探索公开应用，收藏灵感与工具
          </Text>
        )}
        </SourceRouteNode>
      </Animated.View>
    </View>
  );
}

export function MobileHome() {
  const sourceNavigate = useSourceRouteTransition();
  const avatarPresentation=useRef<{sourceNodeId:string}|null>(null);
  const params=useLocalSearchParams<{sourceAvatar?:string}>();
  const router = useRouter(),
    insets = useSafeAreaInsets(),
    viewport = useWindowDimensions(),
    layout = getMobileLayout(viewport.width, insets);
  const [expandedCard, setExpandedCard] = useState<HomeCardKey | null>(null),
    [username, setUsername] = useState("你好"),
    [cloudIndex, setCloudIndex] = useState(0),[cloudPressed,setCloudPressed]=useState(false),[avatarHovered,setAvatarHovered]=useState(params.sourceAvatar==='hover');
  useEffect(() => {
    let alive = true;
    authAPI
      .getMe()
      .then((r) => {
        if (alive && r.data.username.trim())
          setUsername(r.data.username.trim());
      })
      .catch(() => {
        if (alive) setUsername("你好");
      });
    return () => {
      alive = false;
    };
  }, []);
  const navigate = (href: string) => router.push(href as never),
    cloud = source.clouds[cloudIndex];
  const cloudMotion=useMemo(()=>getSourceMotion('266:21221','ON_PRESS'),[]);
  const cloudState=useSourceTreeMotion(sourceControlStates[cloudPressed?'188:16981':source.clouds[cloudIndex].sourceNodeId],cloudMotion);
  const miboRouteMotion=(avatarPressed=false)=>getHomeMiboMotion({avatarHovered,avatarPressed,avatarSourceNodeId:avatarPresentation.current?.sourceNodeId,cloudPressed,cloudSourceNodeId:cloudState.sourceNodeId,expandedCard});
  const usableWidth = viewport.width - insets.left - insets.right;
  const cardWidth = fitSourceWidth(
    sourceCardWidth,
    375,
    usableWidth,
    "relative",
  );
  return (
    <AppBackground
      insets={insets}
      testID="mobile-home"
      atmosphere={expandedCard === 'profile' ? 'profile' : 'default'}
      contentStyle={{ position: "relative" }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <HomeFooterBackdrop scrollContent={<ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 44),
          paddingBottom: 100,
        }}
      >
        <SourceRouteNode sourceNodeId="270:26267"
          style={{
            width: Math.min(
              347,
              viewport.width - insets.left - insets.right - 28,
            ),
            alignSelf: "center",
          }}
        >
          <BrandHeader
            paintOffsetY={1}
            action={
              <CircleAction
                accessibilityLabel="额度与设置"
                icon="settings"
                onPress={() => navigate("/billing")}
                testID="home-settings"
              />
            }
          />
        </SourceRouteNode>
        <LiveGlassBackdrop mode="flow" underlay={<>
        <View style={styles.hero}>
          <View style={styles.avatar}><Pressable
            accessibilityRole="button"
            accessibilityLabel="与 Mibo AI 对话"
            onPress={() => sourceNavigate(miboRouteMotion(true),()=>navigate("/chatbot"),"/chatbot")}
            onHoverIn={()=>setAvatarHovered(true)} onHoverOut={()=>setAvatarHovered(false)}
            testID="home-mibo-avatar"
            style={StyleSheet.absoluteFill}
          >
            {({pressed})=><HomeAvatar pressed={pressed} hovered={avatarHovered} presentationRef={avatarPresentation}/>}
          </Pressable></View>
          <View style={styles.heroCopy}><SourceRouteNode sourceNodeId="270:26287" style={StyleSheet.absoluteFill}>
            <Text style={styles.greeting}>Hi！{username}✨</Text>
            <View style={{position:"absolute",top:source.question.transform.m12,left:source.question.transform.m02}}><FigmaText testID="home-question" evidence={source.question}/></View>
            </SourceRouteNode><SourceRouteNode sourceNodeId="270:26290" style={[styles.miboLink,{left:Math.min(76.2495,viewport.width-insets.right-layout.gutter-(layout.gutter+12+82)-147.501)}]}><Pressable
              accessibilityRole="button"
              onPress={() => sourceNavigate(miboRouteMotion(),()=>navigate("/chatbot"),"/chatbot")}
              accessibilityLabel="与 Mibo AI 对话"
              testID="home-mibo-open"
              style={StyleSheet.absoluteFill}
            >
              <FigmaGeometry geometry={source.miboLink.geometry as readonly FigmaVectorLayer[]} width={source.miboLink.size.width} height={source.miboLink.size.height} prefix="home-mibo-link"/>
            </Pressable></SourceRouteNode>
          </View>
        </View>
        <SourceRouteNode sourceNodeId="270:26309" style={styles.inspirationHeader}>
          <View style={{width:source.sectionIcon.size.width,height:source.sectionIcon.size.height}}><FigmaGeometry geometry={source.sectionIcon.geometry as readonly FigmaVectorLayer[]} width={source.sectionIcon.size.width} height={source.sectionIcon.size.height} prefix="home-inspiration-icon"/></View>
          <FigmaText evidence={source.sectionLabels.inspiration}/>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="换一组灵感"
            testID="home-inspiration-refresh"
            onPress={() => setCloudIndex((i) => (i + 1) % source.clouds.length)}
            style={styles.refresh}
          >
            <FigmaText evidence={source.sectionLabels.refresh}/>
          </Pressable>
        </SourceRouteNode>
        <SourceRouteNode sourceNodeId="270:26318" style={styles.wordCloud}><Pressable style={StyleSheet.absoluteFill} testID="home-suggestions" nativeID={cloud.sourceNodeId} accessibilityLabel="词云源按压状态" onPressIn={()=>setCloudPressed(true)} onPressOut={()=>setCloudPressed(false)}>
          <View pointerEvents="none" accessibilityElementsHidden style={StyleSheet.absoluteFill}><FigmaTree node={cloudState} prefix="home-cloud-source-motion"/></View>
          {cloud.items.map((item) => {
            const suggestion = homeSuggestions.find(
              (s) => s.label === item.characters,
            );
            const glyph = <View pointerEvents="none" style={{opacity:0}}><FigmaText evidence={item} /></View>;
            return suggestion ? (
              <Pressable
                key={item.sourceNodeId}
                accessibilityRole="button"
                accessibilityLabel={suggestion.label}
                onPress={() =>
                  navigate(
                    `/chatbot?prompt=${encodeURIComponent(suggestion.prompt)}`,
                  )
                }
                testID={`home-suggestion-${suggestion.id}`}
                style={{
                  position: "absolute",
                  left: item.transform.m02,
                  top: item.transform.m12 - Math.max(0, (44 - item.size.y) / 2),
                  minWidth: 44,
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                {glyph}
              </Pressable>
            ) : (
              <View
                key={item.sourceNodeId}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: item.transform.m02,
                  top: item.transform.m12,
                }}
              >
                {glyph}
              </View>
            );
          })}
        </Pressable></SourceRouteNode>
        <SourceRouteNode sourceNodeId="270:26314" style={styles.functionHeader}>
          <View style={{width:source.sectionIcon.size.width,height:source.sectionIcon.size.height}}><FigmaGeometry geometry={source.sectionIcon.geometry as readonly FigmaVectorLayer[]} width={source.sectionIcon.size.width} height={source.sectionIcon.size.height} prefix="home-functions-icon"/></View>
          <FigmaText evidence={source.sectionLabels.functions}/>
        </SourceRouteNode>
        </>}>
        <OrderedHomeCards style={styles.cards} expandedKey={expandedCard}>
          {homeCards.map((card) => {
            return (
              <HomeCard
                key={card.key}
                card={card}
                cardWidth={cardWidth}
                expanded={expandedCard === card.key}
                navigate={navigate}
                onOpen={() => setExpandedCard(card.key)}
                onToggle={() =>
                  setExpandedCard((value) =>
                    value === card.key ? null : card.key,
                  )
                }
              />
            );
          })}
        </OrderedHomeCards>
        </LiveGlassBackdrop>
      </ScrollView>}>
      <SourceRouteNode sourceNodeId="270:26530"
        style={{
          position: "absolute",
          left: 20 - layout.gutter,
          right: 20 - layout.gutter,
          bottom: Math.max(insets.bottom, 29),
          zIndex: 20,
        }}
        testID="home-bottom-nav-wrap"
      >
        <BottomNav
          active="home"
          onNavigate={navigate}
          testID="home-bottom-nav"
        />
      </SourceRouteNode>
      </HomeFooterBackdrop>
    </AppBackground>
  );
}
const styles = StyleSheet.create({
  hero: {
    height: 84,
    marginTop: 19,
    marginHorizontal: 12,
    position: "relative",
  },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarPressed: { borderColor: "#7C62FF", borderWidth: 3 },
  heroCopy: { position: "absolute", left: 82, top: 0, width:148 },
  greeting: {
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 49,
    color: "#404040",
    marginLeft: 2,
    width:146,textAlign:'center',
    // Chromium's live PingFang 20/49 line baseline is 31; preserve the source glyph baseline without changing API copy or its frame.
    transform:Platform.OS==='web'?[{translateY:source.greetingMetrics.baseline-31}]:undefined,
  },
  question: {
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 11,
    fontWeight:'500',width:146,textAlign:'center',
    lineHeight: 43,
    color: "#7F80A1",
    position: "absolute",
    top: 23,
    left: 0,
  },
  miboLink: {
    minWidth: 44,
    minHeight: 44,
    position: "absolute",
    top: 49,
    left:76.2495,
    width:147.501,
    alignItems:'center',
    justifyContent: "center",
  },
  miboLinkText: {
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 10,
    lineHeight: 12,
    color: "#B05CFF",
    textDecorationLine: "underline",
  },
  inspirationHeader: {
    marginTop: 43.5,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginHorizontal: 11,
  },
  sectionTitle: {
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 8,
    lineHeight: 15,
    color: "#494A64",
  },
  sectionMeta: {
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 6,
    lineHeight: 12,
    color: "#7F80A1",
  },
  refresh: {
    marginLeft: "auto",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  wordCloud: {
    left:3,
    marginTop: -1.5,
    width: "100%",
    maxWidth: 303,
    height: 111,
    alignSelf: "center",
    borderRadius: 30,
    overflow: "hidden",
  },
  suggestionTarget: { position: "absolute", minWidth: 44, minHeight: 44 },
  functionHeader: {
    marginTop: 16.5,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginHorizontal: 11,
  },
  cards: { marginTop: -1.5 },
  cardSlot: {
    left:1,
    height: 70,
    alignSelf: "center",
    position: "relative",
  },
  card: {
    height: 70,
    width: "100%",
    overflow: "visible",
    position: "relative",
  },
  cardCopy: { position: "absolute", top: 12 },
  cardTitle: {
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 32,
    color: "#494A64",
  },
  cardDescription: {
    position: "absolute",
    top: 22,
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 8,
    fontWeight: "500",
    lineHeight: 32,
    color: "#7F80A1",
    minWidth: 100,
  },
  arrow: { position: "absolute", top: 19, width: 44.5, height: 44.5 },
  detail: {
    position: "absolute",
    top: 92,
    left: 25,
    right: 25,
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 12,
    lineHeight: 20,
    color: "#7F80A1",
  },
});
