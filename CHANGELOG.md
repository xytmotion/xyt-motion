# Changelog

## 0.4.0

From making a 4-minute film and a 2-minute cartoon in XYT: what kept coming back as long or wrong programs.

- `fn name(a, b) = formula`, or a block of `let` lines ending with `return`: your own functions, with numbers or
  colors, usable anywhere below them (one formula for a hill that is drawn and a hill a character stands on).
- Anchors: `anchor hand x= y= angle=` inside a define names a point, turned with the groups around it. Draw it with
  `name=mila`, then read `mila.hand.x`, `mila.hand.y`, `mila.hand.angle` and `mila.cx`, or put something there with
  `attach=mila.hand` (shapes and define calls). A prop held in a hand stays in the hand.
- `bounds cx= cy= r=` in a define: pixels outside the circle skip the drawing. The Pebble cartoon drew twice as fast
  with the same pixels. `cost` counts a bounded drawing once; `worstCost` is the old way of counting.
- `sim NAME` with `state`, lines that change states (`+=` and co.), `let` and `if`/`else`: physics and anything with
  memory, worked out before the first frame and read as `ball.y`. The program stays a pure function of time.
- `smooth(value, seconds)`: a value followed with a gentle lag, for cameras that follow a character.
- `cue name time` and `bar(n, beat)`: named moments of the song, usable everywhere, including scene times
  (`scene drop drop + 4`, `scene bar(9) bar(17)`) and `duration`. `track name step=0.05 values...`: values over time.
- `group depth=3` under a camera: parallax. `camera shake=`: a camera that shakes on impacts.
- Long programs become one shader per stretch of time with the same scenes (`compile(source, { split })`, the
  player's `split` option): a 4-minute film compiled and drew like a short one, 1.1 to 1.7 times faster per frame.
- `xyt cues song.mp3`: tempo, first beat, the strongest hits, where the music changes and its loudness over time, as
  lines to paste into a program (`--name drums` for a stem). `xyt render --sheet --from 90 --to 120`.
- Names with dots read the values of named drawings and sims. Language version 0.4. New example: rolling.

## 0.3.0

From the feedback of a model that wrote a one-minute cartoon in XYT.

- `group cx= cy= angle= scale= flip= dx= dy=` turns, scales, mirrors and moves the lines inside around a point;
  `camera` does the same for the rest of its block; define calls take `angle`, `scale`, `flip`, `dx` and `dy`.
- `clip SHAPE ...` draws the lines inside only within a shape, with `blur`, `stroke` and `invert`.
- `spring(t, freq, damping)` for swings that die out, `hits(t, t1, t2, ...)` for a flash at each listed time.
- Compile results list `costs`: which lines the cost comes from. A warning names the line when `repeat`
  multiplies a define's cost past 100.
- The `xyt` command line: `check`, and `render --at`, `--sheet`, `--mp4 --audio` with headless Chromium
  (Playwright, optional) and ffmpeg.
- `curve x1= y1= cx= cy= x2= y2= width=`: a quadratic Bézier curve.
- Timing in bars: `bpm 96 bar=4`, `scene bars 9 16` (from 1, both included), `duration bars 24`, and `sb`,
  the beats since a scene began.
- Plugins: the page loads them with `use(plugin)` (or a script tag), programs name them with `use NAME`.
- The text plugin (`xyt-motion/text`, `dist/xyt-text.min.js`): `text "..." x= y= size= align= weight= spacing= reveal=`
  with the Hershey Roman Simplex font, accented Latin letters including Serbian and Croatian, and `clip text`.
- Fonts for text: `text.addFont()` takes Hershey `.jhf`, SVG fonts or strokes; letters come from the first font
  that has them, `font=NAME` picks one first. `xyt-motion/text/cyrillic` (`dist/xyt-text-cyrillic.min.js`): the
  Russian alphabet in Hershey's serif Cyrillic. `xyt render --font file.svg`.
- Text draws the curves of stroke fonts as smooth splines through the font's points, so large text has
  round curves instead of visible facets; real corners stay sharp. A line of text measures each distinct
  letter once, at its nearest occurrence, so programs with a lot of text compile several times faster.
- `xyt render --mp4` is two to three times faster: frames travel from the browser as raw bytes over a
  local connection while the next one is drawn. It shows the time left while it works.
- New examples: bells, karaoke. Language version 0.3.

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
