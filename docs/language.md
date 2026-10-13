# The XYT language

An XYT program describes one picture as a function of position and time. The renderer asks it, for every pixel and every frame, "what color is the point (x, y) at time t?"

## Basics

- One statement per line. Comments start with `//` anywhere, or `#` at the start of a line.
- Lines draw in order: each one paints over what came before. The canvas starts black.
- Values are named: `circle cx=0.5 cy=0.5 r=0.1`. Unnamed values are an error, which keeps programs readable and unambiguous.
- Spaces inside formulas are fine: `cx=0.5 + 0.1 * sin(t) cy=0.5` is two values.
- Every value is either a **number** or a **color**, and the compiler checks which one each place expects.

## Space and time

| Name | Meaning |
|---|---|
| `x` | horizontal position, 0 at the left, `aspect` at the right |
| `y` | vertical position, 0 at the top, 1 at the bottom |
| `aspect` | canvas width ÷ height; 1 on the default square canvas |
| `t` | seconds since the start, wrapping at the duration |
| `p` | `t / duration`, loop progress from 0 to 1 |
| `dur` | the duration in seconds |
| `beat` | beats since the first beat (see `bpm`) |
| `pulse` | 1 on each beat, fading toward 0 before the next |
| `mx`, `my` | the viewer's pointer, in the same units as x and y (the canvas center until it moves) |
| `pi`, `tau` | 3.14159…, 6.28318… |
| `st`, `sp`, `sb` | inside a `scene`: seconds since the scene began, its progress from 0 to 1, and beats since it began |

Names with dots read the values of things a program names: `mila.hand.x` (an anchor of a drawing drawn with `name=mila`), `ball.y` (a state of `sim ball`).

Sizes use the same units as positions, so 1 is always the canvas height and circles stay round on any canvas shape.

## Setup lines

These go at the top level (outside blocks), usually at the top of the program.

| Line | Effect |
|---|---|
| `xyt 0.4` | the language version the program is written for. Optional; best on the first line. A library older than the program reports that it needs updating instead of guessing. |
| `canvas 16:9` | canvas shape: `W:H`, `W H` (pixels, only the ratio matters), a single ratio, or `square`, `wide`, `landscape`, `tall`, `portrait`, `cinema`. Allowed from 1:5 to 5:1. Default 1:1. |
| `duration 8` | loop length in seconds, or in bars: `duration bars 16` (the end of bar 16), or a formula of cues and `bar()`: `duration outro + 2`. Default: the end of the last scene, or 4. |
| `bpm 120 offset=0.3 bar=4` | tempo for `beat` and `pulse`; `offset` is the time of the first beat; `bar` is the number of beats per bar. Default 120, offset 0, 4 beats per bar. |
| `use text` | the commands of a plugin the page has loaded; see [Plugins](#plugins). |
| `input wind = 0.5 min=0 max=1` | a value the host page can change while the animation runs. The starting value is a plain number or a color (`#ff8800`, `gold`). `min` and `max` are hints for user interfaces. |
| `cue drop 32.5` | names a moment of the song, in seconds or as a formula of earlier cues and `bar()`: `cue chorus bar(17)`, `cue end2 drop + 8`. A cue is a number everywhere, in defines and fns too: `scene drop chorus`, `hits(t, drop)`. |
| `track level step=0.05 0 0.1 0.4 ...` | values over time, one every `step` seconds, joined by straight lines; `level` is then the value at the current time, everywhere. `xyt cues song.mp3` writes one with the song's loudness. |

## Drawing

### fill

`fill COLOR alpha=1` paints every pixel. With a formula for the color it becomes a gradient, a texture or a whole scene:

```text
fill mix(#1b1f4a, #ffb35c, y)
fill hsl(200 + 40 * sin(x * 10 + t), 0.8, 0.5)
fill white alpha=smoothstep(0.5, 0.7, fbm(x * 3 + t * 0.1, y * 4))
```

### Shapes

| Shape | Values (defaults) |
|---|---|
| `circle` | `cx=0.5 cy=0.5 r=0.1` |
| `ellipse` | `cx=0.5 cy=0.5 rx=0.15 ry=0.1 angle=0` |
| `rect` | `cx=0.5 cy=0.5 w=0.3 h=0.2 radius=0 angle=0` (centered; `radius` rounds corners) |
| `line` | `x1=0.2 y1=0.5 x2=0.8 y2=0.5 width=0.01` (round ends) |
| `tri` | `x1=0.5 y1=0.2 x2=0.8 y2=0.8 x3=0.2 y3=0.8` |
| `ring` | `cx=0.5 cy=0.5 r=0.2 width=0.02` |
| `arc` | `cx=0.5 cy=0.5 r=0.2 width=0.02 start=180 end=360` (degrees; 0 = right, 90 = down) |
| `star` | `cx=0.5 cy=0.5 r=0.1 inner=0.45 points=5 angle=0` (`inner` = inner radius ÷ outer radius) |
| `curve` | `x1=0.2 y1=0.6 cx=0.5 cy=0.3 x2=0.8 y2=0.6 width=0.01`: a line from (x1, y1) to (x2, y2) bent toward the control point (cx, cy), a quadratic Bézier curve. Smiles, ropes, tails, hair. |

Every shape also takes:

| Value | Default | |
|---|---|---|
| `color` | white | may vary per pixel: `color=mix(red, yellow, y)` |
| `alpha` | 1 | 0 to 1 |
| `blur` | 0 | width of a soft edge; large values make glows |
| `stroke` | 0 | outline width; when set, only the outline is drawn |

Angles are in degrees, clockwise. Shapes thinner than a pixel fade in proportion to their thickness, so shrinking a shape to zero size makes it disappear cleanly.

Accepted alternatives: `radius` for `r` (circle, ring, arc, star), `x`/`y` for `cx`/`cy`, `width`/`height` for `w`/`h` on rect, `rotation` or `rotate` for `angle`, `thickness` for `width`, `opacity` for `alpha`, `from`/`to` for arc `start`/`end`, `qx`/`qy` for curve `cx`/`cy`, `outline` for `stroke`. Commands: `rectangle`, `square` and `box` mean `rect`, `triangle` means `tri`, `oval` means `ellipse`, `bezier` means `curve`, `background` and `bg` mean `fill`.

### let

`let name = formula` names a number or a color for the lines below it. It may use x, y and t, so it can differ per pixel.

Names use letters, digits and `_`, up to 64 characters. They may be anything except the built-in values (`x`, `y`, `t`, `p`, `dur`, `aspect`, `beat`, `pulse`, `mx`, `my`, `pi`, `tau`), commands and shape names. Function and color names are fine: `let bounce = ...` or `let sky = ...` simply take over that name for the rest of the program (calls like `bounce(p)` still work, since they have parentheses).

```text
let wave = 0.6 + 0.02 * sin(x * 20 + t * 3)
fill mix(#1f6fb8, #0a2f5c, y) alpha=step(wave, y)
```

## Blocks

Blocks end with `end`. Indentation is optional but recommended.

### repeat

```text
repeat i 12
  circle cx=0.5 + 0.3 * cos(i / 12 * tau) cy=0.5 + 0.3 * sin(i / 12 * tau) r=0.03
end
```

`i` runs 0, 1, …, count − 1 (count up to 500; repeats can nest). It becomes a loop on the GPU, so the shader stays small. `hash(i)` gives each copy its own fixed random numbers.

### scene

```text
scene 6 12 fade=0.5
  ...
end
```

Draws only from 6 s to 12 s. Inside, `st` is the time since the scene began, `sp` its progress from 0 to 1 and `sb` the beats since it began.

The times can be formulas of cues and `bar()`: `scene drop drop + 4`, `scene bar(9) bar(17)` (from the start of bar 9 to the start of bar 17).

Scenes can be timed in bars instead: `scene bars 9 16` plays bars 9 to 16, counting from 1 with both ends included, the way musicians count. The times follow `bpm`, its `offset` and its beats per `bar`, so changing the tempo moves every scene with the music. `fade` fades in and out over that many seconds (`fadein` and `fadeout` set one side). A fading scene blends over whatever was drawn before it, so overlapping two scenes gives a crossfade. Scenes go at the top level.

### define

```text
define bird cx=0.5 cy=0.5 s=1 tint=white
  ellipse cx=cx cy=cy rx=0.05 * s ry=0.03 * s color=tint
end

bird cx=0.3 s=0.8
bird cx=0.7 tint=gold
```

A reusable drawing with named values and defaults; use its name as a command. Inside, only its own values, `input`s and built-ins exist: pass anything else in as a value. A define must appear above its first use, and it may use defines written before it. This is how a character stays identical across every scene.

A define call also takes `angle`, `scale`, `flip`, `dx` and `dy`, as a `group` around the drawing: `bird cx=0.3 cy=0.6 angle=20 flip=-1` turns and mirrors the bird around its own `cx`, `cy` (around the canvas center if the define has no `cx` and `cy`). If the define has a value with one of those names, its own value wins.

#### Anchors: points a drawing shows to the lines below it

```text
define kid cx=0.5 cy=0.8 s=1 reach=0
  group cx=cx cy=cy - 0.3 * s angle=reach
    line x1=cx y1=cy - 0.3 * s x2=cx + 0.15 * s y2=cy - 0.3 * s width=0.02 * s
    anchor hand x=cx + 0.15 * s y=cy - 0.3 * s angle=reach
  end
  ...
end

kid name=mila cx=0.4 reach=30 * sin(t) flip=-1
boat attach=mila.hand s=0.5            // the boat sits in her hand, wherever the arm goes
line x1=mila.hand.x y1=mila.hand.y x2=1 y2=0.2
```

`anchor NAME x= y= angle=` names a point of the drawing, in the define's own coordinates; groups and cameras around it inside the define are taken into account, so a hand at the end of a turning arm is where the arm draws it. `name=mila` on a define call lets the lines below it (in the same block) read `mila.hand.x`, `mila.hand.y` and `mila.hand.angle`, and the call's own values: `mila.cx`. `attach=mila.hand` on a shape or a define call sets its `cx` and `cy` (`x`, `y` for text) to that point; to turn with it as well, add `angle=mila.hand.angle`. Anchors go in the define itself or inside its groups, not inside `repeat` or `clip`. The point is in the coordinates of the line that drew the drawing (the call's `angle`, `scale` and `flip` included), so read it in the same block.

#### bounds: a faster drawing

```text
define tree cx=0.5 cy=0.8 s=1
  bounds cx=cx cy=cy - 0.15 * s r=0.2 * s
  ...
end
```

`bounds cx= cy= r=` is the circle the whole drawing stays within, glows and shadows included. Pixels outside it skip the drawing, so a scene of forty trees costs each pixel about one tree. Anything drawn outside the circle is cut off, so leave some room. In `cost`, a drawing with bounds counts once, at its heaviest, plus one for each use; `worstCost` is what it would be if they all covered the same pixel.

### group

```text
group cx=0.9 cy=0.12 angle=30 * spring(t - 1)
  ...
end
```

Everything inside turns by `angle` (degrees, clockwise) and scales by `scale` around `cx`, `cy` (default: the canvas center), is mirrored left to right by `flip=-1`, then moves by `dx`, `dy`. The lines inside keep their usual coordinates, so a drawing turns in place around any point: a bell around its hanger, an arm around its shoulder. Groups nest. Inside, `x` and `y` follow the group, so gradients and textures turn with it (`mx` and `my` stay in canvas units). Edges stay one pixel wide at any scale, and `flip` can pass smoothly through 0 for a turn-around. Accepted alternatives: `x`/`y` for `cx`/`cy`, `rotation` or `rotate` for `angle`, `zoom` for `scale`, `mirror` for `flip`.

Parallax: under a `camera`, `group depth=3` moves and zooms the lines inside as if they were three times farther away, so they follow the camera a third as much (`depth=0.5`: nearer, twice as much). The group sits directly in the camera's block or scene. A large depth (100) is nearly still.

```text
scene 0 20
  camera cx=hero_x dx=aspect / 2 - hero_x
  group depth=6
    ...mountains...
  end
  group depth=2
    ...hills...
  end
  ...the ground and the hero, which move with the camera...
end
```

### camera

```text
scene 0 10
  camera cx=0.89 cy=0.49 zoom=keys(st, 0, 1, 8, 3)
  ...
end
```

Works like a `group` around every following line of its block (the whole program, a scene, a repeat or a define), without an `end`. `zoom=2` makes everything twice as big around `cx`, `cy`, which stays in place on screen; `dx`, `dy` move the picture. A later camera in the same block replaces the earlier one.

`shake=0.02` shakes the picture by about that much, with a little turn: `shake=0.03 * hits(t, crash)` for a bump on an impact (groups take it too). A camera that follows something smoothly uses `smooth()`: `camera cx=smooth(ball.x, 0.6)`.

### clip

```text
clip circle cx=aspect / 2 cy=0.5 r=1.2 * ease(st)
  ...
end
```

Draws the lines inside only within the shape: any shape with its usual values, plus `blur` for a soft edge, `stroke` to clip to an outline, and `invert=1` to draw only outside it. The shape itself isn't drawn, so it takes no color or alpha. Pixels outside the shape skip the lines inside, so a clip costs little. Use it for iris transitions, windows and masks.

### fn

```text
fn hill(x) = 0.8 - 0.1 * x + 0.02 * sin(x * 6)
fn shade(c, k)
  let m = clamp(k)
  return mix(c, black, m)
end

fill shade(sky, y)
circle cx=fish_x cy=hill(fish_x) - 0.02 r=0.02      // the fish lies on the drawn hill
fill white alpha=step(hill(x), y)                    // the hill itself, from the same formula
```

Your own function: values in parentheses, then `=` and a formula, or a block of `let` lines ending with `return`. Use it like a built-in, anywhere below it, with numbers or colors. Like a define, it sees only its own values (which may reuse built-in names like `x`), inputs, cues, tracks, sims and built-ins, and the fns above it; it can't use itself. Formulas written once stay consistent: a character standing on a hill and the hill drawn from the same `fn` can't drift apart.

### sim

```text
sim ball
  state y = 0.2           // starting values
  state vy = 0
  vy += 2.5 * dt          // gravity
  y += vy * dt
  if y > 0.8 && vy > 0    // the floor
    y = 0.8
    vy = -0.6 * vy
  end
end

circle cx=0.5 cy=ball.y r=0.05
```

Values with memory: a sim's states are worked out step by step (240 a second, or `step=`) from the start of the animation, before the first frame, on the CPU. Each frame reads them at its time, so the program stays a pure function of time: seeking and exporting give exactly the same frames. A sim holds `state NAME = start`, `let` lines, lines that change a state (`=`, `+=`, `-=`, `*=`, `/=`) and `if` ... `else` ... `end`. Inside, `t` is the time and `dt` the length of a step; a sim can use inputs, cues, tracks, fns, `bar()` and the sims above it, but not values that change from pixel to pixel (`x`, `y`, the pointer) or the lines of a scene. Its states may be called `x`, `y` or `p`, since pixels don't exist there. Outside, read them as `ball.y`, everywhere below the sim (in defines too). When a sim uses an input, it is worked out again when the input changes.

### smooth

```text
scene 0 20
  let hero_x = keys(st, 0, 0.3, 4, 1.6, 9, 3.2)
  camera cx=smooth(hero_x, 0.6) dx=aspect / 2 - smooth(hero_x, 0.6)
  ...
end
```

`smooth(value, seconds)` follows a value the way a camera operator would: it catches up in about `seconds`, starts and stops gently, and never overshoots. The value must be the same for the whole frame (made from `t`, `st`, cues, inputs, sims and lets of those, not `x`, `y` or a loop counter); it works in scenes and at the top level, not inside a define or fn. Like a sim, it is worked out before the first frame.

## Colors

- `#rgb`, `#rrggbb` (no transparency part: use `alpha=`)
- `rgb(r, g, b)` with 0 to 1 values, `gray(v)`, `hsl(hue, s, l)` with hue in degrees and s, l from 0 to 1
- names: `white black red green blue yellow orange purple pink cyan magenta gray grey navy teal brown gold sky`
- math: `mix(c1, c2, k)`, `c * 0.5`, `c1 + c2`, `c * c2`; a number used where a color is expected becomes a gray

## Operators

`+ - * / % ^`, comparisons `< > <= >= == !=` (1 or 0), and `&& ||` on such conditions. `^` is power and binds tighter than unary minus, so `-2^2` is −4. Conditions multiply naturally: `alpha=(t > 2) * (t < 4)`.

## Functions

| Function | |
|---|---|
| `sin cos tan asin acos atan abs floor ceil fract round sign exp` | as usual; work on colors too |
| `sqrt log pow(a, b)` | safe: never NaN |
| `min max mod` | two values |
| `clamp(v)` or `clamp(v, lo, hi)` | `clamp(v)` keeps 0 to 1; `saturate(v)` too |
| `mix(a, b, k)` | blend numbers or colors; `lerp` too |
| `smoothstep(e0, e1, v)` | reversed edges work |
| `step(edge, v)` | 0 below the edge, 1 above |
| `atan2(y, x)` | angle in radians |
| `dist(x1, y1, x2, y2)`, `dist(dx, dy)` | distance |
| `keys(time, t0, v0, t1, v1, …)` | smooth movement through values at key times; values may be colors; holds the first and last value outside the keys |
| `ease(v) easein(v) easeout(v) backout(v) bounce(v)` | easing curves for progress from 0 to 1 (`backout` overshoots, `bounce` settles) |
| `pingpong(v)` | 0 → 1 → 0 once per unit |
| `spring(t, freq, damping)` | 0 before `t` = 0, then swings between −1 and 1 at `freq` per second and dies out at rate `damping` (defaults 2 and 4): `angle=30 * spring(t - 1.5)` rings a bell at 1.5 s |
| `hits(t, t1, t2, …)` | 1 at each listed time, fading to 0 within about half a second: flashes, bumps and sound rings at chosen moments |
| `bar(n)`, `bar(n, beat)` | the time in seconds of bar `n` (and a beat in it), counting from 1, from `bpm` and its `offset`: `keys(t, bar(9), 0, bar(9, 3), 1)` |
| `smooth(value, seconds)` | follows a value with a gentle lag; see [smooth](#smooth) |
| `noise(a, b)`, `noise(a, b, c)` | smooth random 0 to 1 |
| `fbm(a, b)`, `fbm(a, b, c)` | layered, cloudy noise 0 to 1 |
| `hash(n)`, `hash(a, b)` | fixed random 0 to 1 per input |

## Errors

The compiler reports every problem it can find at once, each with a line number, and suggests a fix when it can ("circle has no 'colr'. Did you mean 'color'? It takes: cx, cy, r, color, alpha, blur, stroke"). The player keeps showing the last working version while a program has errors.

## Limits

- `repeat` counts up to 500. The cost per pixel (`cost` in the compile result) is capped at 2,000 shapes (20,000 for local files rendered with `xyt render`, or with `compile(src, { maxCost })`), with `noise` counting as 2 (4 with three values), `fbm` as 10 (20), and a `fn` as 1 plus its body at every use; `compile` warns above 400. `costs` lists which lines the cost comes from, and `compile` warns when `repeat` multiplies a define's cost past 100. Drawings with `bounds` count once.
- No images, and no filled free-form shapes (curves are lines); text comes from the text plugin.
- A program has no memory between frames: it is a pure function of position, time and inputs. Sims and `smooth()` have memory within one run of the animation, worked out before it plays, so their values too depend only on the time and inputs. Up to 256 sim states, tracks and smooth values, and simulating them must stay under about 40 million steps.
- Long programs with many scenes become one shader per stretch of time with the same scenes, built when first needed: a 4-minute film draws like a short one.

## Plugins

Plugins add commands without making the library bigger for everyone. The page loads the plugin, and a program that wants it says so at the top:

```text
use text
```

A program can only name a plugin the page has loaded; it can never load code. If the page hasn't loaded it, `compile` says how to.

### text

```text
use text
text "Frère Jacques" x=aspect / 2 y=0.7 size=0.06 color=white
text "Frère Jacques" x=aspect / 2 y=0.7 size=0.06 color=gold reveal=sp
```

One line of text, drawn with strokes like the other shapes, so it takes `color`, `alpha`, `blur` and `stroke`, turns and scales in a `group`, and works in `clip` (`clip text "XYT" size=0.3` draws what is inside only within the letters).

| Value | Default | |
|---|---|---|
| `x`, `y` | 0.5 | where the text goes: `y` is the middle of the capitals, `x` depends on `align` |
| `size` | 0.1 | height of the capital letters |
| `align` | `center` | `left`, `center` or `right` of `x`, or a number from 0 to 1 |
| `weight` | 0.12 | stroke width, relative to `size` |
| `spacing` | 0 | extra space between letters, relative to `size` |
| `reveal` | 1 | how much of the text shows, from the left: draw a line in white, then again in gold with `reveal=sp`, and the gold sweeps across like karaoke |
| `font` | | the name of a loaded font to look letters up in first, like `font=cyrillic`; a name, not a formula |

Accepted alternatives: `cx`/`cy` for `x`/`y`, `height` for `size`, `thickness` for `weight`, `progress` for `reveal`.

It draws ASCII letters, digits and punctuation; accented Latin letters for French, Spanish, Portuguese, German, Serbian and Croatian, Czech and most of Polish (é è ê ë à ç ñ ü ö œ æ č ć š ž đ ř ě ň ń ś ź, with their capitals); and « » ’ “ ” – — …. Other characters are an error that names them and the fonts loaded. Each text line costs about 2 shapes plus one per six characters: a pixel only measures the strokes of the letters near it.

#### Fonts

The page can add stroke fonts. Each letter comes from the first loaded font that has it, so adding a Cyrillic font makes `text "Привет"` work as it is; `font=NAME` looks in that font first for one line. An accented letter a font lacks is composed from its letter and the accent (Й from И, Ё from Е), and Ј Ѕ І are drawn as their Latin twins when no font has them.

```js
import text from 'xyt-motion/text';
import cyrillic from 'xyt-motion/text/cyrillic';   // or load dist/xyt-text-cyrillic.min.js after the plugin
text.addFont(cyrillic);
text.addFont({ name: 'plotter', svg: svgFontFile });   // an SVG font: each glyph names its character
text.addFont({ name: 'mine', jhf: jhfFile, chars: 'АБВ…' });   // a Hershey .jhf file and the character of each glyph
text.addFont({ name: 'tiny', glyphs: { 'Ж': { width: 20, strokes: [[[0, 9], [10, -12], [20, 9]]] } } });
```

`.jhf` and `glyphs` use Hershey's units: y points down, capitals run from −12 to the baseline at 9 (give `capHeight` and `baseline` otherwise). SVG fonts are scaled by their `cap-height`, or by the height of their H. SVG paths may use `M L H V Z C S Q T`; curves become short segments. `text.fonts()` lists the loaded fonts; when there are several, the plugin's model reference lists them too.

`xyt-motion/text/cyrillic` is the Russian alphabet from Hershey's serif Cyrillic (the only Cyrillic in the Hershey distribution), so it doesn't match the sans Latin letters. A font that has the Serbian Ђ Љ Њ Ћ Џ can be added the same way. The command line adds fonts with `--font file.svg`.

The built-in letters are the Hershey Roman Simplex font, and the optional Cyrillic font is Hershey's Cyrillic. The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the U. S. National Bureau of Standards. The format of the Font data in this distribution was originally created by James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821 (mit-eddie!ci-dandelion!hurt).
