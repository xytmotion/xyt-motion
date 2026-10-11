# Changelog

## 0.2.0

First release as a library.

- Language: `canvas` shapes (16:9, 9:16, any ratio from 1:5 to 5:1), `input` values the page can change live,
  `keys()` keyframes (numbers or colors), easing (`easein`, `easeout`, `backout`, `bounce`), pointer values `mx` and `my`,
  `bpm` offset, scene `fade`/`fadein`/`fadeout`, n-pointed `star`, comparisons `<= >= == !=` and `&& ||`, `lerp` and `saturate`.
- `repeat` compiles to GPU loops instead of copies: much smaller shaders (the 30-second cartoon went from 71 KB to 34 KB).
- `Player` class: aspect-aware sizing, adaptive resolution, pause when off screen, reduced-motion still frames,
  external clock for audio sync, live inputs, exact frame rendering for export, WebGL context-loss recovery.
- `<xyt-player>` custom element.
- `reference`: the compact language reference for language models, also in docs/llm-reference.md.
- Compile results report `cost` (shapes per pixel, with `noise` and `fbm` counting as several), `warnings`,
  `inputs`, `scenes` and `defines`. Programs above a cost of 2,000 are rejected.
- `xyt 0.2` declares the language version a program is written for.
- `Player` option `still`; `<xyt-player still>` and viewers who prefer reduced motion see the still frame (`poster`).
- TypeScript types.
- Fixes: very flat ellipses drew a line across the picture; shapes thinner than a pixel left hairlines;
  duration now follows the last scene when not set; names starting or ending with `_` (or containing `__`)
  and `clamp` with a color and a number as limits compiled but were rejected by the GPU;
  `#rrggbbaa` colors now get an error that explains what to write.

## 0.1.0

Prototype: shapes, `fill`, `let`, `repeat`, `scene`, `define`, `bpm`, noise, and a playground.
