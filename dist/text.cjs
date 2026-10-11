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
function decode(jhf) {
  const R = 82, left = jhf.charCodeAt(0) - R, right = jhf.charCodeAt(1) - R;
  const strokes = [];
  let cur = [];
  for (let k = 2; k < jhf.length; k += 2) {
    if (jhf[k] === " " && jhf[k + 1] === "R") {
      if (cur.length) strokes.push(cur);
      cur = [];
      continue;
    }
    cur.push([jhf.charCodeAt(k) - R, jhf.charCodeAt(k + 1) - R]);
  }
  if (cur.length) strokes.push(cur);
  return { ...glyph(right - left, strokes.map((s) => s.map(([x, y]) => [x - left, y]))), center: -left };
}
function glyph(w, strokes) {
  const segs = [];
  for (const s of strokes) {
    if (s.length === 1) segs.push([...s[0], ...s[0]]);
    for (let i = 1; i < s.length; i++) segs.push([...s[i - 1], ...s[i]]);
  }
  const ys = segs.flatMap((g) => [g[1], g[3]]);
  return { w, strokes, segs, top: ys.length ? Math.min(...ys) : 0, bottom: ys.length ? Math.max(...ys) : 0 };
}
var GLYPHS = new Map(HERSHEY.map((jhf, i) => [String.fromCharCode(32 + i), decode(jhf)]));
var dot = (x, y) => [[x - 1, y], [x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]];
var ACCENTS = {
  acute: [[[-1, -7], [2, -11]]],
  grave: [[[-2, -11], [1, -7]]],
  circumflex: [[[-3, -8], [0, -11], [3, -8]]],
  caron: [[[-3, -11], [0, -8], [3, -11]]],
  diaeresis: [dot(-3, -9), dot(3, -9)],
  tilde: [[[-4, -8], [-3, -10], [-1, -10], [1, -8], [3, -8], [4, -10]]],
  ring: [[[0, -12], [-2, -11], [-2, -9], [0, -8], [2, -9], [2, -11], [0, -12]]],
  cedilla: [[[0, 9], [1, 11], [2, 12], [1, 14], [-1, 14]]]
};
var MARKS = { "\u0301": "acute", "\u0300": "grave", "\u0302": "circumflex", "\u0308": "diaeresis", "\u0303": "tilde", "\u030A": "ring", "\u0327": "cedilla", "\u030C": "caron" };
function accented(baseChar, accent) {
  const base = GLYPHS.get(baseChar);
  const lift = accent !== "cedilla" && baseChar !== baseChar.toLowerCase() ? -7 : 0;
  const strokes = baseChar === "i" ? base.strokes.filter((s) => Math.min(...s.map((p) => p[1])) > -10) : base.strokes;
  return glyph(base.w, strokes.concat(ACCENTS[accent].map((s) => s.map(([x, y]) => [x + base.center, y + lift]))));
}
function ligature(a, b, overlap) {
  const ga = GLYPHS.get(a), gb = GLYPHS.get(b), shift = ga.w - overlap;
  return glyph(ga.w + gb.w - overlap, ga.strokes.concat(gb.strokes.map((s) => s.map(([x, y]) => [x + shift, y]))));
}
for (const ch of "\xE0\xE1\xE2\xE3\xE4\xE5\xE8\xE9\xEA\xEB\xEC\xED\xEE\xEF\xF1\xF2\xF3\xF4\xF5\xF6\xF9\xFA\xFB\xFC\xFD\xFF\xE7\u010D\u0107\u0161\u017E\u0159\u011B\u0148\u0144\u015B\u017A\xC0\xC1\xC2\xC3\xC4\xC5\xC8\xC9\xCA\xCB\xCC\xCD\xCE\xCF\xD1\xD2\xD3\xD4\xD5\xD6\xD9\xDA\xDB\xDC\xDD\xC7\u010C\u0106\u0160\u017D\u0158\u011A\u0147\u0143\u015A\u0179") {
  const [base, ...marks] = ch.normalize("NFD");
  GLYPHS.set(ch, accented(base, MARKS[marks[0]]));
}
function barred(baseChar, y, from, to) {
  const base = GLYPHS.get(baseChar);
  const stems = base.segs.filter(([x0, y0, x1, y1]) => x0 === x1 && Math.min(y0, y1) === -12);
  const x = baseChar === "D" ? Math.min(...stems.map((g) => g[0])) : Math.max(...stems.map((g) => g[0]));
  return glyph(base.w, base.strokes.concat([[[x + from, y], [x + to, y]]]));
}
GLYPHS.set("\u0111", barred("d", -8, -4, 3));
GLYPHS.set("\u0110", barred("D", -1.5, -3, 5));
GLYPHS.set("\u0153", ligature("o", "e", 5));
GLYPHS.set("\u0152", ligature("O", "E", 6));
GLYPHS.set("\xE6", ligature("a", "e", 5));
GLYPHS.set("\xC6", ligature("A", "E", 5));
GLYPHS.set("\xAB", glyph(14, [[[5, -3], [1, 2], [5, 7]], [[10, -3], [6, 2], [10, 7]]]));
GLYPHS.set("\xBB", glyph(14, [[[4, -3], [8, 2], [4, 7]], [[9, -3], [13, 2], [9, 7]]]));
var SAME_AS = { "\u2019": "'", "\u2018": "'", "\u201C": '"', "\u201D": '"', "\u2013": "-", "\u2014": "-", "\u2026": "...", "\xA0": " ", "\u202F": " " };
var prepare = (str) => [...str.normalize("NFC")].map((c) => {
  var _a;
  return (_a = SAME_AS[c]) != null ? _a : c;
}).join("");
var fmt = (v) => Number.isInteger(v) ? v.toFixed(1) : String(v);
var hash = (s) => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};
function glyphFunction(ch) {
  const name = `xg_${ch.codePointAt(0)}`;
  const g = GLYPHS.get(ch);
  const lines = g.segs.map(([x0, y0, x1, y1]) => `  d = min(d, sdSeg(p, vec2(${fmt(x0)}, ${fmt(y0)}), vec2(${fmt(x1)}, ${fmt(y1)})));`);
  return [name, `float ${name}(vec2 p){ float d = 1e4;
${lines.join("\n")}
  return d; }`];
}
function textFunction(str, add) {
  const chars = [...prepare(str)];
  let x = 0, top = 0, bottom = 0;
  const parts = [];
  chars.forEach((ch, i) => {
    const g = GLYPHS.get(ch);
    if (g.segs.length) {
      const [fn, code] = glyphFunction(ch);
      add(fn, code);
      parts.push(`  { float o = ${fmt(x)} + sp * ${fmt(i)};
    if (q.x > o - pad && q.x < o + ${fmt(g.w)} + pad && q.y > ${fmt(g.top)} - pad && q.y < ${fmt(g.bottom)} + pad) d = min(d, ${fn}(q - vec2(o, 0.0))); }`);
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
${parts.join("\n")}
  return max(d - hw, q.x - (reveal * (W + 2.0 * pad) - pad)) * S; }`);
  return name;
}
var text = {
  name: "text",
  reference: `Text (the program starts with: use text):
text "Fr\xE8re Jacques" x= y= size= color=    // one line of text; x, y = its center, size = height of capitals
  align=left|center|right (default center) weight=0.12 (stroke width, relative to size) spacing=0 (extra, relative to size)
  reveal=0-1 shows it from the left, for karaoke: draw it white, then again in gold with reveal=sp. Accents work (\xE9 \xE7 \xF1 \xFC \u0153 \u010D \u0161 \u017E \u0111).
clip text "WORD" size=0.3 draws the lines inside only within the letters.`,
  shapes: {
    text: {
      string: true,
      values: { x: 0.5, y: 0.5, size: 0.1, weight: 0.12, align: 0.5, reveal: 1, spacing: 0 },
      aliases: { cx: "x", cy: "y", height: "size", thickness: "weight", progress: "reveal", letterspacing: "spacing" },
      names: { align: { left: 0, center: 0.5, middle: 0.5, right: 1 } },
      check(str) {
        if (!str.trim()) return "text needs something to write between the quotes";
        const missing = [...new Set([...prepare(str)].filter((c) => !GLYPHS.has(c)))];
        return missing.length ? `text can't draw ${missing.map((c) => `'${c}'`).join(", ")} yet; it draws ASCII letters, digits and punctuation, and accented Latin letters like \xE9 \xE8 \xE7 \xF1 \xFC \u0153 \u010D \u0107 \u0161 \u017E \u0111` : null;
      },
      distance(str, num, add) {
        const fn = textFunction(str, add);
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
