#!/usr/bin/env node
// xyt: check and render XYT programs from the command line.
//
//   xyt check film.xyt                         errors, warnings and where the cost comes from
//   xyt render film.xyt --at 12.5              one frame as PNG
//   xyt render film.xyt --sheet                a contact sheet of frames across the duration
//   xyt render film.xyt --mp4 --audio song.mp3 an H.264 video
//   xyt cues song.mp3                          tempo, cues and loudness of a song, as lines for a program
//
// Rendering runs the real player in headless Chromium through Playwright, an optional dependency
// (npm i -D playwright && npx playwright install chromium); --mp4 also needs ffmpeg on the PATH.
// `check` needs neither.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compile, version, use } from '../dist/xyt.mjs';
import text from '../dist/text.mjs';
import cyrillic from '../dist/text-cyrillic.mjs';
import { analyse, cueLines } from './cues.mjs';

use(text); // programs that say `use text` work here and in the page below
text.addFont(cyrillic);

const USAGE = `xyt ${version}: check and render XYT programs

  xyt check <file.xyt>
  xyt render <file.xyt> --at <seconds>      one frame as PNG
  xyt render <file.xyt> --sheet             frames across the duration on one PNG
  xyt render <file.xyt> --mp4               H.264 video of the whole duration
  xyt cues <song>                           measure a song: bpm, offset, cues and its loudness as a track,
                                            as lines to paste into a program

Options:
  -o, --out <file>      output file (default: next to the program; cues: the screen)
  --height <px>         frame height (default 1080; sheet tiles 270)
  --frames <n>          sheet: number of frames (default 12)
  --columns <n>         sheet: frames per row (default 4)
  --fps <n>             mp4: frames per second (default 30)
  --from <s>, --to <s>  mp4 and sheet: time range (default: the whole duration)
  --audio <file>        mp4: sound track, cut to the video's length
  --set <name=value>    set an input, like --set wind=0.8 or --set tint=#ff8800 (repeatable)
  --font <file>         add a stroke font for text: .svg font, .jhf (ASCII order) or .json (repeatable)
  --hits <n>            cues: how many of the strongest hits to list (default 16)
  --step <s>            cues: seconds between loudness values (default 0.05)
  --name <name>         cues, for a stem: its track is named so and its cues start with it (no bpm line)

Rendering needs Playwright (npm i -D playwright && npx playwright install chromium); --mp4 and cues need ffmpeg.`;

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
      hits: { type: 'string' }, step: { type: 'string' }, name: { type: 'string' },
      help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
    },
  });
} catch (e) { fail(`${e.message}\n\n${USAGE}`); }
const { values: opt, positionals: [command, file] } = parsed;
if (opt.version) { console.log(version); process.exit(0); }
if (opt.help || !command) { console.log(USAGE); process.exit(command || opt.help ? 0 : 2); }
if (!['check', 'render', 'cues'].includes(command)) fail(`unknown command '${command}'\n\n${USAGE}`);
if (!file) fail(command === 'cues' ? 'cues needs a song, like: xyt cues song.mp3' : `${command} needs a program file, like: xyt ${command} film.xyt`);

const num = (name, value, def, min = 0) => {
  if (value === undefined) return def;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) fail(`--${name} needs a number${min > -Infinity ? ` of at least ${min}` : ''}, got '${value}'`);
  return n;
};

if (command === 'cues') {
  // decoded by ffmpeg to mono samples, then measured (bin/cues.mjs)
  if (spawnSync('ffmpeg', ['-version']).error) fail('cues needs ffmpeg on the PATH: https://ffmpeg.org (macOS: brew install ffmpeg)');
  try { readFileSync(file, { flag: 'r' }); } catch (e) { fail(`could not read ${file}: ${e.message}`); }
  const name = opt.name || '';
  if (name && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) fail(`--name needs a plain name, like --name drums; got '${name}'`);
  const sr = 22050;
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { maxBuffer: 2 ** 31 - 1 });
  if (pcm.status !== 0 || !pcm.stdout.length) fail(`ffmpeg could not decode ${file}${pcm.stderr ? `: ${String(pcm.stderr).trim()}` : ''}`);
  const samples = new Float32Array(pcm.stdout.buffer, pcm.stdout.byteOffset, Math.floor(pcm.stdout.length / 4));
  const a = analyse(samples, sr, { hits: Math.floor(num('hits', opt.hits, 16, 0)), step: num('step', opt.step, 0.05, 0.01) });
  const text = cueLines(a, { file: path.basename(file), name });
  if (opt.out) {
    writeFileSync(opt.out, text);
    console.log(`wrote ${opt.out}: ${a.confidence < 1.6 ? 'no steady beat' : `${+a.bpm.toFixed(2)} bpm`}, ${a.parts.length + 1} parts, ${a.hits.length} hits`);
  } else process.stdout.write(text);
  process.exit(0);
}

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

const base = file.replace(/\.xyt$/i, '');

if (command === 'check') {
  const heaviest = result.costs.slice(0, 5).map((c) => `line ${c.line} (${c.cost})`).join(', ');
  console.log(`${file}: ok. ${result.aspectLabel} canvas, ${result.duration} s, cost ${result.cost}` +
    (result.worstCost > result.cost ? ` (${result.worstCost} if all the drawings with bounds covered the same pixel)` : '') +
    (result.scenes.length ? `, ${result.scenes.length} scenes` : '') + (result.parts ? `, ${result.parts.length} shaders` : '') +
    (result.sims.length ? `, sims: ${result.sims.join(', ')}` : '') + (heaviest ? `. Heaviest: ${heaviest}` : ''));
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

// The page comes from a server on this machine, so video frames can travel back to it as raw bytes:
// far faster than returning them from page.evaluate, which turns every frame into an 11 MB string.
const token = randomBytes(16).toString('hex');
const onFrame = new Map(); // job number -> what to do with its frames
const server = createServer((req, res) => {
  const m = /^\/frame\/([0-9a-f]+)\/(\d+)$/.exec(req.url);
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><canvas id="c"></canvas>');
  } else if (req.method === 'POST' && m && m[1] === token && onFrame.has(+m[2])) {
    const handle = onFrame.get(+m[2]), chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => handle(Buffer.concat(chunks)).then((ok) => res.writeHead(ok ? 204 : 500).end()));
  } else {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const { browser, page } = await openPage();
try {
  if (mode === 'at') await renderFrame();
  else if (mode === 'sheet') await renderSheet();
  else await renderVideo();
} finally {
  await browser.close();
  server.close();
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
  const from = num('from', opt.from, 0), to = num('to', opt.to, result.duration);
  if (!(to > from)) fail('--to must be after --from');
  const out = opt.out || `${base}-sheet.png`;
  const png = await page.evaluate(({ frames, columns, height, from, to }) => {
    const { w, h } = window.xytSize(height), gap = 4, label = 22, D = to - from;
    const rows = Math.ceil(frames / columns);
    // the middle of each equal slice of the time range, so fades at the very start and end don't hide anything
    const tiles = Array.from({ length: frames }, (_, i) => ({
      t: Math.round((from + (i + 0.5) * D / frames) * 100) / 100, x: (i % columns) * (w + gap), y: Math.floor(i / columns) * (h + gap + label),
    }));
    return window.xytPng(tiles, w, h, columns * (w + gap) - gap, rows * (h + gap + label) - gap, true);
  }, { frames, columns, height, from, to });
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
  const start = Date.now();
  let sent = 0;
  const { code, errors } = await encode(page, 0, { w, h, fps, from, frames, out, audio: opt.audio, length: to - from }, () => {
    sent++;
    if (!process.stderr.isTTY) return;
    const left = Math.round((Date.now() - start) / sent * (frames - sent) / 1000);
    process.stderr.write(`\rframe ${sent}/${frames}, about ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left `);
  });
  if (process.stderr.isTTY) process.stderr.write('\n');
  if (code !== 0) fail(`ffmpeg failed${errors ? `:\n${errors}` : ''}`);
  console.log(`wrote ${out} (${w}x${h}, ${fps} fps, ${frames} frames${opt.audio ? ', with sound' : ''}, ${Math.round((Date.now() - start) / 1000)} s)`);
}

// Renders frames of one page straight into one ffmpeg. Resolves to { code, errors }.
function encode(p, job, { w, h, fps, from, frames, out, audio, length }, onSent) {
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-framerate', String(fps), '-i', '-',
    ...(audio ? ['-ss', String(from), '-i', audio] : []),
    // RGB to BT.709 YUV, tagged as such, so players show the program's exact colors
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
    // the sound is cut at the end of the picture, or ends early in silence
    ...(audio ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-t', String(length)] : []),
    '-map_metadata', '-1', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });
  let errors = '';
  // On macOS ffmpeg reports its first short read from a pipe as a truncated packet; the frame still arrives whole.
  ffmpeg.stderr.on('data', (d) => { errors += String(d).split('\n').filter((l) => l && !l.startsWith('Truncating packet')).map((l) => l + '\n').join(''); });
  const done = new Promise((resolve) => ffmpeg.on('close', resolve));
  ffmpeg.stdin.on('error', () => {}); // reported through the exit code below
  // Each frame the page posts goes straight to ffmpeg; the reply waits until ffmpeg can take more.
  onFrame.set(job, async (rgba) => {
    if (ffmpeg.exitCode !== null || rgba.length !== w * h * 4) return false;
    if (!ffmpeg.stdin.write(rgba)) {
      await new Promise((resolve) => {
        const go = () => { ffmpeg.stdin.off('drain', go); ffmpeg.off('close', go); resolve(); };
        ffmpeg.stdin.on('drain', go);
        ffmpeg.on('close', go);
      });
    }
    onSent();
    return ffmpeg.exitCode === null;
  });
  return p.evaluate((job) => window.xytVideo(job), { url: `/frame/${token}/${job}`, from, fps, frames }).catch(() => {})
    .then(async () => {
      onFrame.delete(job);
      ffmpeg.stdin.end();
      return { code: await done, errors };
    });
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
      const page = await preparePage(browser);
      if (page) return { browser, page };
      await browser.close();
      lastError = new Error('no WebGL');
    } catch (e) {
      lastError = e;
      if (browser) await browser.close().catch(() => {});
    }
  }
  fail(`could not start Chromium with WebGL (${String(lastError && lastError.message).split('\n')[0]}). Try: npx playwright install chromium`);
}

// A page with the player and the program, or null when the browser has no WebGL.
async function preparePage(browser) {
  const page = await browser.newPage();
  await page.goto(origin);
  if (!(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl')))) return null;
  for (const f of ['xyt.min.js', 'xyt-text.min.js', 'xyt-text-cyrillic.min.js']) await page.addScriptTag({ path: fileURLToPath(new URL(`../dist/${f}`, import.meta.url)) });
  await page.evaluate((list) => list.forEach((f) => XYTText.text.addFont(f)), fonts);
  await page.evaluate(setUpPage, { source, inputs });
  return page;
}

// Runs in the page: a player on an offscreen canvas, and helpers that render frames.
function setUpPage({ source, inputs }) {
  const player = new XYT.Player(document.getElementById('c'), {
    autoplay: false, adaptive: false, pauseWhenHidden: false, pointer: false, fitAspect: false, reducedMotion: 'play', inputs,
  });
  const r = player.load(source);
  if (!r.ok) throw new Error(r.errors.map((e) => `line ${e.line}: ${e.message}`).join('\n'));
  window.xytDuration = r.duration;
  // even sizes when they go to a video encoder
  window.xytSize = (height, even = false) => {
    const w = even ? Math.round(height * r.aspect / 2) * 2 : Math.max(1, Math.round(height * r.aspect));
    player.setSize(w, height);
    return { w, h: height };
  };
  // renders the frames of a video and posts each to the command line as raw RGBA, drawing the next
  // frame while the last one is still on its way; stops when the command line answers with an error
  window.xytVideo = async ({ url, from, fps, frames }) => {
    let last = Promise.resolve(true);
    for (let f = 0; f < frames; f++) {
      const px = player.renderAt(from + f / fps).readPixels();
      if (!(await last)) return;
      // a Blob body: Chromium sends a bare Uint8Array about ten times slower
      last = fetch(url, { method: 'POST', body: new Blob([px]) }).then((r) => r.ok, () => false);
    }
    await last;
  };
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
