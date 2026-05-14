# Figma Nodes

## File

```text
fileKey: w8o9pOMZKhCMWaRzc6s4gw
fileName: IntelliDeploy
page: 88:1782 移动端UI
```

## Sections

```text
129:1390 浅色模式
119:100718 深色模式
129:1388 参考
88:1783 产出区域
```

## Light Main UI

Default frame:

```text
266:21147 主界面
size: 375 x 812
```

Prototype states:

```text
268:22904 主界面 / App Gallery expanded
268:23238 主界面 / 我的产品 expanded
268:23572 主界面 / 广场 expanded
268:23906 主界面 / 个人主页 expanded
188:16287 主界面 / avatar hover reference
188:16759 主界面 / word cloud press reference
```

Known route targets in the same Figma section:

```text
164:6118 chat bot对话界面
168:6258 App Gallery
168:6299 我的产品
168:6358 广场
```

Only `/chatbot` and `/app-gallery` currently exist in the local Expo Router tree.

## Dark Main UI

Main dark frame:

```text
95:1783 深色：应用商店参考2
size: 375 x 2088
```

Dark visual references:

```text
98:2203 深色：应用商店参考1
103:75409 深色全局参考
```

## Implementation Interpretation

Light mode is the mobile homepage with:

- Header
- Avatar and Mibo entry
- Inspiration cloud
- Feature square cards
- Glass bottom navigation

Dark mode is the mobile AppMarket homepage with:

- AppMarket top header
- Search and notification entry
- Hero recommendation
- Stats
- Categories
- Rankings
- Editor pick
- Latest recommendations
- Dark bottom navigation

Light and dark mode are not the same screen with only different colors.
