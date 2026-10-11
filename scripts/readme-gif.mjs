// Renders the README animation, media/examples.gif: four examples side by side, each labeled
// with the size of its source. Uses dist/ (run `npm run build` first) and headless Chromium.
//   node scripts/readme-gif.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import gifenc from 'gifenc'; // CommonJS: no named exports

const { GIFEncoder, quantize, applyPalette } = gifenc;

// Every duration divides SECONDS, so the GIF loops without a jump.
const EXAMPLES = ['plasma', 'ripples', 'ball', 'spinner'];
const SECONDS = 6, FPS = 12.5, TILE = 200, GAP = 8, LABEL = 30;

const programs = EXAMPLES.map((id) => {
  const src = readFileSync(`examples/${id}.xyt`, 'utf8');
  return { id, src, bytes: Buffer.byteLength(src) };
});
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setContent('<!doctype html><body></body>');
await page.addScriptTag({ content: readFileSync('dist/xyt.min.js', 'utf8') });
const size = await page.evaluate(({ programs, TILE, GAP, LABEL }) => {
  const W = programs.length * TILE + (programs.length + 1) * GAP, H = TILE + 2 * GAP + LABEL;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  const tile = new ImageData(TILE, TILE);
  const players = programs.map((p) => {
    const player = new XYT.Player(document.createElement('canvas'), { autoplay: false, adaptive: false, pauseWhenHidden: false, pointer: false, fitAspect: false, reducedMotion: 'play' });
    if (!player.load(p.src).ok) throw new Error(`${p.id} does not compile`);
    player.setSize(TILE, TILE);
    return player;
  });
  window.frameAt = (t) => {
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    programs.forEach((p, i) => {
      const x = GAP + i * (TILE + GAP);
      tile.data.set(players[i].renderAt(t % players[i].duration).readPixels());
      ctx.putImageData(tile, x, GAP);
      ctx.fillStyle = '#e6edf3';
      ctx.fillText(`${p.id}.xyt`, x, GAP + TILE + LABEL / 2 + 2);
      ctx.fillStyle = '#8b949e';
      const bytes = `${p.bytes} bytes`;
      ctx.fillText(bytes, x + TILE - ctx.measureText(bytes).width, GAP + TILE + LABEL / 2 + 2);
    });
    // base64 crosses into Node far faster than an array of numbers
    const data = ctx.getImageData(0, 0, W, H).data;
    let bin = '';
    for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  return { W, H };
}, { programs, TILE, GAP, LABEL });

const gif = GIFEncoder();
const frames = Math.round(SECONDS * FPS);
for (let f = 0; f < frames; f++) {
  const rgba = new Uint8Array(Buffer.from(await page.evaluate((t) => window.frameAt(t), f / FPS), 'base64'));
  const palette = quantize(rgba, 256);
  gif.writeFrame(applyPalette(rgba, palette), size.W, size.H, { palette, delay: 1000 / FPS });
}
gif.finish();
await browser.close();
mkdirSync('media', { recursive: true });
writeFileSync('media/examples.gif', gif.bytes());
console.log(`media/examples.gif  ${size.W}x${size.H}, ${frames} frames, ${(gif.bytes().length / 1024).toFixed(0)} KB`);
