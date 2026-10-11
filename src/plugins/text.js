// The text plugin: `text "Frère Jacques" x= y= size= ...`, drawn with the Hershey Roman Simplex
// stroke font, so it stays pure math like every other shape (no textures).
//
//   import { use } from 'xyt-motion';
//   import text from 'xyt-motion/text';
//   use(text);
//
// or, with script tags, load dist/xyt-text.min.js after the library. Programs then start with `use text`.
import { HERSHEY } from './text-font.js';

const CAP = 21; // capital height in font units: from -12 to the baseline at 9
const MID = -1.5; // the middle of the capitals, where y= puts the text

// A glyph: its advance width and its strokes as segments [x0, y0, x1, y1], starting at x = 0.
function decode(jhf) {
  const R = 82, left = jhf.charCodeAt(0) - R, right = jhf.charCodeAt(1) - R;
  const strokes = [];
  let cur = [];
  for (let k = 2; k < jhf.length; k += 2) {
    if (jhf[k] === ' ' && jhf[k + 1] === 'R') { if (cur.length) strokes.push(cur); cur = []; continue; }
    cur.push([jhf.charCodeAt(k) - R, jhf.charCodeAt(k + 1) - R]);
  }
  if (cur.length) strokes.push(cur);
  return { ...glyph(right - left, strokes.map((s) => s.map(([x, y]) => [x - left, y]))), center: -left };
}

function glyph(w, strokes) {
  const segs = [];
  for (const s of strokes) {
    if (s.length === 1) segs.push([...s[0], ...s[0]]); // a dot
    for (let i = 1; i < s.length; i++) segs.push([...s[i - 1], ...s[i]]);
  }
  const ys = segs.flatMap((g) => [g[1], g[3]]);
  return { w, strokes, segs, top: ys.length ? Math.min(...ys) : 0, bottom: ys.length ? Math.max(...ys) : 0 };
}

const GLYPHS = new Map(HERSHEY.map((jhf, i) => [String.fromCharCode(32 + i), decode(jhf)]));

// Accents, centered on x = 0, placed for lowercase (above y = -5); capitals lift them by 7.
const dot = (x, y) => [[x - 1, y], [x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]];
const ACCENTS = {
  acute: [[[-1, -7], [2, -11]]],
  grave: [[[-2, -11], [1, -7]]],
  circumflex: [[[-3, -8], [0, -11], [3, -8]]],
  caron: [[[-3, -11], [0, -8], [3, -11]]],
  diaeresis: [dot(-3, -9), dot(3, -9)],
  tilde: [[[-4, -8], [-3, -10], [-1, -10], [1, -8], [3, -8], [4, -10]]],
  ring: [[[0, -12], [-2, -11], [-2, -9], [0, -8], [2, -9], [2, -11], [0, -12]]],
  cedilla: [[[0, 9], [1, 11], [2, 12], [1, 14], [-1, 14]]],
};
const MARKS = { '\u0301': 'acute', '\u0300': 'grave', '\u0302': 'circumflex', '\u0308': 'diaeresis', '\u0303': 'tilde', '\u030a': 'ring', '\u0327': 'cedilla', '\u030c': 'caron' };

// A letter with an accent: the accent centered over the letter, lifted for capitals.
function accented(baseChar, accent) {
  const base = GLYPHS.get(baseChar);
  const lift = accent !== 'cedilla' && baseChar !== baseChar.toLowerCase() ? -7 : 0;
  // î and ï drop the dot of the i
  const strokes = baseChar === 'i' ? base.strokes.filter((s) => Math.min(...s.map((p) => p[1])) > -10) : base.strokes;
  return glyph(base.w, strokes.concat(ACCENTS[accent].map((s) => s.map(([x, y]) => [x + base.center, y + lift]))));
}
// Two letters joined, the second overlapping the first by `overlap`: œ, æ.
function ligature(a, b, overlap) {
  const ga = GLYPHS.get(a), gb = GLYPHS.get(b), shift = ga.w - overlap;
  return glyph(ga.w + gb.w - overlap, ga.strokes.concat(gb.strokes.map((s) => s.map(([x, y]) => [x + shift, y]))));
}
// French, Spanish, German, Portuguese, Serbian and Croatian Latin, Czech, Polish (without ą ę ł ż)
for (const ch of 'àáâãäåèéêëìíîïñòóôõöùúûüýÿçčćšžřěňńśźÀÁÂÃÄÅÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝÇČĆŠŽŘĚŇŃŚŹ') {
  const [base, ...marks] = ch.normalize('NFD');
  GLYPHS.set(ch, accented(base, MARKS[marks[0]]));
}
// đ and Đ: a bar across the d's ascender and the D's stem
function barred(baseChar, y, from, to) {
  const base = GLYPHS.get(baseChar);
  const stems = base.segs.filter(([x0, y0, x1, y1]) => x0 === x1 && Math.min(y0, y1) === -12);
  const x = baseChar === 'D' ? Math.min(...stems.map((g) => g[0])) : Math.max(...stems.map((g) => g[0]));
  return glyph(base.w, base.strokes.concat([[[x + from, y], [x + to, y]]]));
}
GLYPHS.set('đ', barred('d', -8, -4, 3));
GLYPHS.set('Đ', barred('D', -1.5, -3, 5));
GLYPHS.set('œ', ligature('o', 'e', 5));
GLYPHS.set('Œ', ligature('O', 'E', 6));
GLYPHS.set('æ', ligature('a', 'e', 5));
GLYPHS.set('Æ', ligature('A', 'E', 5));
GLYPHS.set('«', glyph(14, [[[5, -3], [1, 2], [5, 7]], [[10, -3], [6, 2], [10, 7]]]));
GLYPHS.set('»', glyph(14, [[[4, -3], [8, 2], [4, 7]], [[9, -3], [13, 2], [9, 7]]]));

// Typography people and models paste in, written with the glyphs above.
const SAME_AS = { '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u00a0': ' ', '\u202f': ' ' };
const prepare = (str) => [...str.normalize('NFC')].map((c) => SAME_AS[c] ?? c).join('');

const fmt = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
// FNV-1a: one GLSL function per distinct text
const hash = (s) => { let h = 0x811c9dc5; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };

function glyphFunction(ch) {
  const name = `xg_${ch.codePointAt(0)}`;
  const g = GLYPHS.get(ch);
  const lines = g.segs.map(([x0, y0, x1, y1]) => `  d = min(d, sdSeg(p, vec2(${fmt(x0)}, ${fmt(y0)}), vec2(${fmt(x1)}, ${fmt(y1)})));`);
  return [name, `float ${name}(vec2 p){ float d = 1e4;\n${lines.join('\n')}\n  return d; }`];
}

// The signed distance to the text in canvas units. Each letter is only measured when the point is
// within its box; reveal cuts the text from the right, so it can appear left to right.
function textFunction(str, add) {
  const chars = [...prepare(str)];
  let x = 0, top = 0, bottom = 0;
  const parts = [];
  chars.forEach((ch, i) => {
    const g = GLYPHS.get(ch);
    if (g.segs.length) {
      const [fn, code] = glyphFunction(ch);
      add(fn, code);
      parts.push(`  { float o = ${fmt(x)} + sp * ${fmt(i)};\n    if (q.x > o - pad && q.x < o + ${fmt(g.w)} + pad && q.y > ${fmt(g.top)} - pad && q.y < ${fmt(g.bottom)} + pad) d = min(d, ${fn}(q - vec2(o, 0.0))); }`);
      top = Math.min(top, g.top);
      bottom = Math.max(bottom, g.bottom);
    }
    x += g.w;
  });
  const name = `xt_${hash(str)}`;
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

export const text = {
  name: 'text',
  reference: `Text (the program starts with: use text):
text "Frère Jacques" x= y= size= color=    // one line of text; x, y = its center, size = height of capitals
  align=left|center|right (default center) weight=0.12 (stroke width, relative to size) spacing=0 (extra, relative to size)
  reveal=0-1 shows it from the left, for karaoke: draw it white, then again in gold with reveal=sp. Accents work (é ç ñ ü œ č š ž đ).
clip text "WORD" size=0.3 draws the lines inside only within the letters.`,
  shapes: {
    text: {
      string: true,
      values: { x: 0.5, y: 0.5, size: 0.1, weight: 0.12, align: 0.5, reveal: 1, spacing: 0 },
      aliases: { cx: 'x', cy: 'y', height: 'size', thickness: 'weight', progress: 'reveal', letterspacing: 'spacing' },
      names: { align: { left: 0, center: 0.5, middle: 0.5, right: 1 } },
      check(str) {
        if (!str.trim()) return 'text needs something to write between the quotes';
        const missing = [...new Set([...prepare(str)].filter((c) => !GLYPHS.has(c)))];
        return missing.length ? `text can't draw ${missing.map((c) => `'${c}'`).join(', ')} yet; it draws ASCII letters, digits and punctuation, and accented Latin letters like é è ç ñ ü œ č ć š ž đ` : null;
      },
      distance(str, num, add) {
        const fn = textFunction(str, add);
        return `${fn}(PP - vec2(${num('x')}, ${num('y')}), ${num('size')}, ${num('weight')}, ${num('align')}, ${num('reveal')}, ${num('spacing')}, ${num('blur')})`;
      },
      thickness: (str, num) => `abs(${num('weight')} * ${num('size')})`,
      // a pixel measures the strokes of the letters near it, and checks every letter's box
      cost: (str) => 2 + Math.ceil([...prepare(str)].length / 6),
    },
  },
};

export default text;
