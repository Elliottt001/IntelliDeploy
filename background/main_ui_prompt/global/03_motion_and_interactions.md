# Motion And Interactions

## Figma Prototype Data

Light default main frame `266:21147`:

```text
Mibo link
trigger: ON_CLICK
destination: 164:6118
transition: SLIDE_IN LEFT, 0.6s, EASE_IN
local route: /chatbot

Avatar
trigger: ON_HOVER
destination: 188:16287
transition: SMART_ANIMATE, 1.022s, GENTLE
mobile mapping: press / long press emphasis

Word cloud
trigger: ON_PRESS
destination: 188:16759
transition: SMART_ANIMATE, 1.022s, GENTLE
mobile mapping: press toggles cloud state

App Gallery card
trigger: ON_HOVER
destination: 268:22904
transition: SMART_ANIMATE, 0.6388s, GENTLE
mobile mapping: press expands card, CTA opens /app-gallery

My Products card
trigger: ON_HOVER
destination: 268:23238
transition: SMART_ANIMATE, 0.6388s, GENTLE
mobile mapping: press expands card

Square card
trigger: ON_HOVER
destination: 268:23572
transition: SMART_ANIMATE, 0.6388s, GENTLE
mobile mapping: press expands card

Profile card
trigger: ON_HOVER
destination: 268:23906
transition: SMART_ANIMATE, 0.6388s, GENTLE
mobile mapping: press expands card

Expanded App Gallery click
trigger: ON_CLICK
destination: 168:6258
transition: SLIDE_IN TOP, 0.3s, EASE_IN_AND_OUT
local route: /app-gallery

Global native route transition
trigger: route push from mobile homepage
transition: slide_from_bottom / bottom-to-top fly-in
local mapping: Expo Router native-stack `animation: 'slide_from_bottom'`, 600ms when supported

Arrow/settings instance
trigger: ON_HOVER
navigation: CHANGE_TO 248:20537
transition: SMART_ANIMATE, 1.287s, CUSTOM_SPRING mass 1 stiffness 145 damping 11.4
mobile mapping: press scale/spring
```

## React Native Mapping

Use built-in `Animated` first:

- Intro stagger for header, hero, cloud, cards, bottom nav.
- Floating ambient avatar/background loop.
- Card height/opacity interpolation for expanded states.
- Press scale for buttons, arrows and nav items.
- Word cloud crossfade/translate when changing batch.
- Dark AppMarket section stagger on first render.

Avoid adding animation dependencies unless required after implementation review.

## Navigation Mapping

Allowed route pushes:

```text
/chatbot
/app-gallery
```

Video-approved route updates:

```text
/my-products
/square
```

Keep `个人主页` local until the product owner confirms a destination.
