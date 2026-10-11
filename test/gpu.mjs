// GPU test: compiles every example on a real WebGL implementation (headless Chromium)
// and checks that each one draws a non-empty picture at several times. Then checks how
// <xyt-player> picks up its program and its still frame in a real page.
// Needs Playwright:  npm i -D playwright && npx playwright install chromium
// Usage: node test/gpu.mjs [--sheets out-dir]
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('This test needs Playwright: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sheetsArg = process.argv.indexOf('--sheets');
const sheetsDir = sheetsArg > 0 ? process.argv[sheetsArg + 1] : null;
const bundle = ['xyt.min.js', 'xyt-text.min.js', 'xyt-text-cyrillic.min.js'].map((f) => readFileSync(path.join(root, 'dist', f), 'utf8')).join('\n');
const examples = readdirSync(path.join(root, 'examples')).filter((f) => f.endsWith('.xyt')).sort();
// Small programs that touch every feature, so each code path is compiled by a real GPU driver.
const FEATURES = {
  'shapes.xyt': ['circle cx=0.2 cy=0.2 r=0.1 color=red alpha=0.8 blur=0.01 stroke=0.01', 'ellipse cx=0.5 cy=0.2 rx=0.15 ry=0.06 angle=t * 30',
    'rect cx=0.8 cy=0.2 w=0.2 h=0.1 radius=0.02 angle=10 stroke=0.01', 'line x1=0.1 y1=0.5 x2=0.4 y2=0.6 width=0.02',
    'tri x1=0.6 y1=0.4 x2=0.9 y2=0.6 x3=0.6 y3=0.6', 'ring cx=0.2 cy=0.8 r=0.1 width=0.02', 'arc cx=0.5 cy=0.8 r=0.1 start=0 end=270 width=0.03',
    'star cx=0.8 cy=0.8 r=0.12 inner=0.4 points=7 angle=t * 20 color=gold', 'ellipse cx=0.5 cy=0.5 rx=0.1 ry=0 color=white'].join('\n'),
  'motion.xyt': ['canvas 16:9', 'bpm 128 offset=0.2', 'input wind = 0.5 min=0 max=1', 'input tint = #ff8800',
    'fill keys(t, 0, navy, 2, purple, 4, navy)', 'circle cx=keys(t, 0, 0.3, 1, 1.4, 4, 0.3) cy=0.5 + 0.2 * bounce(fract(t)) r=0.05 + 0.03 * pulse color=tint',
    'rect cx=aspect / 2 cy=0.9 w=aspect h=0.1 color=mix(teal, sky, wind) alpha=(t >= 1) * 0.5 + (t < 1 || t > 3) * 0.5',
    'circle cx=mx cy=my r=0.03 + 0.01 * (easein(p) + easeout(p) + backout(p)) color=white',
    'scene 0 2 fade=0.5', '  fill red alpha=0.3 * sp + st * 0', 'end', 'scene 2 4 fadein=1', '  ring cx=aspect / 2 r=0.3 * sp width=0.01', 'end'].join('\n'),
  'define-loops.xyt': ['define thing cx=0.5 cy=0.5 s=1 tint=pink', '  repeat k 6', '    circle cx=cx + 0.1 * s * cos(k * tau / 6 + t) cy=cy + 0.1 * s * sin(k * tau / 6 + t) r=0.02 * s color=tint', '  end', 'end',
    'fill gray(0.1)', 'repeat i 3', '  repeat j 3', '    thing cx=0.2 + i * 0.3 cy=0.2 + j * 0.3 s=0.8 tint=hsl(i * 120 + j * 40, 0.8, 0.6)', '  end', 'end',
    'fill white alpha=0.1 * fbm(x * 4, y * 4, t) + 0.05 * noise(x * 9, y * 9) + 0.02 * hash(x, y) + 0.01 * hash(floor(x * 10))'].join('\n'),
  // Names that would make reserved GLSL identifiers ('__'), and clamp with mixed limits.
  'names.xyt': ['input _glow = 0.6', 'input tint_ = #ff8800', 'let a__b = 0.3', 'define _orb cx_=0.5 Z=1', '  circle cx=cx_ r=0.1 * Z color=tint_', 'end',
    'fill clamp(mix(navy, teal, y), 0.1, gold)', 'repeat _i 3', '  _orb cx_=0.2 + _i * a__b Z=_glow', 'end'].join('\n'),
  // text with accents, blur, outline and reveal, turned and clipped; a curve; timing in bars
  'text.xyt': ['use text', 'canvas 16:9', 'bpm 96 bar=3', 'duration bars 4', 'fill mix(#1d1b4c, #6b3f8f, y)',
    'scene bars 1 4', '  text "Frère Jacques, Šabac, Đurđevdan!" x=aspect / 2 y=0.3 size=0.07 color=white blur=0.004', '  text "dormez-vous ?" x=aspect / 2 y=0.3 size=0.07 color=gold reveal=sp align=left',
    '  group cx=aspect / 2 cy=0.6 angle=10 * sin(sb)', '    text "«Ding»" x=aspect / 2 y=0.6 size=0.12 stroke=0.004 color=sky', '  end',
    '  clip text "XYT" x=aspect / 2 y=0.85 size=0.2 weight=0.3', '    fill hsl(x * 300 + t * 60, 0.8, 0.6)', '  end',
    '  curve x1=0.3 y1=0.45 cx=aspect / 2 cy=0.55 + 0.05 * sin(t) x2=aspect - 0.3 y2=0.45 width=0.01 color=pink', 'end'].join('\n'),
  'cyrillic.xyt': ['use text', 'canvas 16:9', 'fill #14182a', 'text "Фрере Жак, спите ли вы?" x=aspect / 2 y=0.3 size=0.07 color=white',
    'text "Ёлка, Йод, эхо, Јелена" x=aspect / 2 y=0.6 size=0.07 color=gold reveal=p font=cyrillic'].join('\n'),
  // group, camera, clip, define call transforms, spring and hits, nested and inside defines and loops.
  'transforms.xyt': ['canvas 16:9', 'duration 4', 'fill mix(#1b1f4a, #ffb35c, y)', 'camera cx=1.2 cy=0.5 zoom=1 + 0.3 * ease(p) angle=3 * sin(t)',
    'define bell cx=0.5 cy=0.2 s=1 tint=gold', '  group cx=cx cy=cy flip=cos(t * 3)', '    ellipse cx=cx cy=cy + 0.08 * s rx=0.05 * s ry=0.07 * s color=tint', '    circle cx=cx + 0.02 * s cy=cy + 0.15 * s r=0.015 * s color=brown', '  end', 'end',
    'repeat i 3', '  bell cx=0.4 + i * 0.5 angle=35 * spring(t - 0.5 - i * 0.7, 1.2, 1.5) scale=1 + 0.2 * hits(t, 1, 2, 3)', 'end',
    'group cx=1.2 cy=0.75 scale=-0.8 dx=0.05 * sin(t)', '  clip rect cx=1.2 cy=0.75 w=0.6 h=0.2 radius=0.05 stroke=0.03', '    fill hsl(x * 300 + t * 90, 0.8, 0.6)', '  end', 'end',
    'clip circle cx=aspect / 2 cy=0.5 r=0.25 invert=0.6 blur=0.05', '  repeat k 4', '    camera zoom=1 + k * 0.1', '    ring r=0.1 + k * 0.05 width=0.01 color=white alpha=hits(t, 0.5, 1.5)', '  end', 'end'].join('\n'),
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
await page.addScriptTag({ content: bundle });

let failed = 0;
for (const file of examples.concat(Object.keys(FEATURES))) {
  const src = FEATURES[file] || readFileSync(path.join(root, 'examples', file), 'utf8');
  const res = await page.evaluate(async ({ src, wantImages }) => {
    const canvas = document.getElementById('c');
    const player = new XYT.Player(canvas, { autoplay: false, adaptive: false, pauseWhenHidden: false, preserveDrawingBuffer: true });
    const r = player.load(src);
    if (!r.ok) { player.destroy(); return { ok: false, errors: r.errors }; }
    const h = 180, w = Math.round(h * r.aspect);
    player.setSize(w, h);
    const times = [0.1, 0.35, 0.6, 0.85].map((f) => f * r.duration);
    const frames = [];
    for (const t of times) {
      const px = player.renderAt(t).readPixels();
      let min = 255, max = 0, sum = 0;
      for (let i = 0; i < px.length; i += 4) { const v = px[i] + px[i + 1] + px[i + 2]; min = Math.min(min, v); max = Math.max(max, v); sum += v; }
      const frame = { t, contrast: max - min, mean: sum / (px.length / 4) };
      if (wantImages) {
        const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
        c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
        frame.png = c2.toDataURL('image/png');
      }
      frames.push(frame);
    }
    player.destroy();
    return { ok: true, frames, cost: r.cost, aspect: r.aspectLabel };
  }, { src, wantImages: !!sheetsDir });

  const blank = res.ok && res.frames.some((f) => f.contrast === 0 && f.mean === 0);
  const ok = res.ok && !blank;
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${file.padEnd(14)} ${res.ok ? `cost ${String(res.cost).padStart(4)}  ${res.aspect}` : JSON.stringify(res.errors)}${blank ? '  (a frame was completely black)' : ''}`);
  if (sheetsDir && res.ok) {
    mkdirSync(sheetsDir, { recursive: true });
    res.frames.forEach((f, i) => writeFileSync(path.join(sheetsDir, `${file.replace('.xyt', '')}_${i}.png`), Buffer.from(f.png.split(',')[1], 'base64')));
  }
}

// Transforms and clips must draw what the same picture drawn directly draws. The first pair also pins
// the direction: a bar above the center, turned 90 degrees around it, lands on the right (clockwise).
const SAME = [
  ['group turns clockwise around cx, cy', 'rect cx=0.7 cy=0.5 w=0.05 h=0.2', 'group cx=0.5 cy=0.5 angle=90\n  rect cx=0.5 cy=0.3 w=0.2 h=0.05\nend'],
  ['group angle = shape angle', 'rect w=0.4 h=0.1 angle=30 color=gold', 'group angle=30\n  rect w=0.4 h=0.1 color=gold\nend'],
  ['group scale', 'circle r=0.2 color=gold\nring r=0.3 width=0.02', 'group scale=2\n  circle r=0.1 color=gold\n  ring r=0.15 width=0.01\nend'],
  ['group flip', 'tri x1=0.3 y1=0.3 x2=0.6 y2=0.5 x3=0.3 y3=0.7', 'group flip=-1\n  tri x1=0.7 y1=0.3 x2=0.4 y2=0.5 x3=0.7 y3=0.7\nend'],
  ['group dx, dy', 'circle cx=0.6 cy=0.45 r=0.1', 'group dx=0.1 dy=-0.05\n  circle r=0.1\nend'],
  ['camera zoom', 'circle r=0.2 color=gold\nring r=0.3 width=0.02', 'camera zoom=2\ncircle r=0.1 color=gold\nring r=0.15 width=0.01'],
  ['define call angle', 'rect cx=0.3 cy=0.4 w=0.2 h=0.05 angle=45', 'define bar cx=0.5 cy=0.5\n  rect cx=cx cy=cy w=0.2 h=0.05\nend\nbar cx=0.3 cy=0.4 angle=45'],
  ['clip', 'fill navy\nrect w=0.5 h=0.5 color=red', 'fill navy\nclip rect w=0.5 h=0.5\n  fill red\nend'],
  ['clip invert', 'fill black\nrect w=0.5 h=0.5 color=red', 'fill red\nclip rect w=0.5 h=0.5 invert=1\n  fill black\nend'],
];
// Curves against a 48-piece polyline of the same curve: edges differ a little where the pieces overlap, but
// a hole or a stray pixel from the cubic solution would differ by more than half the range. Nearly
// straight curves are where that solution loses precision, so several offsets from straight are drawn.
const poly = (x1, y1, cx, cy, x2, y2, w) => Array.from({ length: 48 }, (_, i) => {
  const at = (t) => [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2];
  const [ax, ay] = at(i / 48), [bx, by] = at((i + 1) / 48);
  return `line x1=${ax} y1=${ay} x2=${bx} y2=${by} width=${w}`;
}).join('\n');
const CURVES = [[0.1, 0.7, 0.5, 0.1, 0.9, 0.7], [0.2, 0.5, 0.5, 0.5 + 0.0008, 0.8, 0.5], [0.2, 0.5, 0.5, 0.5 + 0.003, 0.8, 0.5],
  [0.2, 0.5, 0.5, 0.5 + 0.02, 0.8, 0.5], [0.3, 0.3, 0.95, 0.5, 0.3, 0.7], [0.2, 0.2, 0.5, 0.5, 0.8, 0.8],
  // without the segment fallback in sdBez these two draw hundreds of wrong pixels, on GPUs and SwiftShader alike
  [0.2, 0.5, 0.5, 0.5 + 1e-5, 0.8, 0.5], [0.2, 0.5, 0.5, 0.5 + 1e-6, 0.8, 0.5]];
const GROSS = CURVES.map((c, i) => [`curve ${i + 1} matches its polyline`, poly(...c, 0.02), `curve x1=${c[0]} y1=${c[1]} cx=${c[2]} cy=${c[3]} x2=${c[4]} y2=${c[5]} width=0.02`]);
SAME.push(
  ['text reveal=0 draws nothing', 'fill navy', 'use text\nfill navy\ntext "Hello" size=0.2 reveal=0'],
  ['text reveal=1 draws it all', 'use text\ntext "Hello" size=0.2', 'use text\ntext "Hello" size=0.2 reveal=1'],
  ['clip text paints where text draws', 'use text\nfill navy\ntext "XYT" size=0.3 color=red', 'use text\nfill navy\nclip text "XYT" size=0.3\n  fill red\nend'],
  ['font=cyrillic on Latin text falls back to simplex', 'use text\ntext "Hello" size=0.2', 'use text\ntext "Hello" size=0.2 font=cyrillic'],
  ['text in group scale = bigger text', 'use text\ntext "Ça va" size=0.2 weight=0.1', 'use text\ngroup scale=2\n  text "Ça va" size=0.1 weight=0.1\nend'],
);
SAME.push(['curve with a straight control point = line', 'line x1=0.2 y1=0.5 x2=0.8 y2=0.5 width=0.02', 'curve x1=0.2 y1=0.5 cx=0.5 cy=0.5 x2=0.8 y2=0.5 width=0.02']);
for (const [label, a, b] of GROSS) {
  const r = await page.evaluate(({ a, b }) => {
    const player = new XYT.Player(document.getElementById('c'), { autoplay: false, adaptive: false, pauseWhenHidden: false, preserveDrawingBuffer: true });
    const draw = (src) => { const res = player.load(src); if (!res.ok) throw new Error(JSON.stringify(res.errors)); player.setSize(400, 400); return player.renderAt(0).readPixels(); };
    const pa = draw(a), pb = draw(b);
    let gross = 0, max = 0;
    for (let i = 0; i < pa.length; i += 4) { const d = Math.abs(pa[i] - pb[i]); max = Math.max(max, d); if (d > 128) gross++; }
    player.destroy();
    return { gross, max };
  }, { a, b });
  const ok = r.gross === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${ok ? '' : `  (${r.gross} pixels grossly off)`}`);
}
for (const [label, a, b] of SAME) {
  const r = await page.evaluate(({ a, b }) => {
    const player = new XYT.Player(document.getElementById('c'), { autoplay: false, adaptive: false, pauseWhenHidden: false, preserveDrawingBuffer: true });
    const draw = (src) => { const res = player.load(src); if (!res.ok) throw new Error(JSON.stringify(res.errors)); player.setSize(160, 160); return player.renderAt(1).readPixels(); };
    const pa = draw(a), pb = draw(b);
    let max = 0, off = 0;
    for (let i = 0; i < pa.length; i++) { const d = Math.abs(pa[i] - pb[i]); max = Math.max(max, d); if (d > 2) off++; }
    player.destroy();
    return { max, off };
  }, { a, b });
  const ok = r.off === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${ok ? '' : `  (${r.off} channel values differ, by up to ${r.max})`}`);
}

// <xyt-player> in a real page: which program it loads, and which frame it shows when still.
const program = 'duration 10\nscene 0 10 fade=1\n  fill red\nend';
const ELEMENT = [
  ['inline program, library loaded first', `<script>${bundle}</script><xyt-player id="p"><script type="text/xyt">${program}</script></xyt-player>`, {}, 'loaded'],
  ['inline program, library loaded after', `<xyt-player id="p"><script type="text/xyt">${program}</script></xyt-player><script>${bundle}</script>`, {}, 'loaded'],
  ['reduced motion shows the still frame', `<script>${bundle}</script><xyt-player id="p"><script type="text/xyt">${program}</script></xyt-player>`, { reducedMotion: 'reduce' }, 3],
  ['still attribute shows the still frame', `<xyt-player id="p" still><script type="text/xyt">${program}</script></xyt-player><script>${bundle}</script>`, {}, 3],
];
let elementFailed = 0;
for (const [label, html, context, want] of ELEMENT) {
  const p = await browser.newPage(context);
  await p.setContent(`<!doctype html><body>${html}</body>`);
  await p.waitForFunction(() => document.getElementById('p').player?.result, null, { timeout: 2000 }).catch(() => {});
  const { loaded, time, playing } = await p.evaluate(() => {
    const player = document.getElementById('p').player;
    return { loaded: !!player?.result, time: player?.time, playing: player?.playing };
  });
  const ok = want === 'loaded' ? loaded : loaded && !playing && Math.abs(time - want) < 1e-6;
  if (!ok) elementFailed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${ok ? '' : `  (loaded ${loaded}, time ${time}, playing ${playing})`}`);
  await p.close();
}
failed += elementFailed;

// The command line renderer: a frame, a contact sheet, and a video with sound when ffmpeg is there.
const { spawnSync } = await import('node:child_process');
const { mkdtempSync, existsSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const out = mkdtempSync(path.join(tmpdir(), 'xyt-render-'));
const hasFfmpeg = !spawnSync('ffmpeg', ['-version']).error;
const CLI = [
  ['xyt render --at', ['examples/ball.xyt', '--at', '0.5', '--height', '120', '-o', path.join(out, 'ball.png')], 'ball.png'],
  ['xyt render --sheet', ['examples/sunset.xyt', '--sheet', '--frames', '4', '--height', '90', '-o', path.join(out, 'sheet.png')], 'sheet.png'],
];
if (hasFfmpeg) {
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', path.join(out, 'tone.m4a')]);
  CLI.push(['xyt render --mp4 --audio', ['examples/spinner.xyt', '--mp4', '--height', '120', '--to', '1', '--audio', path.join(out, 'tone.m4a'), '-o', path.join(out, 'spinner.mp4')], 'spinner.mp4']);
}
for (const [label, args, file] of CLI) {
  const r = spawnSync(process.execPath, [path.join(root, 'bin/xyt.mjs'), 'render', ...args], { cwd: root, encoding: 'utf8' });
  const ok = r.status === 0 && existsSync(path.join(out, file));
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${ok ? '' : `  (${(r.stderr || '').trim().split('\n')[0]})`}`);
}
if (!hasFfmpeg) console.log('skip  xyt render --mp4 (no ffmpeg)');

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${examples.length} examples and ${Object.keys(FEATURES).length} feature programs render on the GPU, ${SAME.length + GROSS.length} transform and curve checks match, <xyt-player> passes ${ELEMENT.length} checks, and the command line renders ${CLI.length} ways`);
process.exit(failed ? 1 : 0);
