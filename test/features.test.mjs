// Tests for the 0.4 features: fn, anchors and attach, bounds, sim, smooth, cues, bar() and tracks,
// depth and shake, and one shader per scene. Run: npm test  (no GPU needed; test/gpu.mjs draws them)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/index.js';

const firstError = (src) => (compile(src).errors[0] || {}).message || '';
const ok = (src, label) => { const r = compile(src); assert.equal(r.ok, true, `${label || src}: ${JSON.stringify(r.errors)}`); return r; };
const near = (a, b, eps, label) => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} is not within ${eps} of ${b}`);
// the per-frame values at time t, by name
const values = (r, t, inputs = {}) => {
  const s = r.frames.run(inputs), v = s.at(t);
  return Object.fromEntries(r.frames.names.map((n, i) => [n, v[i]]));
};

test('fn: a formula with its own values, written once', () => {
  const r = ok('fn hill(x) = 0.8 - 0.1 * x\nfn tint(c, k)\n  let m = k * 0.5\n  return mix(c, white, m)\nend\nfill tint(navy, y)\ncircle cy=hill(0.3) color=tint(gold, 0.2)');
  assert.match(r.glsl, /float F_hill_0\(float a_x\)/, 'its values may reuse built-in names like x');
  assert.match(r.glsl, /vec3 F_tint_\d\(vec3 a_c, float a_k\)/, 'compiled for the kinds of values it is given');
  assert.deepEqual(r.fns, ['hill', 'tint']);
  assert.match(firstError('fn f(a) = a\ncircle r=f(1, 2)'), /f\(\) takes 1 value: f\(a\)/);
  assert.match(firstError('fn f(a) = a * nope\ncircle'), /unknown name 'nope'.*Inside fn f/);
  assert.equal(compile('fn f(a) = a * nope\ncircle').errors[0].line, 1, 'reported at the fn');
  assert.match(firstError('fn mix(a) = a\ncircle'), /'mix' is a built-in function/);
  assert.match(firstError('circle r=f(1)\nfn f(a) = a'), /fn f is written further down/);
  assert.match(firstError('fn f(a) = a * f(a)\ncircle'), /can't use itself/);
  assert.match(firstError('fn f(a)\n  return a\n  let b = 1\nend\ncircle'), /return is the last line/);
  assert.match(firstError('fn f(a)\n  let b = a\nend\ncircle'), /has no return line/);
  assert.match(firstError('fn f(a)\n  circle\n  return a\nend'), /a fn holds let lines and one return line/);
  assert.match(firstError('scene 0 1\n fn f(a) = a\nend\ncircle'), /fn must be at the top level/);
  assert.match(firstError('fn f(a) = a * st\ncircle'), /'st' is not available inside fn f/);
  assert.match(firstError('return 1\ncircle'), /return only goes in a fn block/);
  // a fn costs one shape and its noise at every use
  assert.equal(compile('fn n(a) = noise(a, 1)\nfill gray(n(x) + n(y))').cost, 7);
});

test('anchors, name= and attach=: a drawing shows its points to the lines below it', () => {
  const kid = 'define kid cx=0.5 cy=0.8 s=1 reach=0\n  group cx=cx cy=cy - 0.3 * s angle=reach\n    line x1=cx y1=cy - 0.3 * s x2=cx + 0.15 * s y2=cy - 0.3 * s\n    anchor hand x=cx + 0.15 * s y=cy - 0.3 * s angle=0\n  end\n  circle cx=cx cy=cy - 0.2 * s r=0.1 * s\nend\n';
  const r = ok(kid + 'kid name=mila cx=0.4 reach=30 flip=-1\ncircle attach=mila.hand r=0.02 color=red\nline x1=mila.cx y1=0.9 x2=mila.hand.x y2=mila.hand.y\nrect cx=0.5 angle=mila.hand.angle');
  assert.match(r.glsl, /void P_kid\(float a_cx, float a_cy, float a_s, float a_reach\)/, 'a function works out the anchors');
  assert.match(r.glsl, /AN_kid_hand = vec3\(ap, aa\)/);
  assert.match(r.glsl, /fwd\(i_\d+\.xy, tc_\d+/, 'the call\'s own flip moves the anchor too');
  assert.equal(compile(kid + 'kid cx=0.4').glsl.includes('P_kid'), false, 'only named drawings work out their anchors');
  // a define can attach to a named drawing inside another define
  ok(kid + 'define boat cx=0.5 cy=0.5\n  tri x1=cx - 0.05 y1=cy x2=cx + 0.05 y2=cy x3=cx y3=cy - 0.05\nend\ndefine scene2 cx=0.5\n  kid name=k cx=cx\n  boat attach=k.hand\n  anchor top x=k.hand.x y=k.hand.y - 0.05\nend\nscene2 name=sc\ncircle attach=sc.top r=0.01');
  assert.match(firstError(kid + 'kid name=mila\ncircle attach=mila.foot'), /attach= takes a point of a named drawing/);
  assert.match(firstError(kid + 'kid name=mila\ncircle attach=mila.hand cx=0.3'), /attach= sets cx and cy; leave cx out/);
  assert.match(firstError(kid + 'kid name=mila\nline attach=mila.hand'), /line has none/);
  assert.match(firstError(kid + 'kid name=mila\ncircle r=mila.foot.x'), /mila has no 'foot\.x'\. It has: cx, cy, s, reach, hand/);
  assert.match(firstError(kid + 'kid name=mila\ncircle r=mila.hand'), /'mila\.hand' is a point; use mila\.hand\.x and mila\.hand\.y/);
  assert.match(firstError(kid + 'circle r=mila.hand.x'), /'mila' is not a named drawing or a sim here/);
  assert.match(firstError(kid + 'kid name=1'), /name= takes a plain name/);
  assert.match(firstError('anchor a x=0 y=0\ncircle'), /anchor only goes inside a define/);
  assert.match(firstError('define d cx=0.5\n repeat i 2\n  anchor a x=i y=0\n end\n circle\nend\nd'), /an anchor can't go inside a repeat/);
  assert.match(firstError('define d cx=0.5\n anchor a x=0.1\n circle\nend\nd'), /anchor a needs x and y/);
  assert.match(firstError('let mila.x = 1\ncircle'), /a name can't have dots/);
});

test('bounds: pixels outside the circle skip the drawing, and it counts once', () => {
  const tree = 'define tree cx=0.5 cy=0.8 s=1\n  bounds cx=cx cy=cy - 0.15 * s r=0.2 * s\n' + Array(10).fill('  circle cx=cx cy=cy - 0.1 * s r=0.05 * s').join('\n') + '\nend\n';
  const r = ok(tree + 'fill navy\nrepeat i 8\n  tree cx=0.1 + i * 0.1\nend');
  assert.match(r.glsl, /if \(length\(PP - vec2\(\(a_cx\), \(\(a_cy - \(0\.15 \* a_s\)\)\)\)\) - abs\(\(\(0\.2 \* a_s\)\)\) > PX\) \{ return col; \}/);
  assert.equal(r.cost, 1 + 8 + 10, 'fill, the eight bounds tests, and one tree');
  assert.equal(r.worstCost, 1 + 8 * 10, 'if all eight trees covered the same pixel');
  const stacked = compile('define d cx=0.5\n bounds cx=cx cy=0.5 r=10\n' + Array(100).fill(' circle cx=cx').join('\n') + '\nend\nrepeat i 500\n d cx=i\nend');
  assert.match(stacked.errors[0].message, /if all the drawings with bounds covered the same pixel, it would cost about 50000 shapes, over the limit/, 'the limit holds for the worst case');
  assert.match(firstError('define d cx=0.5\n circle\n group\n  bounds cx=0 cy=0 r=1\n  circle\n end\nend\nd'), /bounds goes directly inside a define/);
  assert.match(firstError('define d cx=0.5\n bounds cx=0.5 cy=0.5\n circle\nend\nd'), /bounds needs cx, cy and r/);
  assert.match(firstError('define d cx=0.5\n bounds cx=0.5 cy=0.5 r=1\n bounds cx=0.5 cy=0.5 r=1\n circle\nend\nd'), /already has bounds/);
});

test('sim: a ball falls, bounces and settles, worked out before the first frame', () => {
  const r = ok('sim ball\n  state x = 0.2\n  state y = 0.1\n  state vy = 0\n  vy += 2 * dt\n  y += vy * dt\n  x += 0.1 * dt\n  if y > 0.8 && vy > 0\n    y = 0.8\n    vy = -0.5 * vy\n  end\nend\nduration 6\ncircle cx=ball.x cy=ball.y r=0.03');
  assert.deepEqual(r.sims, ['ball']);
  assert.deepEqual(r.frames.names, ['ball.x', 'ball.y', 'ball.vy']);
  assert.match(r.glsl, /uniform vec4 u_fv\[1\];/);
  assert.match(r.glsl, /cx=|u_fv\[0\]\.x/);
  const v = (t) => values(r, t);
  near(v(0)['ball.y'], 0.1, 1e-6, 'starts where it is put');
  near(v(0.5)['ball.y'], 0.1 + 0.5 * 2 * 0.25, 0.005, 'free fall: y0 + g t^2 / 2');
  near(v(3)['ball.x'], 0.2 + 0.3, 1e-4, 'x moves steadily');
  const fall = Math.sqrt(2 * 0.7 / 2);
  assert.ok(v(fall + 0.05)['ball.vy'] < 0, 'it bounces up after landing');
  assert.ok(v(5.9)['ball.y'] <= 0.8 + 1e-6, 'never below the floor');
  // the values follow the program's inputs
  const w = ok('input g = 1\nsim s\n  state v = 0\n  v += g * dt\nend\ncircle cy=s.v');
  assert.equal(w.frames.usesInputs, true);
  near(values(w, 1, { g: 1 })['s.v'], 1, 0.01, 'g = 1');
  near(values(w, 1, { g: 3 })['s.v'], 3, 0.03, 'g = 3');
  assert.equal(ok('sim s\n  state v = 0\n  v += dt\nend\ncircle cy=s.v').frames.usesInputs, false);
  // a sim may use fns, cues, bar(), tracks and the sims above it
  ok('bpm 120\ncue go 1\ntrack k step=1 0 1\nfn f(a) = a * 2\nsim a\n  state p = 0\n  if t > go\n    p += f(k) * dt\n  end\nend\nsim b\n  state q = 0\n  q = a.p + bar(2)\nend\ncircle cx=b.q');
});

test('sim: helpful errors', () => {
  assert.match(firstError('sim s\n  state v = 0\n  w += 1\nend\ncircle'), /'w' is not a state of sim s; declare it above with: state w = 0/);
  assert.match(firstError('sim s\n  state v = x\nend\ncircle'), /sim s uses 'x', which changes from pixel to pixel/);
  assert.match(firstError('sim s\n  state v = 0\n  v = mix(red, blue, 0.5)\nend\ncircle'), /works with numbers/);
  assert.match(firstError('sim s\n  state v = 0\n  circle\nend'), /a sim holds state, let, if and else lines/);
  assert.match(firstError('sim s\n  let k = 1\nend\ncircle'), /sim s has no state/);
  assert.match(firstError('if t > 1\nend\ncircle'), /if only goes inside a sim block/);
  assert.match(firstError('sim s\n  state v = 0\n  if v > 1\n    state w = 0\n  end\nend\ncircle'), /state goes directly inside a sim/);
  assert.match(firstError('sim s\n  state v = 0\nend\ncircle r=s'), /'s' is a sim; read its states like s\.v/);
  assert.match(firstError('sim s\n  state v = 0\nend\ncircle r=s.w'), /s has no 'w'\. It has: v/);
  assert.match(firstError('sim s step=0.5\n  state v = 0\nend\ncircle'), /sim step must be between/);
  assert.match(firstError('duration 3600\nsim s step=0.0001\n' + Array(20).fill('  state v = 0\n  v += dt').map((l, i) => l.replace(/v/g, 'v' + i)).join('\n') + '\nend\ncircle'), /would take too long to work out/);
  assert.equal(ok('sim s\n  state x = 0\n  state y = 0\nend\ncircle cx=s.x cy=s.y').ok, true, 'states may be named x and y');
});

test('smooth: a value followed with a lag, for cameras that follow', () => {
  const r = ok('duration 4\nscene 0 4\n  let target = (st > 1) * 0.5\n  camera cx=smooth(target, 0.5)\n  circle\nend');
  const v = (t) => values(r, t).smooth;
  near(v(0.9), 0, 1e-9, 'still before the step');
  assert.ok(v(1.2) > 0.01 && v(1.2) < 0.45, `catching up: ${v(1.2)}`);
  near(v(1.5), 0.5, 0.05, 'about there after the lag');
  near(v(3), 0.5, 1e-3, 'settled');
  assert.ok(Math.max(...Array.from({ length: 30 }, (_, i) => v(1 + i * 0.1))) <= 0.5 + 1e-6, 'no overshoot');
  assert.match(firstError('let k = smooth(x, 0.5)\ncircle'), /smooth\(\) uses 'x', which changes from pixel to pixel/);
  assert.match(firstError('repeat i 3\n  circle cx=smooth(i, 1)\nend'), /changes from pixel to pixel/);
  assert.match(firstError('define d cx=0.5\n  circle cx=smooth(cx, 1)\nend\nd'), /smooth\(\) works in scenes and at the top level/);
  assert.match(firstError('let k = smooth(0.5)\ncircle'), /smooth\(\) takes a value and about how many seconds/);
  assert.equal(ok('input a = 0.2\nlet k = smooth(a + 0.1, 1)\ncircle r=k').frames.usesInputs, true);
});

test('cues and bar(): name the moments of the song', () => {
  const r = ok('bpm 120 offset=0.5\ncue land 2\ncue big land + bar(3) - 0.5\nscene land big fade=0.2\n  circle r=0.1 + 0.1 * hits(t, land, big)\nend\nscene bar(9) bar(9, 3)\n  fill red\nend');
  assert.deepEqual(r.cues, [{ name: 'land', time: 2 }, { name: 'big', time: 6 }], 'bar(3) is 0.5 + 8 beats of 0.5 s');
  assert.deepEqual(r.scenes.map((s) => [s.start, s.end]), [[2, 6], [16.5, 17.5]]);
  assert.equal(r.duration, 17.5, 'the duration follows the last scene');
  assert.match(r.glsl, /hit\(T - 2\.0\)/, 'a cue is a number in the shader');
  assert.match(ok('bpm 120\ncircle r=bar(1 + floor(t))').glsl, /\(0\.0 \+ \(\(1\.0 \+ floor\(T\)\) - 1\.0\) \* 2\.0 \+ \(1\.0 - 1\.0\) \* 0\.5\)/, 'bar() works on any formula');
  assert.equal(ok('cue end1 3\nduration end1 + 1\ncircle').duration, 4);
  assert.match(firstError('scene nope 3\n circle\nend'), /a scene time must be a number, a cue name or bar\(\.\.\.\); 'nope' is not a cue/);
  assert.match(firstError('cue a b + 1\ncue b 1\ncircle'), /'b' is not a cue named above/);
  assert.match(firstError('cue a 1\ncue a 2\ncircle'), /cue 'a' is named twice/);
  assert.match(firstError('cue t 1\ncircle'), /'t' is a built-in value/);
  assert.match(firstError('input go = 1\ncue go 2\ncircle'), /'go' is already the name of an input/);
  assert.match(firstError('scene 4 3\n circle\nend'), /end time in seconds, end after start/);
  assert.match(firstError('cue a 4\nscene a 3\n circle\nend'), /this scene ends \(3 s\) before it starts \(4 s\)/);
  assert.equal(ok('scene bars 1 2\n circle\nend').scenes[0].end, 4, 'scene bars still counts bars');
  assert.equal(ok('let track = 1\nlet cue = 2\ncircle r=0.1 * track * cue').ok, true, 'the new commands are still fine as names');
});

test('track: values over time, from a song or anywhere', () => {
  const r = ok('track level step=0.5 0 1 0.5 0.2\ncircle r=0.1 * level');
  assert.match(r.glsl, /r=|0\.1 \* u_fv\[0\]\.x/);
  const v = (t) => values(r, t).level;
  near(v(0), 0, 1e-6, 'first value');
  near(v(0.25), 0.5, 1e-6, 'halfway between values');
  near(v(0.5), 1, 1e-6, 'second value');
  near(v(9), 0.2, 1e-6, 'holds the last value');
  assert.match(firstError('track k 0 1\ncircle'), /track needs a name, step=/);
  assert.match(firstError('track k step=0.1\ncircle'), /track needs a name, step=/);
  assert.match(firstError('track k step=0.1 0 a\ncircle'), /each value of a track needs a plain number/);
});

test('depth: groups farther away follow the camera more slowly', () => {
  const r = ok('scene 0 4\n  camera cx=0.5 + st zoom=1 + st\n  group depth=3\n    circle\n  end\n  group depth=0.5 angle=10\n    circle\n  end\nend');
  assert.match(r.glsl, /float dk_\d+ = 1\.0 \/ max\(3\.0, 0\.01\);/);
  assert.match(r.glsl, /pow\(abs\(ts_\d+\), dk_\d+\)/);
  assert.match(firstError('group depth=2\n circle\nend'), /it needs a camera line above it/);
  assert.match(firstError('camera zoom=2\ngroup angle=5\n group depth=2\n  circle\n end\nend'), /directly in its camera's block/);
  assert.match(firstError('camera depth=2\ncircle'), /camera has no 'depth'/);
});

test('shake: a camera that shakes on impacts', () => {
  const r = ok('camera shake=0.02 * hits(t, 1)\ncircle');
  assert.match(r.glsl, /float sk = \(\(0\.02 \* hit\(T - 1\.0\)\)\);/);
  assert.equal(compile('camera\ncircle').glsl.includes('float sk'), false, 'nothing when it does not shake');
});

test('one shader per stretch of time between scene changes', () => {
  const src = 'define a cx=0.5\n  circle cx=cx color=red\nend\ndefine b cx=0.5\n  ring cx=cx\nend\nfill navy\nscene 0 2\n  a\nend\nscene 1.5 4 fadein=0.5\n  b\nend\nscene 4 6\n  fill gold\nend\nduration 7';
  const r = ok(src);
  assert.equal(r.parts, null, 'small programs keep one shader');
  const s = compile(src, { split: true });
  assert.deepEqual(s.parts.map((p) => [p.start, p.end]), [[0, 1.5], [1.5, 2], [2, 4], [4, 6], [6, 7]]);
  const has = (p, f) => s.parts[p].glsl.includes(f + '(');
  assert.deepEqual([has(0, 'f_a'), has(0, 'f_b')], [true, false], 'only what plays');
  assert.deepEqual([has(1, 'f_a'), has(1, 'f_b')], [true, true], 'both while they cross-fade');
  assert.deepEqual([has(2, 'f_a'), has(2, 'f_b'), has(3, 'f_b'), has(4, 'f_b')], [false, true, false, false]);
  assert.ok(s.parts.every((p) => p.glsl.includes('col = vec3(0.07')), 'the lines outside scenes are in every part');
  assert.equal(compile(src, { split: false }).parts, null);
});

test('fixes found in review: sim steps, starting values, names and errors', () => {
  near(values(ok('sim c step=0.1\n  state n = 0\n  n += 1\nend\ncircle r=c.n'), 1)['c.n'], 10, 1e-6, 'step=0.1 takes ten steps a second');
  near(values(ok('sim c step=0.001\n  state n = 0\n  n += 1\nend\ncircle r=c.n'), 1)['c.n'], 1000, 1e-6, 'step=0.001 takes a thousand');
  near(values(ok('sim c\n  let g = 2\n  state v = g * 3\nend\ncircle r=c.v'), 0)['c.v'], 6, 1e-9, 'a starting value may use a let above it');
  assert.match(firstError('sim c\n  state v = 0\n  v = smooth(t, 1)\nend\ncircle'), /smooth\(\) can't go inside a sim/);
  assert.match(firstError('define d cx=0.5\n  circle\nend\nsim ball\n  state y = 0\nend\nd name=ball'), /'ball' is already the name of a sim/);
  assert.equal(compile('sim s step=0\n  state v = 0\nend\ncircle').errors.length, 1, 'a bad step is the only error');
  assert.equal(compile('define d cx=0.5\n  anchor a x=1 y=1 angle=red\n  circle\nend\nd name=k').errors.length, 1, 'reported once');
  const many = 'duration 3600\nsim s step=0.0001\n' + Array(20).fill(0).map((_, i) => `  state v${i} = 0\n  v${i} += dt`).join('\n') + '\nend\ncircle';
  assert.match(firstError(many), /too long/);
  assert.equal(compile(many.replace('step=0.0001', 'step=0.1')).ok, true, 'a larger step makes it affordable');
});

test('the cost and simulation limits hold against programs from strangers', () => {
  const chain = (n) => 'fn f0(x) = sin(x)\n' + Array.from({ length: n }, (_, i) => `fn f${i + 1}(x) = f${i}(x) + f${i}(x + 1)`).join('\n') + '\n';
  assert.match(firstError(chain(30) + 'fill gray(f30(x))'), /every pixel costs about 2147483648 shapes, over the limit/, 'fns calling fns count all their work');
  assert.equal(compile(chain(6) + 'fill gray(f6(x))').ok, true, 'a few levels are fine');
  const t0 = Date.now();
  assert.match(firstError(chain(40) + 'sim s\n  state v = 0\n  v += f40(t) * dt\nend\ncircle r=s.v'), /would take too long to work out/);
  assert.match(firstError(chain(40) + 'sim s\n  state v = f40(1)\nend\ncircle r=s.v'), /starting values of sim s would take too long/);
  assert.match(firstError(chain(40) + 'let k = smooth(f40(t), 1)\ncircle r=k'), /would take too long to work out/);
  assert.ok(Date.now() - t0 < 2000, 'refused before running');
  // a named drawing pays for working out its anchors
  const named = 'define d cx=0.5\n  let k = fbm(cx, 1)\n  anchor a x=k y=0.5\n  circle cx=cx\nend\n';
  assert.equal(compile(named + 'd name=n').cost - compile(named + 'd').cost, 10, 'the anchors\' fbm');
  // an hour of 200 values is kept in about 32 MB at most
  const wide = compile('duration 3600\nsim s step=0.1\n' + Array.from({ length: 200 }, (_, i) => `  state v${i} = ${i}`).join('\n') + '\nend\ncircle r=s.v1');
  assert.ok(wide.frames.run({}).table.length <= 8e6 + 1000, `${wide.frames.run({}).table.length} numbers kept`);
  near(values(wide, 1800)['s.v7'], 7, 1e-6, 'still right');
});
