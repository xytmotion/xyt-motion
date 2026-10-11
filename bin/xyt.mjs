#!/usr/bin/env node
// xyt: check and render XYT programs from the command line.
//
//   xyt check film.xyt                         errors, warnings and where the cost comes from
//   xyt render film.xyt --at 12.5              one frame as PNG
//   xyt render film.xyt --sheet                a contact sheet of frames across the duration
//   xyt render film.xyt --mp4 --audio song.mp3 an H.264 video
//
// Rendering runs the real player in headless Chromium through Playwright, an optional dependency
// (npm i -D playwright && npx playwright install chromium); --mp4 also needs ffmpeg on the PATH.
// `check` needs neither.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compile, version, use } from '../dist/xyt.mjs';
import text from '../dist/text.mjs';
import cyrillic from '../dist/text-cyrillic.mjs';

use(text); // programs that say `use text` work here and in the page below
text.addFont(cyrillic);

const USAGE = `xyt ${version}: check and render XYT programs

  xyt check <file.xyt>
  xyt render <file.xyt> --at <seconds>      one frame as PNG
  xyt render <file.xyt> --sheet             frames across the duration on one PNG
  xyt render <file.xyt> --mp4               H.264 video of the whole duration

Options:
  -o, --out <file>      output file (default: next to the program)
  --height <px>         frame height (default 1080; sheet tiles 270)
  --frames <n>          sheet: number of frames (default 12)
  --columns <n>         sheet: frames per row (default 4)
  --fps <n>             mp4: frames per second (default 30)
  --from <s>, --to <s>  mp4: time range (default: the whole duration)
  --audio <file>        mp4: sound track, cut to the video's length
  --set <name=value>    set an input, like --set wind=0.8 or --set tint=#ff8800 (repeatable)
  --font <file>         add a stroke font for text: .svg font, .jhf (ASCII order) or .json (repeatable)

Rendering needs Playwright (npm i -D playwright && npx playwright install chromium); --mp4 needs ffmpeg.`;

const fail = (msg, code = 2) => { process.stderr.write(`xyt: ${msg}\n`); process.exit(code); };

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' }, at: { type: 'string' }, sheet: { type: 'boolean' }, mp4: { type: 'boolean' },
      height: { type: 'string' }, frames: { type: 'string' }, columns: { type: 'string' }, fps: { type: 'string' },
      from: { type: 'string' }, to: { type: 'string' }, audio: { type: 'string' }, set: { type: 'string', multiple: true },
      font: { type: 'string', multiple: true },
      help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
    },
  });
} catch (e) { fail(`${e.message}\n\n${USAGE}`); }
const { values: opt, positionals: [command, file] } = parsed;
if (opt.version) { console.log(version); process.exit(0); }
if (opt.help || !command) { console.log(USAGE); process.exit(command || opt.help ? 0 : 2); }
if (!['check', 'render'].includes(command)) fail(`unknown command '${command}'\n\n${USAGE}`);
if (!file) fail(`${command} needs a program file, like: xyt ${command} film.xyt`);

let source;
try { source = readFileSync(file, 'utf8'); } catch (e) { fail(`could not read ${file}: ${e.message}`); }

// Fonts from --font, named after their files: `xyt render film.xyt --font plotter.svg` gives font=plotter.
const fonts = (opt.font || []).map((f) => {
  let data;
  try { data = readFileSync(f, 'utf8'); } catch (e) { fail(`could not read ${f}: ${e.message}`); }
  const name = f.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^([^a-z])/, 'f$1');
  let font;
  if (/\.svg$/i.test(f)) font = { name, svg: data };
  else if (/\.jhf$/i.test(f)) font = { name, jhf: data };
  else if (/\.json$/i.test(f)) { try { font = { name, ...JSON.parse(data) }; } catch (e) { fail(`${f} is not valid JSON: ${e.message}`); } }
  else fail(`--font takes .svg, .jhf or .json files, got ${f}`);
  try { text.addFont(font); } catch (e) { fail(`could not use the font ${f}: ${e.message}`); }
  return font;
});
const result = compile(source);
const where = (m) => (m.line ? `${file}:${m.line}: ` : `${file}: `);
for (const e of result.errors) process.stderr.write(`${where(e)}error: ${e.message}\n`);
for (const w of result.warnings) process.stderr.write(`${where(w)}warning: ${w.message}\n`);
if (!result.ok) process.exit(1);

const num = (name, value, def, min = 0) => {
  if (value === undefined) return def;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) fail(`--${name} needs a number${min > -Infinity ? ` of at least ${min}` : ''}, got '${value}'`);
  return n;
};
const base = file.replace(/\.xyt$/i, '');

if (command === 'check') {
  const heaviest = result.costs.slice(0, 5).map((c) => `line ${c.line} (${c.cost})`).join(', ');
  console.log(`${file}: ok. ${result.aspectLabel} canvas, ${result.duration} s, cost ${result.cost}` +
    (result.scenes.length ? `, ${result.scenes.length} scenes` : '') + (heaviest ? `. Heaviest: ${heaviest}` : ''));
  process.exit(0);
}

// ---------- render ----------
const modes = ['at', 'sheet', 'mp4'].filter((m) => opt[m] !== undefined && opt[m] !== false);
if (modes.length !== 1) fail('render needs exactly one of --at <seconds>, --sheet or --mp4');
const mode = modes[0];
const inputs = {};
for (const s of opt.set || []) {
  const m = /^([A-Za-z_]\w*)=(.+)$/.exec(s);
  if (!m) fail(`--set needs name=value, like --set wind=0.8; got '${s}'`);
  const known = result.inputs.find((i) => i.name === m[1]);
  if (!known) fail(`the program has no input '${m[1]}'` + (result.inputs.length ? `; it has: ${result.inputs.map((i) => i.name).join(', ')}` : ''));
  inputs[m[1]] = known.kind === 'num' ? num('set', m[2], 0, -Infinity) : m[2];
}

const page = await openPage();
try {
  if (mode === 'at') await renderFrame();
  else if (mode === 'sheet') await renderSheet();
  else await renderVideo();
} finally {
  await page.context().browser().close();
}

async function renderFrame() {
  const t = num('at', opt.at, 0);
  const height = num('height', opt.height, 1080, 1);
  const out = opt.out || `${base}-${t}s.png`;
  const png = await page.evaluate(({ t, height }) => {
    const { w, h } = window.xytSize(height);
    return window.xytPng([{ t, x: 0, y: 0 }], w, h, w, h, false);
  }, { t, height });
  writeFileSync(out, Buffer.from(png, 'base64'));
  console.log(`wrote ${out} (t = ${t} s)`);
}

async function renderSheet() {
  const frames = num('frames', opt.frames, 12, 1), columns = Math.min(num('columns', opt.columns, 4, 1), frames);
  const height = num('height', opt.height, 270, 1);
  const out = opt.out || `${base}-sheet.png`;
  const png = await page.evaluate(({ frames, columns, height }) => {
    const { w, h } = window.xytSize(height), gap = 4, label = 22, D = window.xytDuration;
    const rows = Math.ceil(frames / columns);
    // the middle of each equal slice of the duration, so fades at the very start and end don't hide anything
    const tiles = Array.from({ length: frames }, (_, i) => ({
      t: Math.round(((i + 0.5) * D / frames) * 100) / 100, x: (i % columns) * (w + gap), y: Math.floor(i / columns) * (h + gap + label),
    }));
    return window.xytPng(tiles, w, h, columns * (w + gap) - gap, rows * (h + gap + label) - gap, true);
  }, { frames, columns, height });
  writeFileSync(out, Buffer.from(png, 'base64'));
  console.log(`wrote ${out} (${frames} frames)`);
}

async function renderVideo() {
  if (spawnSync('ffmpeg', ['-version']).error) fail('--mp4 needs ffmpeg on the PATH: https://ffmpeg.org (macOS: brew install ffmpeg)');
  const fps = num('fps', opt.fps, 30, 1), height = num('height', opt.height, 1080, 2);
  const from = num('from', opt.from, 0), to = num('to', opt.to, result.duration);
  if (!(to > from)) fail('--to must be after --from');
  if (opt.audio) { try { readFileSync(opt.audio, { flag: 'r' }); } catch (e) { fail(`could not read ${opt.audio}: ${e.message}`); } }
  const out = opt.out || `${base}.mp4`;
  const { w, h } = await page.evaluate((height) => window.xytSize(height, true), height);
  const frames = Math.round((to - from) * fps);
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-framerate', String(fps), '-i', '-',
    ...(opt.audio ? ['-ss', String(from), '-i', opt.audio] : []),
    // RGB to BT.709 YUV, tagged as such, so players show the program's exact colors
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
    // the sound is cut at the end of the picture, or ends early in silence
    ...(opt.audio ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-t', String(to - from)] : []),
    '-map_metadata', '-1', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });
  let errors = '';
  // On macOS ffmpeg reports its first short read from a pipe as a truncated packet; the frame still arrives whole.
  ffmpeg.stderr.on('data', (d) => { errors += String(d).split('\n').filter((l) => l && !l.startsWith('Truncating packet')).map((l) => l + '\n').join(''); });
  const done = new Promise((resolve) => ffmpeg.on('close', resolve));
  ffmpeg.stdin.on('error', () => {}); // reported through the exit code below
  const start = Date.now();
  for (let f = 0; f < frames; f++) {
    const rgba = Buffer.from(await page.evaluate((t) => window.xytRaw(t), from + f / fps), 'base64');
    if (!ffmpeg.stdin.write(rgba)) {
      await new Promise((resolve) => {
        const go = () => { ffmpeg.stdin.off('drain', go); ffmpeg.off('close', go); resolve(); };
        ffmpeg.stdin.on('drain', go);
        ffmpeg.on('close', go);
      });
    }
    if (ffmpeg.exitCode !== null) break;
    if (process.stderr.isTTY) process.stderr.write(`\rframe ${f + 1}/${frames}`);
  }
  ffmpeg.stdin.end();
  const code = await done;
  if (process.stderr.isTTY) process.stderr.write('\n');
  if (code !== 0) fail(`ffmpeg failed${errors ? `:\n${errors}` : ''}`);
  console.log(`wrote ${out} (${w}x${h}, ${fps} fps, ${frames} frames${opt.audio ? ', with sound' : ''}, ${Math.round((Date.now() - start) / 1000)} s)`);
}

// Starts headless Chromium with a working WebGL context and the player loaded with the program.
async function openPage() {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch {
    try { ({ chromium } = await import('playwright-core')); } catch {
      fail('render needs Playwright: npm i -D playwright && npx playwright install chromium');
    }
  }
  const gpu = process.platform === 'darwin' ? ['--use-angle=metal'] : [];
  const software = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  let lastError;
  // the GPU first; the software renderer when there is none (servers, CI); the system Chrome if
  // Playwright's own browser isn't installed
  for (const launch of [{ args: gpu }, { args: software }, { args: gpu, channel: 'chrome' }]) {
    let browser;
    try {
      browser = await chromium.launch({ ...launch, args: ['--ignore-gpu-blocklist', ...launch.args] });
      const page = await browser.newPage();
      await page.setContent('<!doctype html><canvas id="c"></canvas>');
      const ok = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
      if (!ok) { await browser.close(); lastError = new Error('no WebGL'); continue; }
      for (const f of ['xyt.min.js', 'xyt-text.min.js', 'xyt-text-cyrillic.min.js']) await page.addScriptTag({ path: fileURLToPath(new URL(`../dist/${f}`, import.meta.url)) });
      await page.evaluate((list) => list.forEach((f) => XYTText.text.addFont(f)), fonts);
      await page.evaluate(setUpPage, { source, inputs });
      return page;
    } catch (e) {
      lastError = e;
      if (browser) await browser.close().catch(() => {});
    }
  }
  fail(`could not start Chromium with WebGL (${String(lastError && lastError.message).split('\n')[0]}). Try: npx playwright install chromium`);
}

// Runs in the page: a player on an offscreen canvas, and helpers that render frames.
function setUpPage({ source, inputs }) {
  const player = new XYT.Player(document.getElementById('c'), {
    autoplay: false, adaptive: false, pauseWhenHidden: false, pointer: false, fitAspect: false, reducedMotion: 'play', inputs,
  });
  const r = player.load(source);
  if (!r.ok) throw new Error(r.errors.map((e) => `line ${e.line}: ${e.message}`).join('\n'));
  window.xytDuration = r.duration;
  const b64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  // even sizes when they go to a video encoder
  window.xytSize = (height, even = false) => {
    const w = even ? Math.round(height * r.aspect / 2) * 2 : Math.max(1, Math.round(height * r.aspect));
    player.setSize(w, height);
    return { w, h: height };
  };
  window.xytRaw = (t) => b64(player.renderAt(t).readPixels());
  // tiles: [{ t, x, y }] drawn at w x h into a W x H image, with a time label under each when labels is set
  window.xytPng = (tiles, w, h, W, H, labels) => {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    const img = new ImageData(w, h);
    for (const tile of tiles) {
      img.data.set(player.renderAt(tile.t).readPixels());
      ctx.putImageData(img, tile.x, tile.y);
      if (labels) { ctx.fillStyle = '#e6edf3'; ctx.fillText(`${tile.t} s`, tile.x + 2, tile.y + h + 12); }
    }
    return out.toDataURL('image/png').split(',')[1];
  };
}
