# Font sources

Retrieved on 2026-11-11.

## Alibaba PuHuiTi 3.0

The source `AlibabaPuHuiTi-3-*.ttf` files were downloaded from Alibaba's
official font CDN:

- <https://fonts.alibabagroup.com/#/font>
- `https://fonts.alibabadesign.com/AlibabaPuHuiTi-3/<font-name>/<font-name>.ttf`

Alibaba describes Alibaba PuHuiTi as permanently free for commercial use.
Refer to the official font site for its current terms.

The Web bundle contains WOFF2 subsets for the marketing page's static text:

- `AlibabaPuHuiTi-3-55-Regular-subset.woff2`
- `AlibabaPuHuiTi-3-75-SemiBold-subset.woff2`

They were generated with fontTools `pyftsubset` from the source TTF files.
Dynamic community and SKU text falls back to the system `PingFang SC` family
when a character is outside the static subset.

## Google Fonts families

These variable TTF files were downloaded from the official Google Fonts
repository and are licensed under the SIL Open Font License 1.1 in
`OFL-1.1.txt`:

- Inter: <https://github.com/google/fonts/tree/main/ofl/inter>
  - Copyright 2020 The Inter Project Authors (<https://github.com/rsms/inter>)
- Ibarra Real Nova: <https://github.com/google/fonts/tree/main/ofl/ibarrarealnova>
  - Copyright 2007 The Ibarra Real Nova Project Authors (<https://github.com/googlefonts/ibarrareal>)
- Pixelify Sans: <https://github.com/google/fonts/tree/main/ofl/pixelifysans>
  - Copyright 2021 The Pixelify Sans Project Authors (<https://github.com/eifetx/Pixelify-Sans>)
- Instrument Sans: <https://github.com/google/fonts/tree/main/ofl/instrumentsans>
  - Copyright 2022 The Instrument Sans Project Authors (<https://github.com/Instrument/instrument-sans>)

## ZiTiQuanWeiJunHei

`ZiTiQuanWeiJunHei-W3-subset.woff2` is a WOFF2 subset generated with
fontTools `pyftsubset` from the downloaded source font and contains only the
static marketing headline characters used by the Web homepage.

## PingFang SC

`PingFangUI.ttc` is copied from the current macOS installation at:

`/System/Library/PrivateFrameworks/FontServices.framework/Versions/A/Resources/Reserved/PingFangUI.ttc`

The TTC includes PingFang SC Regular, Ultralight, Thin, Light, Medium, and
Semibold faces, together with other Apple UI font faces. PingFang is Apple
font software and is governed by the applicable Apple software license.
Do not redistribute it separately unless the project has the necessary
rights. On Apple platforms, prefer the system `PingFang SC` family instead
of bundling this file.
