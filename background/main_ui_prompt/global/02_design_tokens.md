# Design Tokens

## Figma Variables

Extracted variables:

```text
小字: #7F80A1
渐变: #C05CF6
Grape: #7C62FF
bg: #161823
Light Text: #494A64
```

## Light Mode

Canvas:

```text
width: 375
height: 812
borderRadius: 40
borderColor: #FFFFFF
borderWidth: 5
background: #EFF3FF -> #FFFFFF
```

Primary colors:

```text
primary: #7C62FF
primaryGradientStart: #C05CF6
text: #161823
textSoft: #494A64
textMuted: #7F80A1
surface: rgba(255,255,255,0.70)
surfaceLavender: rgba(240,236,252,0.80)
surfaceBlue: rgba(195,215,253,0.80)
```

Typography:

```text
fontFamily: PingFang SC in Figma, React Native system fallback in code
heroTitle: 20
heroSubtitle: 11
sectionTitle: 10
sectionMeta: 8
cardTitle: 16
cardSubtitle: 8
bottomNavLabel: 7
wordCloudMain: 24
wordCloudLarge: 14
wordCloudNormal: 10
wordCloudTiny: 3.5-8
```

Important layout:

```text
header: x 14, y 47, w 347, h 38
avatar: x 36, y 107, w 83.81, h 84
heroText: x 118, y 107
miboLink: x 194.25, y 171.94, w 147.5, h 12
inspirationHeader: x 35, y 249, w 307, h 15
wordCloud: x 39, y 277, w 303, h 111, r 30
featureHeader: x 35, y 419, w 307, h 15
cards: x 28, w 321, collapsed h 68-70, expanded h 195
bottomNav: x 20, y 729, w 335, h 54, r 44.653
```

## Dark Mode

Canvas:

```text
width: 375
height: 2088
background: #0D0F1C
```

Primary colors:

```text
darkBg: #0D0F1C
darkSurface: #161928
darkSurfaceAlt: #1E1B3A
darkBorder: #2A2D45
darkPrimary: #7B5CF6
darkPrimarySoft: #A78BFA
darkText: #FFFFFF
darkMuted: #8B8FAF
darkDim: #6B7280
cyan: #67E8F9
green: #6EE7B7
orange: #F97316
pink: #EC4899
```

Important layout:

```text
statusBar: y 0, h 44
topHeader: y 44, h 115
hero: x 16, y 159, w 343, h 155.5, r 24
stats: x 16, y 330.5, w 343, h 134, r 16
categories: y 484.5, cards 82 x 113, gap 12
bottomNav: y 2025, h 63
```

## Token Implementation Rule

Token values should live in `mainHomeTokens.ts`. Components may read from tokens, but should not scatter design constants across many files unless the value is a one-off positional value copied directly from the Figma frame.
