// The text plugin: `text "Frère Jacques" x= y= size= ...`, drawn with stroke fonts, so it stays pure
// math like every other shape (no textures).
//
//   import { use } from 'xyt-motion';
//   import text from 'xyt-motion/text';
//   use(text);
//
// or, with script tags, load dist/xyt-text.min.js after the library. Programs then start with `use text`.
// It draws with the Hershey Roman Simplex font; text.addFont() adds other stroke fonts (Hershey .jhf,
// SVG fonts, or strokes as data), and each letter comes from the first font that has it.
import { HERSHEY } from './text-font.js';

const CAP = 21; // capital height in font units: from -12 to the baseline at 9
const MID = -1.5; // the middle of the capitals, where y= puts the text
const u = (code) => String.fromCharCode(code);

// Stroke fonts draw curves as a few straight segments, which show as corners in large text. A stroke
// keeps its real corners (turns over 75 degrees, like the bottom of a V) and the curves between them
// become a centripetal Catmull-Rom spline through the font's points, a few segments per point.
const CORNER = Math.cos(75 * Math.PI / 180);
function smooth(stroke) {
  const p = stroke.filter((q, i) => !i || q[0] !== stroke[i - 1][0] || q[1] !== stroke[i - 1][1]);
  const n = p.length;
  if (n < 3) return p;
  const closed = n > 3 && p[0][0] === p[n - 1][0] && p[0][1] === p[n - 1][1];
  const at = (i) => (closed ? p[((i % (n - 1)) + (n - 1)) % (n - 1)] : p[i]);
  // the cosine of the turn at each point; the ends of an open stroke count as corners
  const turn = p.map((_, i) => {
    if (!closed && (i === 0 || i === n - 1)) return -1;
    const a = at(i - 1), b = at(i), c = at(i + 1);
    const ax = b[0] - a[0], ay = b[1] - a[1], bx = c[0] - b[0], by = c[1] - b[1];
    return (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
  });
  const out = [p[0]];
  for (let i = 0; i < n - 1; i++) {
    const b = p[i], c = p[i + 1];
    const cornerB = turn[i] < CORNER, cornerC = turn[i + 1] < CORNER;
    // a corner at either end of the span: continue its straight line, so the curve leaves along the segment
    const a = cornerB ? [2 * b[0] - c[0], 2 * b[1] - c[1]] : at(i - 1);
    const d = cornerC ? [2 * c[0] - b[0], 2 * c[1] - b[1]] : at(i + 2);
    // about one segment per 12 degrees of turning at the span's smooth ends
    const bend = Math.max(cornerB ? 0 : Math.acos(Math.min(1, turn[i])), cornerC ? 0 : Math.acos(Math.min(1, turn[i + 1])));
    const k = Math.min(4, Math.ceil(bend / (12 * Math.PI / 180)));
    const t1 = Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5, t2 = t1 + Math.hypot(c[0] - b[0], c[1] - b[1]) ** 0.5;
    const t3 = t2 + Math.hypot(d[0] - c[0], d[1] - c[1]) ** 0.5;
    const lerp = (P, Q, s0, s1, s) => [P[0] + (Q[0] - P[0]) * (s - s0) / (s1 - s0), P[1] + (Q[1] - P[1]) * (s - s0) / (s1 - s0)];
    for (let j = 1; j < k; j++) {
      const s = t1 + (t2 - t1) * j / k;
      const A1 = lerp(a, b, 0, t1, s), A2 = lerp(b, c, t1, t2, s), A3 = lerp(c, d, t2, t3, s);
      out.push(lerp(lerp(A1, A2, 0, t2, s), lerp(A2, A3, t1, t3, s), t1, t2, s));
    }
    out.push(c);
  }
  return out;
}

// A glyph: its advance width and its strokes, starting at x = 0, y pointing down, capitals from -12 to 9.
function glyph(w, strokes, center = w / 2) {
  const segs = [];
  for (const raw of strokes) {
    if (raw.length === 1) segs.push([...raw[0], ...raw[0]]); // a dot
    const s = smooth(raw);
    for (let i = 1; i < s.length; i++) segs.push([...s[i - 1], ...s[i]]);
  }
  const ys = segs.flatMap((g) => [g[1], g[3]]);
  return { w, strokes, segs, center, top: ys.length ? Math.min(...ys) : 0, bottom: ys.length ? Math.max(...ys) : 0 };
}

// One glyph in the .jhf format of the Hershey distribution: left and right edges, then points as pairs
// of characters (code minus 82, 'R'); ' R' lifts the pen. `fit` maps the font's units to ours.
function jhfGlyph(jhf, fit) {
  const R = 82, left = jhf.charCodeAt(0) - R, right = jhf.charCodeAt(1) - R;
  const strokes = [];
  let cur = [];
  for (let k = 2; k < jhf.length; k += 2) {
    if (jhf[k] === ' ' && jhf[k + 1] === 'R') { if (cur.length) strokes.push(cur); cur = []; continue; }
    cur.push(fit(jhf.charCodeAt(k) - R - left, jhf.charCodeAt(k + 1) - R));
  }
  if (cur.length) strokes.push(cur);
  return glyph(fit(right - left, 0)[0], strokes, fit(-left, 0)[0]);
}

// The glyphs of a whole .jhf file, which may wrap long glyphs over several lines.
function jhfFile(text) {
  const out = [], lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length;) {
    const line = lines[i++];
    if (!line.trim()) continue;
    const n = parseInt(line.slice(5, 8), 10);
    let data = line.slice(8);
    while (data.length < n * 2 && i < lines.length) data += lines[i++];
    out.push(data.slice(0, n * 2));
  }
  return out;
}

// SVG path data to polylines: M L H V Z, and the curves C S Q T as short segments.
function pathStrokes(d) {
  const toks = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const strokes = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, cur = null;
  const n = () => Number(toks[i++]);
  const to = (px, py) => { if (!cur) { cur = [[x, y]]; strokes.push(cur); } cur.push([px, py]); x = px; y = py; };
  const curve = (at) => { const [x0, y0] = [x, y]; for (let k = 1; k <= 8; k++) to(...at(k / 8, x0, y0)); };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C, ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { x = n() + ox; y = n() + oy; sx = x; sy = y; cur = null; cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') to(n() + ox, n() + oy);
    else if (C === 'H') to(n() + ox, y);
    else if (C === 'V') to(x, n() + oy);
    else if (C === 'Z') { if (cur) to(sx, sy); cur = null; }
    else if (C === 'C' || C === 'S') {
      const [x1, y1] = C === 'C' ? [n() + ox, n() + oy] : [2 * x - cx, 2 * y - cy];
      const x2 = n() + ox, y2 = n() + oy, x3 = n() + ox, y3 = n() + oy;
      curve((t, a, b) => { const v = 1 - t; return [v * v * v * a + 3 * v * v * t * x1 + 3 * v * t * t * x2 + t * t * t * x3, v * v * v * b + 3 * v * v * t * y1 + 3 * v * t * t * y2 + t * t * t * y3]; });
      cx = x2; cy = y2;
      continue;
    } else if (C === 'Q' || C === 'T') {
      const [x1, y1] = C === 'Q' ? [n() + ox, n() + oy] : [2 * x - cx, 2 * y - cy];
      const x2 = n() + ox, y2 = n() + oy;
      curve((t, a, b) => { const v = 1 - t; return [v * v * a + 2 * v * t * x1 + t * t * x2, v * v * b + 2 * v * t * y1 + t * t * y2]; });
      cx = x1; cy = y1;
      continue;
    } else throw new Error(`a glyph's path uses '${cmd}', which stroke fonts here can't (M L H V Z C S Q T can)`);
    cx = x; cy = y;
  }
  return strokes;
}

const unescapeXml = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag); return m ? unescapeXml(m[2] ?? m[3]) : null; };

// An SVG font file: <font horiz-adv-x>, <font-face units-per-em cap-height>, <glyph unicode horiz-adv-x d>.
// y points up from the baseline there; the capitals' height comes from cap-height, else from the letter H.
function svgGlyphs(svg) {
  const fontTag = (/<font[\s>][^>]*>/.exec(svg) || [''])[0], face = (/<font-face[^>]*>/.exec(svg) || [''])[0];
  const advance = Number(attr(fontTag, 'horiz-adv-x')) || 0;
  const raw = [];
  for (const tag of svg.match(/<glyph[^>]*>/g) || []) {
    const ch = attr(tag, 'unicode');
    if (!ch || [...ch].length !== 1) continue;
    raw.push({ ch, adv: Number(attr(tag, 'horiz-adv-x')) || advance, strokes: pathStrokes(attr(tag, 'd') || '') });
  }
  const H = raw.find((g) => g.ch === 'H');
  const cap = Number(attr(face, 'cap-height')) || (H && H.strokes.length ? Math.max(...H.strokes.flat().map((p) => p[1])) : 0) ||
    (Number(attr(face, 'units-per-em')) || 1000) * 0.7;
  const k = CAP / cap;
  return new Map(raw.map((g) => [g.ch, glyph(g.adv * k, g.strokes.map((s) => s.map(([px, py]) => [px * k, 9 - py * k])))]));
}

// ---------- fonts ----------

const fonts = []; // in the order letters are looked up; the first is Hershey Roman Simplex

/**
 * Adds a stroke font. Letters it has that earlier fonts lack are drawn with it, and `font=NAME` puts
 * it first for one text line. A font is { name, ... } with one or more of:
 *   jhf: a .jhf file (or a list of .jhf glyphs), and chars: the character of each glyph (default: ASCII from space)
 *   svg: an SVG font file (each glyph names its character)
 *   glyphs: { 'Ж': { width, strokes: [[[x, y], ...], ...] }, ... }
 * jhf and glyphs use Hershey's units (y down, capitals from -12 to the baseline at 9) unless the
 * font gives its own capHeight and baseline.
 */
function addFont(font) {
  if (!font || !/^[a-z][a-z0-9_]*$/.test(font.name || '')) {
    throw new TypeError('addFont needs a font whose name is lowercase letters and digits, like { name: "cyrillic", jhf: ... }');
  }
  const k = CAP / (font.capHeight || CAP), base = font.baseline ?? 9;
  const fit = (x, y) => [x * k, 9 + (y - base) * k];
  const glyphs = new Map();
  if (font.svg) for (const [ch, g] of svgGlyphs(font.svg)) glyphs.set(ch, g);
  if (font.jhf) {
    const list = Array.isArray(font.jhf) ? font.jhf : jhfFile(font.jhf);
    const chars = font.chars ? [...font.chars] : list.map((_, i) => u(32 + i));
    list.forEach((jhf, i) => { if (chars[i]) glyphs.set(chars[i], jhfGlyph(jhf, fit)); });
  }
  for (const [ch, g] of Object.entries(font.glyphs || {})) glyphs.set(ch, glyph(g.width * k, g.strokes.map((s) => s.map(([x, y]) => fit(x, y)))));
  if (!glyphs.size) throw new Error(`the font ${font.name} has no glyphs: give it jhf, svg or glyphs`);
  const entry = { name: font.name, glyphs };
  const at = fonts.findIndex((f) => f.name === font.name);
  if (at >= 0) fonts[at] = entry; else fonts.push(entry);
  return text;
}

// Accents, centered on x = 0, placed for lowercase (above y = -5); capitals lift them by 7.
const dot = (x, y) => [[x - 1, y], [x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]];
const ACCENTS = {
  acute: [[[-1, -7], [2, -11]]],
  grave: [[[-2, -11], [1, -7]]],
  circumflex: [[[-3, -8], [0, -11], [3, -8]]],
  caron: [[[-3, -11], [0, -8], [3, -11]]],
  breve: [[[-3, -10.5], [-2, -9], [0, -8.5], [2, -9], [3, -10.5]]],
  diaeresis: [dot(-3, -9), dot(3, -9)],
  tilde: [[[-4, -8], [-3, -10], [-1, -10], [1, -8], [3, -8], [4, -10]]],
  ring: [[[0, -12], [-2, -11], [-2, -9], [0, -8], [2, -9], [2, -11], [0, -12]]],
  cedilla: [[[0, 9], [1, 11], [2, 12], [1, 14], [-1, 14]]],
};
// combining marks, as Unicode decomposes accented letters (é = e + U+0301)
const MARKS = {
  [u(0x301)]: 'acute', [u(0x300)]: 'grave', [u(0x302)]: 'circumflex', [u(0x30c)]: 'caron', [u(0x306)]: 'breve',
  [u(0x308)]: 'diaeresis', [u(0x303)]: 'tilde', [u(0x30a)]: 'ring', [u(0x327)]: 'cedilla',
};

// A letter with an accent: the accent centered over the letter, lifted for capitals; î and ï drop the dot.
function accented(base, baseChar, accent) {
  const lift = accent !== 'cedilla' && baseChar !== baseChar.toLowerCase() ? -7 : 0;
  const strokes = baseChar === 'i' || baseChar === 'j' ? base.strokes.filter((s) => Math.min(...s.map((p) => p[1])) > -10) : base.strokes;
  return glyph(base.w, strokes.concat(ACCENTS[accent].map((s) => s.map(([x, y]) => [x + base.center, y + lift]))), base.center);
}

// The built-in font, with what Hershey Roman Simplex lacks: đ Đ œ Œ æ Æ « ».
{
  const g = new Map(HERSHEY.map((jhf, i) => [u(32 + i), jhfGlyph(jhf, (x, y) => [x, y])]));
  const barred = (ch, y, from, to) => { // a bar across the d's ascender and the D's stem
    const base = g.get(ch), stems = base.segs.filter(([x0, y0, x1, y1]) => x0 === x1 && Math.min(y0, y1) === -12);
    const x = ch === 'D' ? Math.min(...stems.map((s) => s[0])) : Math.max(...stems.map((s) => s[0]));
    return glyph(base.w, base.strokes.concat([[[x + from, y], [x + to, y]]]), base.center);
  };
  const ligature = (a, b, overlap) => {
    const ga = g.get(a), gb = g.get(b), shift = ga.w - overlap;
    return glyph(ga.w + gb.w - overlap, ga.strokes.concat(gb.strokes.map((s) => s.map(([x, y]) => [x + shift, y]))));
  };
  g.set('đ', barred('d', -8, -4, 3)).set('Đ', barred('D', -1.5, -3, 5));
  g.set('œ', ligature('o', 'e', 5)).set('Œ', ligature('O', 'E', 6)).set('æ', ligature('a', 'e', 5)).set('Æ', ligature('A', 'E', 5));
  g.set('«', glyph(14, [[[5, -3], [1, 2], [5, 7]], [[10, -3], [6, 2], [10, 7]]]));
  g.set('»', glyph(14, [[[4, -3], [8, 2], [4, 7]], [[9, -3], [13, 2], [9, 7]]]));
  fonts.push({ name: 'simplex', glyphs: g });
}

// The fonts to look letters up in, the chosen one first.
const chainFor = (name) => (name ? [fonts.find((f) => f.name === name), ...fonts.filter((f) => f.name !== name)] : fonts);

// Cyrillic letters drawn exactly like Latin ones, for fonts that lack them (Serbian Ј, Macedonian Ѕ, Ukrainian І).
const LOOKALIKE = { 'Ј': 'J', 'ј': 'j', 'Ѕ': 'S', 'ѕ': 's', 'І': 'I', 'і': 'i' };

// A letter from the first font that has it; else composed from its letter and accent, or its Latin look-alike.
function find(ch, chain) {
  for (const f of chain) { const g = f.glyphs.get(ch); if (g) return { font: f, g }; }
  const [base, mark, ...more] = ch.normalize('NFD');
  if (mark && !more.length && MARKS[mark]) {
    const b = find(base, chain);
    if (b) { const g = accented(b.g, base, MARKS[mark]); b.font.glyphs.set(ch, g); return { font: b.font, g }; }
  }
  const same = LOOKALIKE[ch] && find(LOOKALIKE[ch], chain);
  if (same) { same.font.glyphs.set(ch, same.g); return same; }
  return null;
}

// Typography people and models paste in, written with the glyphs above.
const SAME_AS = {
  [u(0x2019)]: "'", [u(0x2018)]: "'", [u(0x201c)]: '"', [u(0x201d)]: '"', [u(0x2013)]: '-', [u(0x2014)]: '-',
  [u(0x2026)]: '...', [u(0xa0)]: ' ', [u(0x202f)]: ' ',
};
const prepare = (str) => [...str.normalize('NFC')].map((c) => SAME_AS[c] ?? c).join('');

const fmt = (v) => { const r = Math.round(v * 1000) / 1000; return Number.isInteger(r) ? r.toFixed(1) : String(r); };
// FNV-1a: one GLSL function per distinct text and font
const hash = (s) => { let h = 0x811c9dc5; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };

// The signed distance to the text in canvas units. Each letter is only measured when the point is
// within its box; reveal cuts the text from the right, so it can appear left to right.
function textFunction(str, fontName, add) {
  const chain = chainFor(fontName), chars = [...prepare(str)];
  let x = 0, top = 0, bottom = 0;
  const parts = [];
  chars.forEach((ch, i) => {
    const { font, g } = find(ch, chain);
    if (g.segs.length) {
      const fn = `xg_${fonts.indexOf(font)}_${ch.codePointAt(0)}`;
      add(fn, `float ${fn}(vec2 p){ float d = 1e4;\n${g.segs.map(([x0, y0, x1, y1]) => `  d = min(d, sdSeg(p, vec2(${fmt(x0)}, ${fmt(y0)}), vec2(${fmt(x1)}, ${fmt(y1)})));`).join('\n')}\n  return d; }`);
      parts.push(`  { float o = ${fmt(x)} + sp * ${fmt(i)};\n    if (q.x > o - pad && q.x < o + ${fmt(g.w)} + pad && q.y > ${fmt(g.top)} - pad && q.y < ${fmt(g.bottom)} + pad) d = min(d, ${fn}(q - vec2(o, 0.0))); }`);
      top = Math.min(top, g.top);
      bottom = Math.max(bottom, g.bottom);
    }
    x += g.w;
  });
  const name = `xt_${hash(`${fontName || ''}|${str}`)}`;
  add(name, `float ${name}(vec2 p, float size, float weight, float align, float reveal, float spacing, float blur){
  float S = max(abs(size), 1e-6) / ${fmt(CAP)}; float sp = spacing * ${fmt(CAP)}; float W = ${fmt(x)} + sp * ${fmt(Math.max(chars.length - 1, 0))};
  float hw = abs(weight) * ${fmt(CAP / 2)}; float pad = hw + 1.5 * max(blur, PX) / S + 1.0;
  vec2 q = vec2(p.x / S + align * W, p.y / S + ${fmt(MID)});
  if (q.x < -pad || q.x > W + pad || q.y < ${fmt(top)} - pad || q.y > ${fmt(bottom)} + pad) return 1e4;
  float d = 1e4;
${parts.join('\n')}
  return max(d - hw, q.x - (reveal * (W + 2.0 * pad) - pad)) * S; }`);
  return name;
}

const REFERENCE = `Text (the program starts with: use text):
text "Frère Jacques" x= y= size= color=    // one line of text; x, y = its center, size = height of capitals
  align=left|center|right (default center) weight=0.12 (stroke width, relative to size) spacing=0 (extra, relative to size)
  reveal=0-1 shows it from the left, for karaoke: draw it white, then again in gold with reveal=sp. Accents work (é ç ñ ü œ č š ž đ).
clip text "WORD" size=0.3 draws the lines inside only within the letters.`;

export const text = {
  name: 'text',
  // the model reference names the fonts loaded on this page
  get reference() {
    return fonts.length > 1 ? `${REFERENCE}\nFonts: ${fonts.map((f) => f.name).join(', ')}. Each letter comes from the first that has it; font=NAME picks one first.` : REFERENCE;
  },
  addFont,
  /** Names of the loaded fonts, in the order letters are looked up. */
  fonts: () => fonts.map((f) => f.name),
  shapes: {
    text: {
      string: true,
      values: { x: 0.5, y: 0.5, size: 0.1, weight: 0.12, align: 0.5, reveal: 1, spacing: 0 },
      aliases: { cx: 'x', cy: 'y', height: 'size', thickness: 'weight', progress: 'reveal', letterspacing: 'spacing' },
      names: { align: { left: 0, center: 0.5, middle: 0.5, right: 1 } },
      // values fixed when the program compiles, given as a name
      fixed: { font: () => fonts.map((f) => f.name) },
      check(str, fixed) {
        if (!str.trim()) return 'text needs something to write between the quotes';
        const chain = chainFor(fixed.font);
        const missing = [...new Set([...prepare(str)].filter((c) => !find(c, chain)))];
        if (!missing.length) return null;
        return `text can't draw ${missing.map((c) => `'${c}'`).join(', ')} with the fonts loaded here (${fonts.map((f) => f.name).join(', ')}).` +
          (fonts.length === 1 ? ' It draws ASCII and accented Latin letters like é ç ñ ü œ č š ž đ; the page can add fonts with other letters, like xyt-motion/text/cyrillic.' : '');
      },
      distance(str, num, add, fixed) {
        const fn = textFunction(str, fixed.font, add);
        return `${fn}(PP - vec2(${num('x')}, ${num('y')}), ${num('size')}, ${num('weight')}, ${num('align')}, ${num('reveal')}, ${num('spacing')}, ${num('blur')})`;
      },
      thickness: (str, num) => `abs(${num('weight')} * ${num('size')})`,
      // a pixel measures the strokes of the letters near it, and checks every letter's box
      cost: (str) => 2 + Math.ceil([...prepare(str)].length / 6),
    },
  },
};

export default text;
