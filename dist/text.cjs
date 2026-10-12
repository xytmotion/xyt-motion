/*! xyt-motion text plugin 0.3.0 | MIT */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/plugins/text.js
var text_exports = {};
__export(text_exports, {
  default: () => text_default,
  text: () => text
});
module.exports = __toCommonJS(text_exports);

// src/plugins/text-font.js
var HERSHEY = [
  "JZ",
  // space
  "MWRFRT RRYQZR[SZRY",
  // !
  "JZNFNM RVFVM",
  // "
  "H]SBLb RYBRb RLOZO RKUYU",
  // #
  "H\\PBP_ RTBT_ RYIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX",
  // $
  "F^[FI[ RNFPHPJOLMMKMIKIIJGLFNFPGSHVHYG[F RWTUUTWTYV[X[ZZ[X[VYTWT",
  // %
  "E_\\O\\N[MZMYNXPVUTXRZP[L[JZIYHWHUISJRQNRMSKSIRGPFNGMIMKNNPQUXWZY[[[\\Z\\Y",
  // &
  "MWRHQGRFSGSIRKQL",
  // '
  "KYVBTDRGPKOPOTPYR]T`Vb",
  // (
  "KYNBPDRGTKUPUTTYR]P`Nb",
  // )
  "JZRFRR RMIWO RWIMO",
  // *
  "E_RIR[ RIR[R",
  // +
  "MWSZR[QZRYSZS\\R^Q_",
  // ,
  "E_IR[R",
  // -
  "MWRYQZR[SZRY",
  // .
  "G][BIb",
  // /
  "H\\QFNGLJKOKRLWNZQ[S[VZXWYRYOXJVGSFQF",
  // 0
  "H\\NJPISFS[",
  // 1
  "H\\LKLJMHNGPFTFVGWHXJXLWNUQK[Y[",
  // 2
  "H\\MFXFRNUNWOXPYSYUXXVZS[P[MZLYKW",
  // 3
  "H\\UFKTZT RUFU[",
  // 4
  "H\\WFMFLOMNPMSMVNXPYSYUXXVZS[P[MZLYKW",
  // 5
  "H\\XIWGTFRFOGMJLOLTMXOZR[S[VZXXYUYTXQVOSNRNOOMQLT",
  // 6
  "H\\YFO[ RKFYF",
  // 7
  "H\\PFMGLILKMMONSOVPXRYTYWXYWZT[P[MZLYKWKTLRNPQOUNWMXKXIWGTFPF",
  // 8
  "H\\XMWPURRSQSNRLPKMKLLINGQFRFUGWIXMXRWWUZR[P[MZLX",
  // 9
  "MWRMQNROSNRM RRYQZR[SZRY",
  // :
  "MWRMQNROSNRM RSZR[QZRYSZS\\R^Q_",
  // ;
  "F^ZIJRZ[",
  // <
  "E_IO[O RIU[U",
  // =
  "F^JIZRJ[",
  // >
  "I[LKLJMHNGPFTFVGWHXJXLWNVORQRT RRYQZR[SZRY",
  // ?
  "E`WNVLTKQKOLNMMPMSNUPVSVUUVS RQKOMNPNSOUPV RWKVSVUXVZV\\T]Q]O\\L[JYHWGTFQFNGLHJJILHOHRIUJWLYNZQ[T[WZYYZX RXKWSWUXV",
  // @
  "I[RFJ[ RRFZ[ RMTWT",
  // A
  "G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[",
  // B
  "H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV",
  // C
  "G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[",
  // D
  "H[LFL[ RLFYF RLPTP RL[Y[",
  // E
  "HZLFL[ RLFYF RLPTP",
  // F
  "H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS",
  // G
  "G]KFK[ RYFY[ RKPYP",
  // H
  "NVRFR[",
  // I
  "JZVFVVUYTZR[P[NZMYLVLT",
  // J
  "G\\KFK[ RYFKT RPOY[",
  // K
  "HYLFL[ RL[X[",
  // L
  "F^JFJ[ RJFR[ RZFR[ RZFZ[",
  // M
  "G]KFK[ RKFY[ RYFY[",
  // N
  "G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF",
  // O
  "G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ",
  // P
  "G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]",
  // Q
  "G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[",
  // R
  "H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX",
  // S
  "JZRFR[ RKFYF",
  // T
  "G]KFKULXNZQ[S[VZXXYUYF",
  // U
  "I[JFR[ RZFR[",
  // V
  "F^HFM[ RRFM[ RRFW[ R\\FW[",
  // W
  "H\\KFY[ RYFK[",
  // X
  "I[JFRPR[ RZFRP",
  // Y
  "H\\YFK[ RKFYF RK[Y[",
  // Z
  "KYOBOb RPBPb ROBVB RObVb",
  // [
  "KYKFY^",
  // backslash
  "KYTBTb RUBUb RNBUB RNbUb",
  // ]
  "JZPLRITL RMORJWO RRJR[",
  // ^
  "JZJ]Z]",
  // _
  "MWSFRGQIQKRLSKRJ",
  // `
  "I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
  // a
  "H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
  // b
  "I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX",
  // c
  "I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
  // d
  "I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX",
  // e
  "MYWFUFSGRJR[ ROMVM",
  // f
  "I\\XMX]W`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
  // g
  "I\\MFM[ RMQPNRMUMWNXQX[",
  // h
  "NVQFRGSFREQF RRMR[",
  // i
  "MWRFSGTFSERF RSMS^RaPbNb",
  // j
  "IZMFM[ RWMMW RQSX[",
  // k
  "NVRFR[",
  // l
  "CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][",
  // m
  "I\\MMM[ RMQPNRMUMWNXQX[",
  // n
  "I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM",
  // o
  "H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
  // p
  "I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
  // q
  "KXOMO[ ROSPPRNTMWM",
  // r
  "J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX",
  // s
  "MYRFRWSZU[W[ ROMVM",
  // t
  "I\\MMMWNZP[S[UZXW RXMX[",
  // u
  "JZLMR[ RXMR[",
  // v
  "G]JMN[ RRMN[ RRMV[ RZMV[",
  // w
  "J[MMX[ RXMM[",
  // x
  "JZLMR[ RXMR[P_NaLbKb",
  // y
  "J[XMM[ RMMXM RM[X[",
  // z
  "KYTBRCQDPFPHQJRKSMSOQQ RRCQEQGRISJTLTNSPORSTTVTXSZR[Q]Q_Ra RQSSUSWRYQZP\\P^Q`RaTb",
  // {
  "NVRBRb",
  // |
  "KYPBRCSDTFTHSJRKQMQOSQ RRCSESGRIQJPLPNQPURQTPVPXQZR[S]S_Ra RSSQUQWRYSZT\\T^S`RaPb",
  // }
  "F^IUISJPLONOPPTSVTXTZS[Q RISJQLPNPPQTTVUXUZT[Q[O"
  // ~
];

// src/plugins/text.js
var CAP = 21;
var MID = -1.5;
var u = (code) => String.fromCharCode(code);
var CORNER = Math.cos(75 * Math.PI / 180);
function smooth(stroke) {
  const p = stroke.filter((q, i) => !i || q[0] !== stroke[i - 1][0] || q[1] !== stroke[i - 1][1]);
  const n = p.length;
  if (n < 3) return p;
  const closed = n > 3 && p[0][0] === p[n - 1][0] && p[0][1] === p[n - 1][1];
  const at = (i) => closed ? p[(i % (n - 1) + (n - 1)) % (n - 1)] : p[i];
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
    const a = cornerB ? [2 * b[0] - c[0], 2 * b[1] - c[1]] : at(i - 1);
    const d = cornerC ? [2 * c[0] - b[0], 2 * c[1] - b[1]] : at(i + 2);
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
function glyph(w, strokes, center = w / 2) {
  const segs = [];
  for (const raw of strokes) {
    if (raw.length === 1) segs.push([...raw[0], ...raw[0]]);
    const s = smooth(raw);
    for (let i = 1; i < s.length; i++) segs.push([...s[i - 1], ...s[i]]);
  }
  const ys = segs.flatMap((g) => [g[1], g[3]]);
  return { w, strokes, segs, center, top: ys.length ? Math.min(...ys) : 0, bottom: ys.length ? Math.max(...ys) : 0 };
}
function jhfGlyph(jhf, fit) {
  const R = 82, left = jhf.charCodeAt(0) - R, right = jhf.charCodeAt(1) - R;
  const strokes = [];
  let cur = [];
  for (let k = 2; k < jhf.length; k += 2) {
    if (jhf[k] === " " && jhf[k + 1] === "R") {
      if (cur.length) strokes.push(cur);
      cur = [];
      continue;
    }
    cur.push(fit(jhf.charCodeAt(k) - R - left, jhf.charCodeAt(k + 1) - R));
  }
  if (cur.length) strokes.push(cur);
  return glyph(fit(right - left, 0)[0], strokes, fit(-left, 0)[0]);
}
function jhfFile(text2) {
  const out = [], lines = String(text2).split(/\r?\n/);
  for (let i = 0; i < lines.length; ) {
    const line = lines[i++];
    if (!line.trim()) continue;
    const n = parseInt(line.slice(5, 8), 10);
    let data = line.slice(8);
    while (data.length < n * 2 && i < lines.length) data += lines[i++];
    out.push(data.slice(0, n * 2));
  }
  return out;
}
function pathStrokes(d) {
  const toks = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const strokes = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, cur = null;
  const n = () => Number(toks[i++]);
  const to = (px, py) => {
    if (!cur) {
      cur = [[x, y]];
      strokes.push(cur);
    }
    cur.push([px, py]);
    x = px;
    y = py;
  };
  const curve = (at) => {
    const [x0, y0] = [x, y];
    for (let k = 1; k <= 8; k++) to(...at(k / 8, x0, y0));
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C, ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "M") {
      x = n() + ox;
      y = n() + oy;
      sx = x;
      sy = y;
      cur = null;
      cmd = rel ? "l" : "L";
    } else if (C === "L") to(n() + ox, n() + oy);
    else if (C === "H") to(n() + ox, y);
    else if (C === "V") to(x, n() + oy);
    else if (C === "Z") {
      if (cur) to(sx, sy);
      cur = null;
    } else if (C === "C" || C === "S") {
      const [x1, y1] = C === "C" ? [n() + ox, n() + oy] : [2 * x - cx, 2 * y - cy];
      const x2 = n() + ox, y2 = n() + oy, x3 = n() + ox, y3 = n() + oy;
      curve((t, a, b) => {
        const v = 1 - t;
        return [v * v * v * a + 3 * v * v * t * x1 + 3 * v * t * t * x2 + t * t * t * x3, v * v * v * b + 3 * v * v * t * y1 + 3 * v * t * t * y2 + t * t * t * y3];
      });
      cx = x2;
      cy = y2;
      continue;
    } else if (C === "Q" || C === "T") {
      const [x1, y1] = C === "Q" ? [n() + ox, n() + oy] : [2 * x - cx, 2 * y - cy];
      const x2 = n() + ox, y2 = n() + oy;
      curve((t, a, b) => {
        const v = 1 - t;
        return [v * v * a + 2 * v * t * x1 + t * t * x2, v * v * b + 2 * v * t * y1 + t * t * y2];
      });
      cx = x1;
      cy = y1;
      continue;
    } else throw new Error(`a glyph's path uses '${cmd}', which stroke fonts here can't (M L H V Z C S Q T can)`);
    cx = x;
    cy = y;
  }
  return strokes;
}
var unescapeXml = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
var attr = (tag, name) => {
  var _a;
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag);
  return m ? unescapeXml((_a = m[2]) != null ? _a : m[3]) : null;
};
function svgGlyphs(svg) {
  const fontTag = (/<font[\s>][^>]*>/.exec(svg) || [""])[0], face = (/<font-face[^>]*>/.exec(svg) || [""])[0];
  const advance = Number(attr(fontTag, "horiz-adv-x")) || 0;
  const raw = [];
  for (const tag of svg.match(/<glyph[^>]*>/g) || []) {
    const ch = attr(tag, "unicode");
    if (!ch || [...ch].length !== 1) continue;
    raw.push({ ch, adv: Number(attr(tag, "horiz-adv-x")) || advance, strokes: pathStrokes(attr(tag, "d") || "") });
  }
  const H = raw.find((g) => g.ch === "H");
  const cap = Number(attr(face, "cap-height")) || (H && H.strokes.length ? Math.max(...H.strokes.flat().map((p) => p[1])) : 0) || (Number(attr(face, "units-per-em")) || 1e3) * 0.7;
  const k = CAP / cap;
  return new Map(raw.map((g) => [g.ch, glyph(g.adv * k, g.strokes.map((s) => s.map(([px, py]) => [px * k, 9 - py * k])))]));
}
var fonts = [];
function addFont(font) {
  var _a;
  if (!font || !/^[a-z][a-z0-9_]*$/.test(font.name || "")) {
    throw new TypeError('addFont needs a font whose name is lowercase letters and digits, like { name: "cyrillic", jhf: ... }');
  }
  const k = CAP / (font.capHeight || CAP), base = (_a = font.baseline) != null ? _a : 9;
  const fit = (x, y) => [x * k, 9 + (y - base) * k];
  const glyphs = /* @__PURE__ */ new Map();
  if (font.svg) for (const [ch, g] of svgGlyphs(font.svg)) glyphs.set(ch, g);
  if (font.jhf) {
    const list = Array.isArray(font.jhf) ? font.jhf : jhfFile(font.jhf);
    const chars = font.chars ? [...font.chars] : list.map((_, i) => u(32 + i));
    list.forEach((jhf, i) => {
      if (chars[i]) glyphs.set(chars[i], jhfGlyph(jhf, fit));
    });
  }
  for (const [ch, g] of Object.entries(font.glyphs || {})) glyphs.set(ch, glyph(g.width * k, g.strokes.map((s) => s.map(([x, y]) => fit(x, y)))));
  if (!glyphs.size) throw new Error(`the font ${font.name} has no glyphs: give it jhf, svg or glyphs`);
  const entry = { name: font.name, glyphs };
  const at = fonts.findIndex((f) => f.name === font.name);
  if (at >= 0) fonts[at] = entry;
  else fonts.push(entry);
  return text;
}
var dot = (x, y) => [[x - 1, y], [x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]];
var ACCENTS = {
  acute: [[[-1, -7], [2, -11]]],
  grave: [[[-2, -11], [1, -7]]],
  circumflex: [[[-3, -8], [0, -11], [3, -8]]],
  caron: [[[-3, -11], [0, -8], [3, -11]]],
  breve: [[[-3, -10.5], [-2, -9], [0, -8.5], [2, -9], [3, -10.5]]],
  diaeresis: [dot(-3, -9), dot(3, -9)],
  tilde: [[[-4, -8], [-3, -10], [-1, -10], [1, -8], [3, -8], [4, -10]]],
  ring: [[[0, -12], [-2, -11], [-2, -9], [0, -8], [2, -9], [2, -11], [0, -12]]],
  cedilla: [[[0, 9], [1, 11], [2, 12], [1, 14], [-1, 14]]]
};
var MARKS = {
  [u(769)]: "acute",
  [u(768)]: "grave",
  [u(770)]: "circumflex",
  [u(780)]: "caron",
  [u(774)]: "breve",
  [u(776)]: "diaeresis",
  [u(771)]: "tilde",
  [u(778)]: "ring",
  [u(807)]: "cedilla"
};
function accented(base, baseChar, accent) {
  const lift = accent !== "cedilla" && baseChar !== baseChar.toLowerCase() ? -7 : 0;
  const strokes = baseChar === "i" || baseChar === "j" ? base.strokes.filter((s) => Math.min(...s.map((p) => p[1])) > -10) : base.strokes;
  return glyph(base.w, strokes.concat(ACCENTS[accent].map((s) => s.map(([x, y]) => [x + base.center, y + lift]))), base.center);
}
{
  const g = new Map(HERSHEY.map((jhf, i) => [u(32 + i), jhfGlyph(jhf, (x, y) => [x, y])]));
  const barred = (ch, y, from, to) => {
    const base = g.get(ch), stems = base.segs.filter(([x0, y0, x1, y1]) => x0 === x1 && Math.min(y0, y1) === -12);
    const x = ch === "D" ? Math.min(...stems.map((s) => s[0])) : Math.max(...stems.map((s) => s[0]));
    return glyph(base.w, base.strokes.concat([[[x + from, y], [x + to, y]]]), base.center);
  };
  const ligature = (a, b, overlap) => {
    const ga = g.get(a), gb = g.get(b), shift = ga.w - overlap;
    return glyph(ga.w + gb.w - overlap, ga.strokes.concat(gb.strokes.map((s) => s.map(([x, y]) => [x + shift, y]))));
  };
  g.set("\u0111", barred("d", -8, -4, 3)).set("\u0110", barred("D", -1.5, -3, 5));
  g.set("\u0153", ligature("o", "e", 5)).set("\u0152", ligature("O", "E", 6)).set("\xE6", ligature("a", "e", 5)).set("\xC6", ligature("A", "E", 5));
  g.set("\xAB", glyph(14, [[[5, -3], [1, 2], [5, 7]], [[10, -3], [6, 2], [10, 7]]]));
  g.set("\xBB", glyph(14, [[[4, -3], [8, 2], [4, 7]], [[9, -3], [13, 2], [9, 7]]]));
  fonts.push({ name: "simplex", glyphs: g });
}
var chainFor = (name) => name ? [fonts.find((f) => f.name === name), ...fonts.filter((f) => f.name !== name)] : fonts;
var LOOKALIKE = { "\u0408": "J", "\u0458": "j", "\u0405": "S", "\u0455": "s", "\u0406": "I", "\u0456": "i" };
function find(ch, chain) {
  for (const f of chain) {
    const g = f.glyphs.get(ch);
    if (g) return { font: f, g };
  }
  const [base, mark, ...more] = ch.normalize("NFD");
  if (mark && !more.length && MARKS[mark]) {
    const b = find(base, chain);
    if (b) {
      const g = accented(b.g, base, MARKS[mark]);
      b.font.glyphs.set(ch, g);
      return { font: b.font, g };
    }
  }
  const same = LOOKALIKE[ch] && find(LOOKALIKE[ch], chain);
  if (same) {
    same.font.glyphs.set(ch, same.g);
    return same;
  }
  return null;
}
var SAME_AS = {
  [u(8217)]: "'",
  [u(8216)]: "'",
  [u(8220)]: '"',
  [u(8221)]: '"',
  [u(8211)]: "-",
  [u(8212)]: "-",
  [u(8230)]: "...",
  [u(160)]: " ",
  [u(8239)]: " "
};
var prepare = (str) => [...str.normalize("NFC")].map((c) => {
  var _a;
  return (_a = SAME_AS[c]) != null ? _a : c;
}).join("");
var fmt = (v) => {
  const r = Math.round(v * 1e3) / 1e3;
  return Number.isInteger(r) ? r.toFixed(1) : String(r);
};
var hash = (s) => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};
function textFunction(str, fontName, add) {
  const chain = chainFor(fontName), chars = [...prepare(str)];
  let x = 0, top = 0, bottom = 0;
  const letters = /* @__PURE__ */ new Map();
  chars.forEach((ch, i) => {
    const { font, g } = find(ch, chain);
    if (g.segs.length) {
      const fn = `xg_${fonts.indexOf(font)}_${ch.codePointAt(0)}`;
      add(fn, `float ${fn}(vec2 p){ float d = 1e4;
${g.segs.map(([x0, y0, x1, y1]) => `  d = min(d, sdSeg(p, vec2(${fmt(x0)}, ${fmt(y0)}), vec2(${fmt(x1)}, ${fmt(y1)})));`).join("\n")}
  return d; }`);
      if (!letters.has(fn)) letters.set(fn, { g, mids: [] });
      letters.get(fn).mids.push(`${fmt(x + g.w / 2)} + sp * ${fmt(i)}`);
      top = Math.min(top, g.top);
      bottom = Math.max(bottom, g.bottom);
    }
    x += g.w;
  });
  const parts = [...letters].map(([fn, { g, mids }]) => {
    const pick = mids.length === 1 ? `float m = ${mids[0]};` : `float m = ${mids[0]}, c;
${mids.slice(1).map((c) => `    c = ${c}; if (abs(q.x - c) < abs(q.x - m)) m = c;`).join("\n")}`;
    return `  { ${pick}
    if (abs(q.x - m) < ${fmt(g.w / 2)} + pad && q.y > ${fmt(g.top)} - pad && q.y < ${fmt(g.bottom)} + pad) d = min(d, ${fn}(q - vec2(m - ${fmt(g.w / 2)}, 0.0))); }`;
  });
  const name = `xt_${hash(`${fontName || ""}|${str}`)}`;
  add(name, `float ${name}(vec2 p, float size, float weight, float align, float reveal, float spacing, float blur){
  float S = max(abs(size), 1e-6) / ${fmt(CAP)}; float sp = spacing * ${fmt(CAP)}; float W = ${fmt(x)} + sp * ${fmt(Math.max(chars.length - 1, 0))};
  float hw = abs(weight) * ${fmt(CAP / 2)}; float pad = hw + 1.5 * max(blur, PX) / S + 1.0;
  vec2 q = vec2(p.x / S + align * W, p.y / S + ${fmt(MID)});
  if (q.x < -pad || q.x > W + pad || q.y < ${fmt(top)} - pad || q.y > ${fmt(bottom)} + pad) return 1e4;
  float d = 1e4;
${parts.join("\n")}
  return max(d - hw, q.x - (reveal * (W + 2.0 * pad) - pad)) * S; }`);
  return name;
}
var REFERENCE = `Text (the program starts with: use text):
text "Fr\xE8re Jacques" x= y= size= color=    // one line of text; x, y = its center, size = height of capitals
  align=left|center|right (default center) weight=0.12 (stroke width, relative to size) spacing=0 (extra, relative to size)
  reveal=0-1 shows it from the left, for karaoke: draw it white, then again in gold with reveal=sp. Accents work (\xE9 \xE7 \xF1 \xFC \u0153 \u010D \u0161 \u017E \u0111).
clip text "WORD" size=0.3 draws the lines inside only within the letters.`;
var text = {
  name: "text",
  // the model reference names the fonts loaded on this page
  get reference() {
    return fonts.length > 1 ? `${REFERENCE}
Fonts: ${fonts.map((f) => f.name).join(", ")}. Each letter comes from the first that has it; font=NAME picks one first.` : REFERENCE;
  },
  addFont,
  /** Names of the loaded fonts, in the order letters are looked up. */
  fonts: () => fonts.map((f) => f.name),
  shapes: {
    text: {
      string: true,
      values: { x: 0.5, y: 0.5, size: 0.1, weight: 0.12, align: 0.5, reveal: 1, spacing: 0 },
      aliases: { cx: "x", cy: "y", height: "size", thickness: "weight", progress: "reveal", letterspacing: "spacing" },
      names: { align: { left: 0, center: 0.5, middle: 0.5, right: 1 } },
      // values fixed when the program compiles, given as a name
      fixed: { font: () => fonts.map((f) => f.name) },
      check(str, fixed) {
        if (!str.trim()) return "text needs something to write between the quotes";
        const chain = chainFor(fixed.font);
        const missing = [...new Set([...prepare(str)].filter((c) => !find(c, chain)))];
        if (!missing.length) return null;
        return `text can't draw ${missing.map((c) => `'${c}'`).join(", ")} with the fonts loaded here (${fonts.map((f) => f.name).join(", ")}).` + (fonts.length === 1 ? " It draws ASCII and accented Latin letters like \xE9 \xE7 \xF1 \xFC \u0153 \u010D \u0161 \u017E \u0111; the page can add fonts with other letters, like xyt-motion/text/cyrillic." : "");
      },
      distance(str, num, add, fixed) {
        const fn = textFunction(str, fixed.font, add);
        return `${fn}(PP - vec2(${num("x")}, ${num("y")}), ${num("size")}, ${num("weight")}, ${num("align")}, ${num("reveal")}, ${num("spacing")}, ${num("blur")})`;
      },
      thickness: (str, num) => `abs(${num("weight")} * ${num("size")})`,
      // a pixel measures the strokes of the letters near it, and checks every letter's box
      cost: (str) => 2 + Math.ceil([...prepare(str)].length / 6)
    }
  }
};
var text_default = text;
/*! Hershey Roman Simplex font data, from the Hershey fonts distribution.
 * The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the
 * U. S. National Bureau of Standards.
 * The format of the Font data in this distribution was originally created by
 * James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821
 * (mit-eddie!ci-dandelion!hurt).
 */
