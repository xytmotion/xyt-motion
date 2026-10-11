// Unit tests for the parser and compiler. Run: npm test  (no GPU needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { compile, parse, reference, version } from '../src/index.js';

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
  assert.match(firstError('xyt 0.3\nfill red'), /written for XYT 0\.3, newer than this library/);
  assert.match(firstError('xyt 1.0\nfill red'), /newer than this library/);
  assert.match(firstError('xyt two\nfill red'), /like: xyt 0\.2/);
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
