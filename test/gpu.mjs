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
const bundle = readFileSync(path.join(root, 'dist/xyt.min.js'), 'utf8');
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

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${examples.length} examples and ${Object.keys(FEATURES).length} feature programs render on the GPU, and <xyt-player> passes ${ELEMENT.length} checks`);
process.exit(failed ? 1 : 0);
