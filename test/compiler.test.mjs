// Unit tests for the parser and compiler. Run: npm test  (no GPU needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { compile, parse, reference, version, use } from '../src/index.js';
import text from '../src/plugins/text.js';

use(text); // some examples write text

const errorsOf = (src) => compile(src).errors.map((e) => `${e.line}: ${e.message}`);
const firstError = (src) => (compile(src).errors[0] || {}).message || '';

test('every example compiles', () => {
  for (const f of readdirSync('examples').filter((f) => f.endsWith('.xyt'))) {
    const r = compile(readFileSync('examples/' + f, 'utf8'));
    assert.deepEqual(r.errors, [], f);
  }
});

test('the example inside the LLM reference compiles', () => {
  const r = compile(reference.split('Example:\n')[1]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('minimal programs', () => {
  assert.equal(compile('fill red').ok, true);
  assert.equal(compile('circle').ok, true);
  assert.match(firstError(''), /nothing to draw/);
  assert.match(firstError('let a = 1'), /nothing to draw/);
});

test('operator precedence', () => {
  const ev = (n) => {
    if (n.t === 'num') return n.v;
    if (n.t === 'neg') return -ev(n.a);
    const ops = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '^': (a, b) => a ** b,
      '<': (a, b) => +(a < b), '>': (a, b) => +(a > b), '>=': (a, b) => +(a >= b), '&&': (a, b) => +(!!a && !!b), '||': (a, b) => +(!!a || !!b) };
    return ops[n.op](ev(n.a), ev(n.b));
  };
  const val = (s) => ev(parse('let v = ' + s).body[0].expr);
  assert.equal(val('-2^2'), -4);
  assert.equal(val('2^3^2'), 512);
  assert.equal(val('2+3*4'), 14);
  assert.equal(val('10-2-3'), 5);
  assert.equal(val('8/2/2'), 2);
  assert.equal(val('1 < 2 && 3 >= 3'), 1);
  assert.equal(val('0 || 1 > 2'), 0);
});

test('comments and hex colors', () => {
  assert.equal(compile('# a comment line\nfill #fff // trailing\n// another').ok, true);
  assert.equal(compile('#add more here\nfill #abc').ok, true); // '#add' at line start is a comment
  assert.equal(compile('fill mix(#123456, #abc, y)').ok, true);
});

test('helpful errors with line numbers and suggestions', () => {
  assert.match(firstError('circle colr=red'), /no 'colr'.*Did you mean 'color'/);
  assert.match(firstError('let a = sni(t)\nfill red'), /unknown function 'sni'.*Did you mean 'sin'/);
  assert.match(firstError('fill mix(red, blue)'), /mix\(\) takes 3 values, got 2/);
  assert.match(firstError('circle r=red'), /'r' must be a number, not a color/);
  assert.match(firstError('fill red\ncircle r=speed'), /unknown name 'speed'/);
  assert.match(firstError('fill sin'), /sin is a function/);
  assert.match(firstError('repeat i 3\ncircle'), /repeat has no matching 'end'/);
  assert.match(firstError('fill red\nend'), /'end' without a matching/);
  assert.match(firstError('circle 0.5 0.5'), /named values/);
  assert.match(firstError('let x = 1\nfill red'), /'x' is a built-in value/);
  assert.match(firstError('repeat i 501\ncircle\nend'), /repeat counts up to 500/);
  assert.equal(errorsOf('circle colr=red\nfill mix(red)')[1].startsWith('2:'), true, 'errors from several lines are all reported');
});

test('values may reuse function and color names', () => {
  const r = compile('let bounce = abs(sin(p * pi))\nlet sky = mix(navy, white, y)\nlet noise = 2\nfill sky\ncircle cy=0.8 - 0.5 * bounce + 0 * bounce(p) r=0.05 * noise color=gold');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(compile('input glow = 0.5\ndefine thing mix=1\n circle r=0.1 * mix\nend\nthing\nfill red alpha=glow').ok, true);
});

test('forgiving aliases', () => {
  assert.equal(compile('circle radius=0.2 opacity=0.5').ok, true);
  assert.equal(compile('rectangle x=0.5 y=0.5 width=0.2 height=0.1 rotation=45').ok, true);
  assert.equal(compile('triangle').ok, true);
  assert.equal(compile('fill lerp(red, blue, saturate(y * 2))').ok, true);
});

test('canvas shapes', () => {
  assert.equal(compile('canvas 16:9\nfill red').aspect.toFixed(4), (16 / 9).toFixed(4));
  assert.equal(compile('canvas 9:16\nfill red').aspect.toFixed(4), (9 / 16).toFixed(4));
  assert.equal(compile('canvas 1920 1080\nfill red').aspect.toFixed(4), (16 / 9).toFixed(4));
  assert.equal(compile('canvas wide\nfill red').aspectLabel, 'wide');
  assert.equal(compile('fill red').aspect, 1);
  assert.match(firstError('canvas 10:1\nfill red'), /between 1:5 and 5:1/);
  assert.match(firstError('fill red\nscene 0 1\ncanvas 16:9\nend'), /top level/);
});

test('duration: explicit, default, and from scenes', () => {
  assert.equal(compile('fill red').duration, 4);
  assert.equal(compile('duration 7\nfill red').duration, 7);
  assert.equal(compile('scene 0 3\nfill red\nend\nscene 3 9\nfill blue\nend').duration, 9);
  assert.equal(compile('duration 2\nscene 0 9\nfill red\nend').duration, 2);
});

test('scenes: timing values, fades and errors', () => {
  const r = compile('scene 1 5 fade=0.5\nfill red alpha=sp\ncircle r=st * 0.1\nend');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.scenes, [{ start: 1, end: 5, fadein: 0.5, fadeout: 0.5 }]);
  assert.match(r.glsl, /col = mix\(sv_\d+, col, 1\.0 \* clamp/);
  assert.match(firstError('fill red alpha=st'), /only exists inside a scene/);
  assert.match(firstError('scene 5 2\nfill red\nend'), /end after start/);
  assert.match(firstError('scene 0 2 fadd=1\nfill red\nend'), /Did you mean 'fade'/);
  assert.match(firstError('repeat i 2\nscene 0 1\nfill red\nend\nend'), /can't go inside/);
});

test('define: reusable drawings', () => {
  const src = 'define bird cx=0.5 cy=0.5 tint=gold\n  circle cx=cx cy=cy r=0.05 color=tint\nend\nbird cx=0.2\nbird tint=#ff0000';
  const r = compile(src);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.defines, ['bird']);
  assert.match(r.glsl, /vec3 f_bird\(vec3 col, float a_cx, float a_cy, vec3 a_tint\)/);
  assert.equal(r.cost, 2);
  assert.match(firstError(src.replace('bird cx=0.2', 'bird size=2')), /bird has no 'size'/);
  assert.match(firstError('bird cx=0.2\ndefine bird cx=0\n circle\nend'), /defined further down/);
  assert.match(firstError('define a cx=0\n circle r=st\nend\na'), /not available inside define/);
  assert.match(firstError('define a cx=0\n a cx=1\nend\na'), /can't be used inside its own define/);
  assert.match(firstError('let k = 1\ndefine a cx=0\n circle r=k\nend\na'), /Inside define a, only its own values/);
  assert.match(firstError('define circle r=1\nend'), /built-in name/);
});

test('repeat becomes a GPU loop, and cost multiplies', () => {
  const r = compile('repeat i 50\n  circle cx=hash(i)\nend');
  assert.match(r.glsl, /for \(int k_\d+ = 0; k_\d+ < 50;/);
  assert.equal(r.cost, 50);
  assert.equal(compile('repeat i 10\nrepeat j 10\ncircle\nend\nend').cost, 100);
  const s = compile('fill red\nscene 0 1\nrepeat i 30\ncircle\nend\nend\nscene 1 2\ncircle\nend');
  assert.equal(s.cost, 31, 'scenes count their largest, not their sum');
  assert.equal(compile('repeat i 500\nrepeat j 2\ncircle\nend\nend').warnings.length, 1);
});

test('inputs: declared values the host can change', () => {
  const r = compile('input wind = 0.25 min=0 max=2\ninput tint = #ff0000\ninput dip = -1\nfill mix(navy, tint, wind + dip)');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.inputs, [
    { name: 'wind', kind: 'num', value: 0.25, min: 0, max: 2 },
    { name: 'tint', kind: 'col', value: [1, 0, 0], min: null, max: null },
    { name: 'dip', kind: 'num', value: -1, min: null, max: null },
  ]);
  assert.match(r.glsl, /uniform float u_in_wind;/);
  assert.match(r.glsl, /uniform vec3 u_in_tint;/);
  assert.match(firstError('input w = t\nfill red'), /plain number or color/);
  assert.match(firstError('input w = 1\ninput w = 2\nfill red'), /declared twice/);
});

test('keys and easing', () => {
  assert.equal(compile('circle cx=keys(t, 0, 0.2, 1, 0.8, 2, 0.2)').ok, true);
  assert.equal(compile('fill keys(t, 0, red, 2, blue)').ok, true);
  assert.equal(compile('circle cy=ease(p) + easein(p) + easeout(p) + backout(p) + bounce(p)').ok, true);
  assert.match(firstError('circle cx=keys(t, 0, 1)'), /keys\(\) takes a time, then pairs/);
  assert.match(firstError('circle cx=keys(t, red, 1, 2, 3)'), /key time and must be a number/);
});

test('rhythm, pointer and aspect built-ins', () => {
  const r = compile('bpm 128 offset=0.25\ncanvas 16:9\ncircle cx=mx cy=my r=0.05 + 0.02 * pulse\nrect cx=aspect/2 w=aspect h=0.1 alpha=fract(beat)');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.bpm, 128);
  assert.equal(r.offset, 0.25);
  assert.match(r.glsl, /BEAT = \(T - 0\.25\) \* 2\.1333333;/);
});

test('all shapes and shared options', () => {
  const r = compile([
    'circle cx=0.5 cy=0.5 r=0.1 color=red alpha=0.5 blur=0.01 stroke=0.01',
    'ellipse rx=0.2 ry=0.1 angle=30', 'rect w=0.3 h=0.2 radius=0.02 angle=10', 'line x1=0 y1=0 x2=1 y2=1 width=0.01',
    'tri x1=0.5 y1=0.1 x2=0.9 y2=0.9 x3=0.1 y3=0.9', 'ring r=0.3 width=0.02', 'arc r=0.2 start=0 end=90 width=0.02',
    'star r=0.2 inner=0.4 points=7 angle=10',
  ].join('\n'));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.cost, 8);
});

test('names that would make reserved GLSL identifiers', () => {
  // GLSL reserves identifiers containing '__'; the prefixes the compiler adds must never create one
  const r = compile('input _wind = 0.5\nlet a__b = 0.5\nlet c_ = 1\ndefine _orb cx_=0.5\n circle cx=cx_\nend\n_orb cx_=a__b * c_ * _wind\nrepeat _i 2\n circle cx=_i\nend');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.doesNotMatch(r.glsl, /__/);
  assert.notEqual(compile('input a_b = 1\ninput aZ1b = 2\nfill gray(a_b + aZ1b)').glsl.match(/uniform float (\w+);/g).length, 1, 'distinct names stay distinct');
  assert.match(firstError(`let ${'a'.repeat(65)} = 1\nfill red`), /too long/);
});

test('clamp with color limits uses an overload GLSL has', () => {
  const r = compile('fill clamp(red, 0.2, blue)');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.match(r.glsl, /clamp\(vec3\([^)]*\),vec3\(0\.2\),vec3/);
});

test('colors with a transparency part explain what to write instead', () => {
  assert.match(firstError('circle color=#ff000080 r=0.2'), /'#ff000080' has a transparency part.*#ff0000 and alpha=0\.5/);
  assert.match(firstError('fill #f008'), /'#f008' has a transparency part.*#f00 and alpha=0\.53/);
  assert.equal(compile('fill red // #ff000080 in a comment').ok, true);
});

test('xyt declares the language version', () => {
  assert.equal(compile('xyt 0.2\nfill red').ok, true);
  assert.equal(compile('xyt 0.1 // older programs still run\nfill red').ok, true);
  assert.equal(parse('xyt 0.2\nfill red').version, '0.2');
  assert.equal(compile('xyt 0.3\nfill red').ok, true);
  assert.match(firstError('xyt 0.4\nfill red'), /written for XYT 0\.4, newer than this library/);
  assert.match(firstError('xyt 1.0\nfill red'), /newer than this library/);
  assert.match(firstError('xyt two\nfill red'), /like: xyt 0\.3/);
});

test('cost counts noise and fbm as several shapes, and stops runaway programs', () => {
  assert.equal(compile('fill gray(noise(x, y))').cost, 3);
  assert.equal(compile('fill gray(fbm(x, y, t))').cost, 21);
  assert.equal(compile('let k = fbm(x, y)\nfill gray(k)').cost, 11);
  assert.equal(compile('repeat i 10\n circle cx=noise(i, t)\nend').cost, 30);
  assert.equal(compile('define cloud cx=0.5\n fill white alpha=fbm(x - cx, y)\nend\ncloud\ncloud cx=noise(t, 1)').cost, 24);
  const heavy = compile('repeat i 500\nrepeat j 40\nfill white alpha=0.01 * fbm(x * i, y * j, t)\nend\nend');
  assert.equal(heavy.ok, false);
  assert.match(heavy.errors[0].message, /over the limit/);
});

test('the exported version matches package.json', () => {
  assert.equal(version, JSON.parse(readFileSync('package.json', 'utf8')).version);
});

test('group: turn, scale, mirror and move what is inside', () => {
  const r = compile('group cx=0.9 cy=0.1 angle=20 * sin(t) scale=0.8 flip=-1 dx=0.01 dy=0\n  rect cx=0.9 cy=0.2 color=mix(red, gold, y)\nend');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.match(r.glsl, /PP = rot\(PP - c - vec2\(\(0\.01\), \(0\.0\)\), \(\(20\.0 \* sin\(T\)\)\)\) \/ s;/);
  assert.equal(compile('group x=0.5 y=0.5 rotation=10 zoom=2 mirror=-1\n circle\nend').ok, true, 'aliases');
  assert.equal(compile('group\n circle\nend').ok, true, 'all values are optional');
  assert.match(firstError('group angel=10\n circle\nend'), /group has no 'angel'.*Did you mean 'angle'/);
  assert.match(firstError('group angle=red\n circle\nend'), /'angle' must be a number/);
  assert.match(firstError('group\nend\ncircle'), /this group is empty/);
  assert.match(firstError('group\n circle'), /group has no matching 'end'/);
  assert.match(firstError('group\n scene 0 1\n circle\n end\nend'), /can't go inside a group/);
  assert.match(firstError('group angle=10 circle\n circle\nend'), /group takes named values like angle=30/);
  assert.match(firstError('group\n let k = 1\nend\ncircle r=k'), /unknown name 'k'/, 'values made inside a group stay inside');
});

test('camera: lasts until the end of its block; a later one replaces it', () => {
  const r = compile('scene 0 4\n camera cx=1 cy=0.4 zoom=1 + sp\n circle\n camera angle=10\n circle\nend\ncircle');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const main = r.glsl.split('void main(){')[1];
  assert.equal((main.match(/vec2 sp_\d+ = PP;/g) || []).length, 1, 'saved once per block');
  assert.equal((main.match(/PP = sp_\d+;/g) || []).length, 2, 'restored before the second camera and at the end of the scene');
  assert.ok(main.lastIndexOf('PP = sp_') < main.indexOf('if (T >= 0.0') + main.slice(main.indexOf('if (T >= 0.0')).indexOf('\n  }'), 'restored inside the scene');
  assert.match(firstError('camera scale=2 zoom=3\ncircle'), /'scale' is given twice/);
  assert.match(firstError('camera zom=2\ncircle'), /camera has no 'zom'.*Did you mean 'zoom'/);
});

test('clip: draw only inside a shape', () => {
  const r = compile('fill navy\nclip circle cx=0.5 cy=0.5 r=0.3 * ease(p * 2) blur=0.01\n  fill gold\n  star\nend');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.match(r.glsl, /if \(cc_\d+ > 0\.0\) \{/);
  assert.equal(r.cost, 4, 'fill + clip shape + fill + star');
  assert.equal(compile('clip rectangle w=0.5 h=0.5 invert=1\n fill red\nend').ok, true, 'shape aliases and invert');
  assert.match(firstError('clip circle color=red\n fill red\nend'), /clip circle has no 'color'\. A clip shape is not drawn/);
  assert.match(firstError('clip circle opacity=0.5\n fill red\nend'), /A clip shape is not drawn/);
  assert.match(firstError('clip\n fill red\nend'), /clip needs a shape/);
  assert.match(firstError('clip blob r=1\n fill red\nend'), /clip needs a shape/);
  assert.match(firstError('clip circle\nend\nfill red'), /this clip circle is empty/);
});

test('a define call can turn, scale, mirror and move its drawing', () => {
  const src = 'define bell cx=0.5 cy=0.2 s=1\n  circle cx=cx cy=cy + 0.1 * s r=0.05 * s\nend\n';
  const r = compile(src + 'bell cx=0.3 angle=30 * spring(t - 1) scale=2 flip=-1 dx=0.1 dy=0');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.match(r.glsl, /vec2 c = vec2\(\(0\.3\), \(0\.2\)\)/, 'turns around its own cx, cy');
  assert.match(compile('define dot k=1\n  circle\nend\ndot angle=10').glsl, /vec2 c = vec2\(\(ASPECT\*0\.5\), 0\.5\)/, 'or the canvas center');
  assert.match(compile('define dial angle=0\n  line x2=0.5 + 0.3 * cos(angle) y2=0.5\nend\ndial angle=1').glsl, /f_dial\(col, 1\.0\)/, "the define's own value wins");
  assert.match(firstError(src + 'bell size=2'), /bell has no 'size'.*and angle, scale, flip, dx, dy to turn/);
});

test('spring and hits', () => {
  const r = compile('circle cx=0.5 + 0.1 * spring(t - 1) cy=0.5 + 0.1 * spring(t, 3) r=0.1 + 0.05 * spring(t - 2, 1.5, 2) + 0.05 * hits(t, 1, 2.5, 4)');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.match(r.glsl, /spring\(\(T - 1\.0\),2\.0,4\.0\)/);
  assert.match(r.glsl, /max\(max\(hit\(T - 1\.0\),hit\(T - 2\.5\)\),hit\(T - 4\.0\)\)/);
  assert.match(firstError('circle r=hits(t)'), /hits\(\) takes a time, then the times/);
  assert.match(firstError('circle r=spring(t, 1, 2, 3)'), /spring\(\) takes 1 to 3 values/);
});

test('cost breakdown: which lines the cost comes from', () => {
  const src = ['define zed cx=0.5', ...Array.from({ length: 10 }, () => '  circle cx=cx'), 'end', 'fill navy', 'repeat i 12', '  zed cx=i / 12', 'end', 'circle r=noise(x, t)'].join('\n');
  const r = compile(src);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.cost, 124);
  assert.deepEqual(r.costs, [{ line: 15, cost: 120 }, { line: 17, cost: 3 }, { line: 13, cost: 1 }]);
  assert.deepEqual(r.warnings.map((w) => w.line), [15]);
  assert.match(r.warnings[0].message, /zed costs about 10 shapes and repeat draws it 12 times, so this line alone costs about 120/);
  const heavy = compile('repeat i 100\n repeat j 5\n  circle\n end\nend');
  assert.match(heavy.warnings.at(-1).message, /Heaviest: line 3 \(500\)/);
});

test('timing in bars follows the tempo', () => {
  // 96 bpm, 4 beats per bar: one bar is 2.5 s
  const r = compile('bpm 96\nscene bars 1 8\n fill red\nend\nscene bars 9 16 fade=0.5\n circle r=0.1 + 0.01 * sb\nend');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.scenes.map((s) => [s.start, s.end]), [[0, 20], [20, 40]]);
  assert.equal(r.duration, 40, 'duration follows the last scene');
  assert.equal(r.beatsPerBar, 4);
  assert.match(r.glsl, /float v_sb_\d+ = v_st_\d+ \* 1\.6;/);
  assert.deepEqual(compile('bpm 120 offset=0.5 bar=3\nscene bars 2 2\n fill red\nend').scenes.map((s) => [s.start, s.end]), [[2, 3.5]], 'offset and 3 beats per bar');
  assert.equal(compile('scene bars 1 1\n fill red\nend\nbpm 60').scenes[0].end, 4, 'the tempo may come after the scene');
  assert.equal(compile('bpm 96 offset=1\nduration bars 24\nfill red').duration, 61);
  assert.equal(compile('scene bar 1 2\n fill red\nend').ok, true, '"bar" works too');
  assert.match(firstError('scene bars 0 4\n fill red\nend'), /counting from 1, both included/);
  assert.match(firstError('scene bars 5 4\n fill red\nend'), /counting from 1, both included/);
  assert.match(firstError('bpm 120 bar=0\nfill red'), /whole number of beats per bar/);
  assert.match(firstError('bpm 120 bars=4\nfill red'), /bpm has no 'bars'\. Did you mean 'bar'\?/);
  assert.match(firstError('fill red alpha=sb'), /'sb' only exists inside a scene block/);
});
