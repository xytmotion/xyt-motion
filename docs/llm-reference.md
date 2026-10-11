# XYT reference for language models

Give this text to a model together with a request, and ask it to reply with only the XYT program.
It is also exported by the library as `reference`.

```text
XYT: describe pictures and motion with formulas of x, y and t.

Coordinates: y goes 0 (top) to 1 (bottom). x goes 0 (left) to aspect (right); aspect is 1 on the default square canvas.
Time: t = seconds since the start; the animation loops every "duration" seconds (default 4, or the end of the last scene).
p = t / duration, the loop progress from 0 to 1. Any value can be a formula using x, y, t, p.
Lines are drawn in order: later lines paint over earlier ones. Comments start with //.

Setup (top of the program, all optional):
canvas 16:9                        // or canvas 9:16, canvas 1:1 (default). Then x goes 0 to aspect (1.778 for 16:9)
duration 8
bpm 120 offset=0                   // tempo for beat and pulse; offset = seconds before the first beat
input wind = 0.5 min=0 max=1       // a value the host page can change live (number or color)

Drawing (one command per line, values are named):
fill COLOR alpha=1                 // paints every pixel; COLOR can vary with x, y, t
circle  cx= cy= r=
ellipse cx= cy= rx= ry= angle=
rect    cx= cy= w= h= radius= angle=   // centered at cx,cy; radius rounds corners
line    x1= y1= x2= y2= width=
tri     x1= y1= x2= y2= x3= y3=
ring    cx= cy= r= width=
arc     cx= cy= r= width= start= end=  // part of a ring; degrees, 0 = right, 90 = down
star    cx= cy= r= inner= points= angle=   // inner = 0-1 depth of the points, default 5 points
Every shape also takes: color= alpha= (0 to 1) blur= (soft edge width) stroke= (outline width instead of filled).
Sizes and positions share the same units (1 = canvas height). angle is in degrees, clockwise.
A shape's color can vary per pixel, like color=mix(red, yellow, y).
let name = formula                 // reusable number or color, may use x, y, t

Blocks (close each with end):
repeat i 12                        // i = 0, 1, ..., 11
scene 6 12 fade=0.5                // only draws from 6 s to 12 s; fade (or fadein/fadeout) in seconds
                                   // inside a scene: st = seconds since the scene began, sp = scene progress 0-1
define hero cx=0.5 cy=0.5 s=1 tint=gold   // a reusable drawing (character, cloud) with named values and defaults
end
hero cx=0.3 s=0.8                  // draw it anywhere, as often as needed, changing only what differs
Inside define, use its own values plus x, y, t and inputs; pass anything else in as a value. Define it above where it is used.

Colors: #rgb or #rrggbb, rgb(r,g,b) with 0-1 values, hsl(hue_degrees, s, l) with s and l 0-1, gray(v),
names: white black red green blue yellow orange purple pink cyan magenta gray navy teal brown gold sky.
Color math works: mix(c1, c2, k), c * 0.5, c1 + c2.

Math: + - * / % ^ and < > (give 1 or 0), sin cos tan abs floor ceil fract round sqrt exp log sign
min max clamp(v) clamp(v,lo,hi) mix(a,b,k) smoothstep(edge0,edge1,v) step(edge,v) atan2(y,x) pow(a,b)
dist(x1,y1,x2,y2) = distance between two points. Constants: pi tau.
Motion: keys(t, 0, 0.2, 1.5, 0.8, 3, 0.2) moves smoothly through values at key times (values may be colors);
ease(v) easein(v) easeout(v) backout(v) (overshoots) bounce(v) take 0-1 progress; pingpong(v) goes 0 to 1 to 0 each unit.
Randomness: noise(a,b) or noise(a,b,c) smooth 0-1; fbm(a,b) or fbm(a,b,c) cloudy 0-1; hash(n) fixed random 0-1 per number.
Rhythm: beat = beats since the first beat, pulse = 1 on every beat, fading to 0 before the next.
Pointer: mx, my = where the viewer's pointer is (canvas center until it moves).
Math is safe: no errors from sqrt, pow or log of negatives.

Example:
duration 4
fill mix(#0b1a33, #2c5aa0, y)
let hop = abs(sin(p * tau))
define ball cx=0.5 cy=0.5 tint=orange
  circle cx=cx cy=cy r=0.07 color=tint
  circle cx=cx - 0.02 cy=cy - 0.02 r=0.02 color=white alpha=0.6
end
ball cx=keys(t, 0, 0.2, 2, 0.8, 4, 0.2) cy=0.82 - 0.5 * hop
repeat i 5
  circle cx=0.1 + i * 0.2 cy=0.94 r=0.02 color=white alpha=0.3 + 0.7 * pulse
end
```
