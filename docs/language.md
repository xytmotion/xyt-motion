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

Sizes use the same units as positions, so 1 is always the canvas height and circles stay round on any canvas shape.

## Setup lines

These go at the top level (outside blocks), usually at the top of the program.

| Line | Effect |
|---|---|
| `xyt 0.2` | the language version the program is written for. Optional; best on the first line. A library older than the program reports that it needs updating instead of guessing. |
| `canvas 16:9` | canvas shape: `W:H`, `W H` (pixels, only the ratio matters), a single ratio, or `square`, `wide`, `landscape`, `tall`, `portrait`, `cinema`. Allowed from 1:5 to 5:1. Default 1:1. |
| `duration 8` | loop length in seconds, or in bars: `duration bars 16` (the end of bar 16). Default: the end of the last scene, or 4. |
| `bpm 120 offset=0.3 bar=4` | tempo for `beat` and `pulse`; `offset` is the time of the first beat; `bar` is the number of beats per bar. Default 120, offset 0, 4 beats per bar. |
| `use text` | the commands of a plugin the page has loaded; see [Plugins](#plugins). |
| `input wind = 0.5 min=0 max=1` | a value the host page can change while the animation runs. The starting value is a plain number or a color (`#ff8800`, `gold`). `min` and `max` are hints for user interfaces. |

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

### group

```text
group cx=0.9 cy=0.12 angle=30 * spring(t - 1)
  ...
end
```

Everything inside turns by `angle` (degrees, clockwise) and scales by `scale` around `cx`, `cy` (default: the canvas center), is mirrored left to right by `flip=-1`, then moves by `dx`, `dy`. The lines inside keep their usual coordinates, so a drawing turns in place around any point: a bell around its hanger, an arm around its shoulder. Groups nest. Inside, `x` and `y` follow the group, so gradients and textures turn with it (`mx` and `my` stay in canvas units). Edges stay one pixel wide at any scale, and `flip` can pass smoothly through 0 for a turn-around. Accepted alternatives: `x`/`y` for `cx`/`cy`, `rotation` or `rotate` for `angle`, `zoom` for `scale`, `mirror` for `flip`.

### camera

```text
scene 0 10
  camera cx=0.89 cy=0.49 zoom=keys(st, 0, 1, 8, 3)
  ...
end
```

Works like a `group` around every following line of its block (the whole program, a scene, a repeat or a define), without an `end`. `zoom=2` makes everything twice as big around `cx`, `cy`, which stays in place on screen; `dx`, `dy` move the picture. A later camera in the same block replaces the earlier one.

### clip

```text
clip circle cx=aspect / 2 cy=0.5 r=1.2 * ease(st)
  ...
end
```

Draws the lines inside only within the shape: any shape with its usual values, plus `blur` for a soft edge, `stroke` to clip to an outline, and `invert=1` to draw only outside it. The shape itself isn't drawn, so it takes no color or alpha. Pixels outside the shape skip the lines inside, so a clip costs little. Use it for iris transitions, windows and masks.

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
| `noise(a, b)`, `noise(a, b, c)` | smooth random 0 to 1 |
| `fbm(a, b)`, `fbm(a, b, c)` | layered, cloudy noise 0 to 1 |
| `hash(n)`, `hash(a, b)` | fixed random 0 to 1 per input |

## Errors

The compiler reports every problem it can find at once, each with a line number, and suggests a fix when it can ("circle has no 'colr'. Did you mean 'color'? It takes: cx, cy, r, color, alpha, blur, stroke"). The player keeps showing the last working version while a program has errors.

## Limits

- `repeat` counts up to 500. The cost per pixel (`cost` in the compile result) is capped at 2,000 shapes, with `noise` counting as 2 (4 with three values) and `fbm` as 10 (20); `compile` warns above 400. `costs` lists which lines the cost comes from, and `compile` warns when `repeat` multiplies a define's cost past 100.
- No images, and no filled free-form shapes (curves are lines); text comes from the text plugin.
- A program has no memory between frames: it is a pure function of position, time and inputs.

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

Accepted alternatives: `cx`/`cy` for `x`/`y`, `height` for `size`, `thickness` for `weight`, `progress` for `reveal`.

It draws ASCII letters, digits and punctuation; accented Latin letters for French, Spanish, Portuguese, German, Serbian and Croatian, Czech and most of Polish (é è ê ë à ç ñ ü ö œ æ č ć š ž đ ř ě ň ń ś ź, with their capitals); and « » ’ “ ” – — …. Other characters are an error that names them. Each text line costs about 2 shapes plus one per six characters: a pixel only measures the strokes of the letters near it.

The letters are the Hershey Roman Simplex font. The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the U. S. National Bureau of Standards. The format of the Font data in this distribution was originally created by James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821 (mit-eddie!ci-dandelion!hurt).
