# Design notes

## Where XYT came from

The starting question was whether images and video could be described pixel by pixel from x and y coordinates, with shortcuts like "this row is white from here to there." Measuring that idea gave the direction:

- Run-length encoding works for flat graphics (a progress bar's frames shrank by 99.5% with "skip unchanged pixels"), but on gradients and noise neighbouring pixels never match. The plasma example came out 17% larger than raw pixels.
- Describing the pixel instead of storing it, as `color = f(x, y, t)`, made the same animations 29 to 704 times smaller than H.264 video, with no fixed resolution.
- The formula has to be easy to write. Shader languages already express f(x, y, t), but one benchmark (ShaderMatch, 2025) found even the best open code models failed to produce working GLSL in 31% of cases, and hand-writing shaders is hard for people too. XYT is the friendly layer on top.

## Principles

1. **Every value can be a formula.** Position, size, color and alpha are all expressions of x, y, t. A gradient is one line; a texture is one line.
2. **Values are named.** `circle cx=0.5 cy=0.5 r=0.1`, never positional. Named values are self-documenting, order-free, and the single biggest reason models write correct programs on the first try.
3. **Forgiving in, precise out.** Common alternative names are accepted (`radius`, `opacity`, `rectangle`), reversed `smoothstep` edges work, `sqrt`, `pow` and `log` cannot produce NaN. A program that "means" something should draw it.
4. **Errors are instructions.** Every error has a line number, says what is wrong in plain words, suggests the closest valid name, and lists what is allowed. They are written to be pasted back to a model as much as read by a person; one round of feedback fixes most mistakes.
5. **Every feature must earn its tokens.** The model reference is part of every request, so the language stays small. A feature gets in when it removes a common source of long or wrong programs (keyframes, define), not because it is possible.
6. **A program is a pure function.** Output depends only on (x, y, t, inputs). That makes rendering deterministic, exports exact, programs safe to run from any source, and resolution irrelevant.
7. **One program, one shader.** Everything compiles to a single GLSL ES 1.00 fragment shader, so it runs on WebGL 1, which is practically every browser and phone.

## Decisions and trade-offs

- **Units: 1 = canvas height.** y runs 0 to 1, x runs 0 to `aspect`. Circles stay round on any canvas shape, and the square default keeps the simple case simple. The cost: on wide canvases, the horizontal center is `aspect / 2`, which models must be told.
- **y points down**, like screens, SVG and CSS. **Angles in degrees, clockwise**, because that is what designers and models expect.
- **Blocks close with `end`**, not indentation. Models miscount whitespace; an explicit `end` is robust, and indentation stays free for readability.
- **`repeat` is a GPU loop.** The prototype unrolled loops at compile time; the cartoon's shader was 71 KB. Real loops (GLSL ES 1.00 allows constant bounds) halved it and made 80-star skies cheap to compile.
- **`define` is a GLSL function** that takes the current color and returns it with the drawing added. Defines see only their own values, inputs and built-ins, so a character cannot silently depend on the scene around it. This is what keeps a character identical across scenes, the main problem for longer cartoons.
- **`scene` is a time-guarded block.** The GPU skips inactive scenes, so long pieces cost only what is on screen. Fades blend the scene over whatever was drawn before it, which gives crossfades for free.
- **`input` is a uniform.** Live data, games and UI state flow in without recompiling.
- **Thin shapes fade by thickness.** Shapes thinner than a pixel fade in proportion. Without this, a size-zero shape still left a hairline from anti-aliasing, and a blinking eye drew a line across the whole picture.
- **Default color is white, default canvas is black.** Something always shows, with maximum contrast.
- **Programs can declare their language version** with `xyt 0.2`. Nothing depends on it yet: it is there so later versions can keep old programs' meaning, and so an older library reports a newer program instead of misreading it.
- **Transforms turn around a point, and coordinates inside stay the same.** `group`, `camera` and define calls turn and scale around `cx`, `cy` instead of moving the origin, so a drawing written in canvas coordinates turns in place (a bell around its hanger) without being rewritten. In the shader it is one change of the sampling point, plus the pixel size, so edges stay sharp at any zoom. The first model-written cartoon spelled its camera out as `ox + X * z` 286 times; that is what `camera` replaces.
- **`camera` lasts until the end of its block.** One line per scene instead of wrapping the scene in a group.
- **`clip` blends like a scene fade**, by the shape's coverage, and pixels outside skip its contents.
- **The command line renders with the real player** in headless Chromium, so its frames are exactly what browsers show. Playwright is an optional dependency, and `xyt check` needs nothing, so the library stays dependency-free.
- **Plugins: the page loads them, programs only name them.** `use text` makes a loaded plugin's commands available; a program can never load code, so it stays safe from any source. A plugin brings its own section of the model reference, so models only pay tokens for what the page offers. Plugin shapes go through the same pipeline as built-in ones, so they get color, alpha, blur, stroke, transforms and clip for free. The plugin interface is internal for now: it becomes a public contract once a second plugin has proven it.
- **Text is a stroke font, not a texture.** The Hershey Roman Simplex font keeps "one program, one shader" and resolution independence. Each letter is one GLSL function and each text line checks a box per letter, so a pixel only measures the strokes of the letters near it. Accented letters are composed from the letter and a few accent strokes, in any font.
- **Fonts plug in instead of being drawn by hand.** `text.addFont()` takes Hershey `.jhf` files, SVG fonts and plain strokes, scaled to one set of metrics; each letter comes from the first font that has it, and `font=NAME` changes the order for a line. The Russian alphabet ships as an optional font from Hershey's serif Cyrillic, the only Cyrillic in that distribution; KiCad's single-stroke font covers more scripts, but it is GPL, which an MIT library can't include.
- **Bars count like musicians count.** `scene bars 9 16` means bars 9 to 16, from 1, both included, so consecutive scenes read `1 8`, `9 16`. Bars become seconds when the program compiles.
- **Curves fall back to a segment when nearly straight.** The exact distance to a quadratic Bézier solves a cubic that loses precision there: measured, curves within 0.00001 of straight drew hundreds of wrong pixels on both a GPU and SwiftShader.
- **`cost` is an estimate, and its limit is a safety net.** Programs come from models and strangers, and a single frame that takes seconds makes the browser drop the GPU context. `noise` and `fbm` count as several shapes because they are; the limit sits far above any real picture.

## Bugs the prototype taught us

- The fast ellipse distance formula breaks down for very flat ellipses and reported "on the edge" along an entire pixel row. Flat ellipses now use an exact segment distance.
- `destroy()` released the WebGL context, so a new player on the same canvas (or `<xyt-player>` moved in the page) drew black. It now frees only its own resources.
- With scenes and no `duration`, the loop stopped at the 4-second default. Duration now follows the last scene.
- Models write `>=`, `&&` and `||` naturally; the prototype rejected them. They are now part of the language.
- Names like `_orb`, `a_` or `a__b` became GLSL identifiers containing `__`, which GLSL reserves: `compile` said ok and the GPU refused. Names are now spelled safely in the shader.
- `<xyt-player>` looked for its inline program as soon as its opening tag was read, before the program was parsed, so the README's own example drew nothing when the library loaded first.
- Adaptive resolution only ever went down, and treated 30 fps as slow. On screens or power-saving modes held at 30 fps, every animation slowly turned blurry. It now keeps a lower resolution only if frames actually got faster, and tries higher ones again.
- A model's program could pass the old limit of 20,000 shapes per pixel with thousands of `fbm` calls and stall the GPU.

## Open questions

- **More fonts for text.** A single-stroke Cyrillic that matches the Latin and has the Serbian letters, and other scripts, under licenses an MIT library can ship.
- **Filled shapes from curves.** `curve` draws lines; a filled outline made of curves is the next step for characters, and the open part is a syntax a model can write reliably.
- **Sound.** The player already accepts an external clock (`() => audio.currentTime`) and `bpm`/`offset`. Next: song sections (`section chorus 32 48`) so a model can sync to a track's structure.
- **Performance at scale.** Every pixel evaluates every active shape. Bounding-box culling or tiling would help scenes with thousands of shapes.
- **Render-and-check loops.** Letting a model see its own rendered frame and correct it is the most promising way to raise quality beyond "it compiles." `xyt render --sheet` makes the frames; measuring how much they help is next.
