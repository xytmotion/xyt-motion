/*! xyt-motion 0.2.0 | MIT */
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

// src/index.js
var index_exports = {};
__export(index_exports, {
  BUILTINS: () => BUILTINS,
  FUNCTIONS: () => FUNCTIONS,
  NAMED_COLORS: () => NAMED_COLORS,
  Player: () => Player,
  SHAPES: () => SHAPES,
  compile: () => compile,
  defineElement: () => defineElement,
  parse: () => parse,
  reference: () => reference,
  version: () => version
});
module.exports = __toCommonJS(index_exports);

// src/util.js
var XytError = class extends Error {
  constructor(line, message) {
    super(message);
    this.line = line;
    this.xyt = true;
  }
};
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}
function suggest(word, options) {
  let best = null, bestDist = Infinity;
  for (const o of options) {
    const dist = levenshtein(word.toLowerCase(), o.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = o;
    }
  }
  const limit = Math.max(1, Math.floor(word.length / 3)) + 1;
  return best && bestDist <= limit && bestDist < word.length ? ` Did you mean '${best}'?` : "";
}
function glslName(name) {
  return name.replace(/Z/g, "Z0").replace(/_/g, "Z1");
}
function fmt(v) {
  if (!Number.isFinite(v)) return "0.0";
  let s = String(+v.toPrecision(8));
  if (!/[.e]/.test(s)) s += ".0";
  return s;
}
function parseHex(h) {
  h = String(h).replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function vec3(rgb) {
  return `vec3(${rgb.map((v) => fmt(+v.toFixed(4))).join(",")})`;
}

// src/language.js
var SHAPES = {
  circle: { cx: 0.5, cy: 0.5, r: 0.1 },
  ellipse: { cx: 0.5, cy: 0.5, rx: 0.15, ry: 0.1, angle: 0 },
  rect: { cx: 0.5, cy: 0.5, w: 0.3, h: 0.2, radius: 0, angle: 0 },
  line: { x1: 0.2, y1: 0.5, x2: 0.8, y2: 0.5, width: 0.01 },
  tri: { x1: 0.5, y1: 0.2, x2: 0.8, y2: 0.8, x3: 0.2, y3: 0.8 },
  ring: { cx: 0.5, cy: 0.5, r: 0.2, width: 0.02 },
  arc: { cx: 0.5, cy: 0.5, r: 0.2, width: 0.02, start: 180, end: 360 },
  star: { cx: 0.5, cy: 0.5, r: 0.1, inner: 0.45, points: 5, angle: 0 }
};
var COMMON = { color: null, alpha: 1, blur: 0, stroke: 0 };
var ALIASES = {
  _all: { opacity: "alpha", fill: "color", colour: "color", softness: "blur", feather: "blur", outline: "stroke" },
  circle: { radius: "r", x: "cx", y: "cy" },
  ring: { radius: "r", x: "cx", y: "cy", thickness: "width" },
  ellipse: { x: "cx", y: "cy", rotation: "angle", rotate: "angle" },
  rect: { x: "cx", y: "cy", width: "w", height: "h", rotation: "angle", rotate: "angle", corner: "radius" },
  line: { thickness: "width" },
  tri: {},
  arc: { radius: "r", x: "cx", y: "cy", thickness: "width", from: "start", to: "end" },
  star: { radius: "r", x: "cx", y: "cy", rotation: "angle", rotate: "angle", n: "points" }
};
var SHAPE_ALIASES = {
  rectangle: "rect",
  square: "rect",
  box: "rect",
  triangle: "tri",
  oval: "ellipse",
  segment: "line",
  circ: "circle"
};
var NAMED_COLORS = {
  white: "#ffffff",
  black: "#000000",
  red: "#e5322d",
  green: "#2fa84f",
  blue: "#2f6fe4",
  yellow: "#ffd23f",
  orange: "#ff8a1f",
  purple: "#8a4fd8",
  pink: "#ff7ab6",
  cyan: "#2fd3e6",
  magenta: "#e03fd0",
  gray: "#808080",
  grey: "#808080",
  navy: "#14215e",
  teal: "#178f8a",
  brown: "#7a4a26",
  gold: "#e8b923",
  sky: "#8ec9ff"
};
var BUILTINS = {
  x: "X",
  y: "Y",
  t: "T",
  p: "P",
  dur: "D",
  aspect: "ASPECT",
  beat: "BEAT",
  pulse: "PULSE",
  mx: "MX",
  my: "MY",
  pi: "3.14159265",
  tau: "6.28318531"
};
var SCENE_VALUES = ["st", "sp"];
var COMMANDS = ["xyt", "canvas", "duration", "bpm", "input", "let", "fill", "repeat", "scene", "define", "end"];
var LANGUAGE_VERSION = "0.2";
var ASPECT_NAMES = { square: 1, wide: 16 / 9, landscape: 16 / 9, tall: 9 / 16, portrait: 9 / 16, cinema: 2.39 };
var LIMITS = { repeat: 500, cost: 2e3, warnCost: 400, nameLength: 64 };
var FUNCTION_COST = { noise: [2, 2, 4], fbm: [10, 10, 20] };

// src/glsl.js
var PRELUDE = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res; uniform float u_t; uniform float u_dur; uniform vec2 u_mouse;
float X; float Y; float T; float D; float P; float PX; vec2 PP; float BEAT; float PULSE; float ASPECT; float MX; float MY;

// smoothstep that also accepts reversed edges (a > b), a common habit
float ssf(float a, float b, float v){ float k = clamp((v - a) / (b - a), 0.0, 1.0); return k*k*(3.0 - 2.0*k); }
vec3 ssf3(float a, float b, vec3 v){ vec3 k = clamp((v - a) / (b - a), 0.0, 1.0); return k*k*(3.0 - 2.0*k); }

// pow that never returns NaN: integer powers keep the sign, fractional powers of negatives give 0
float pw(float a, float b){ float e = abs(a);
  if (b == floor(b)) { if (e == 0.0) return b > 0.0 ? 0.0 : 1.0; float r = pow(e, b); if (a < 0.0 && mod(b, 2.0) == 1.0) r = -r; return r; }
  return a <= 0.0 ? 0.0 : pow(a, b); }
vec3 pw3(vec3 a, float b){ return vec3(pw(a.x, b), pw(a.y, b), pw(a.z, b)); }

// easing curves, input clamped to 0..1
float e_in(float v){ v = clamp(v, 0.0, 1.0); return v*v*v; }
float e_out(float v){ v = 1.0 - clamp(v, 0.0, 1.0); return 1.0 - v*v*v; }
float e_back(float v){ v = clamp(v, 0.0, 1.0) - 1.0; return 1.0 + 2.70158*v*v*v + 1.70158*v*v; }
float e_bounce(float v){ v = clamp(v, 0.0, 1.0);
  if (v < 0.36363636) return 7.5625*v*v;
  if (v < 0.72727273) { v -= 0.54545455; return 7.5625*v*v + 0.75; }
  if (v < 0.90909091) { v -= 0.81818182; return 7.5625*v*v + 0.9375; }
  v -= 0.95454545; return 7.5625*v*v + 0.984375; }

// sin-free hashes (stable across GPUs), value noise and fractal noise
float h11(float p){ p = fract(p*0.1031 + 0.3183); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }
float h31(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y)*p.z); }
float vn2(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float vn3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); vec3 u = f*f*(3.0 - 2.0*f);
  float a = mix(mix(h31(i), h31(i + vec3(1,0,0)), u.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), u.x), u.y);
  float b = mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), u.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), u.x), u.y);
  return mix(a, b, u.z); }
float fb2(vec2 p){ float s = 0.0; float a = 0.5; for (int k = 0; k < 5; k++) { s += a*vn2(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + 17.0; a *= 0.5; } return s / 0.96875; }
float fb3(vec3 p){ float s = 0.0; float a = 0.5; for (int k = 0; k < 5; k++) { s += a*vn3(p); p = p*2.03 + 17.0; a *= 0.5; } return s / 0.96875; }

// hue in degrees, saturation and lightness 0..1
vec3 hsl(float h, float s, float l){ s = clamp(s, 0.0, 1.0); l = clamp(l, 0.0, 1.0);
  vec3 k = clamp(abs(mod(h/60.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s*(k - 0.5)*(1.0 - abs(2.0*l - 1.0)); }

// rotate the sampling point so the shape turns clockwise on screen (y points down)
vec2 rot(vec2 p, float deg){ float a = radians(deg); float c = cos(a); float s = sin(a); return vec2(c*p.x + s*p.y, -s*p.x + c*p.y); }

float sdBox(vec2 p, vec2 b, float r, float deg){ p = rot(p, deg); b = abs(b); r = clamp(r, 0.0, min(b.x, b.y));
  vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a; vec2 ba = b - a; float h = clamp(dot(pa, ba)/max(dot(ba, ba), 1e-8), 0.0, 1.0); return length(pa - ba*h); }
// ellipse; very flat ones (a closing eye) use an exact segment, since the fast formula breaks down
float sdEll(vec2 p, vec2 r, float deg){ p = rot(p, deg); r = abs(r);
  float m = min(r.x, r.y);
  if (m < 1e-3) { vec2 h = r.x > r.y ? vec2(r.x, 0.0) : vec2(0.0, r.y); return sdSeg(p, -h, h) - m; }
  float k0 = length(p/r); float k1 = length(p/(r*r)); return k0 < 1e-6 ? -m : k0*(k0 - 1.0)/k1; }
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2){
  vec2 e0 = p1 - p0; vec2 e1 = p2 - p1; vec2 e2 = p0 - p2; vec2 v0 = p - p0; vec2 v1 = p - p1; vec2 v2 = p - p2;
  vec2 q0 = v0 - e0*clamp(dot(v0, e0)/max(dot(e0, e0), 1e-8), 0.0, 1.0);
  vec2 q1 = v1 - e1*clamp(dot(v1, e1)/max(dot(e1, e1), 1e-8), 0.0, 1.0);
  vec2 q2 = v2 - e2*clamp(dot(v2, e2)/max(dot(e2, e2), 1e-8), 0.0, 1.0);
  float s = sign(e0.x*e2.y - e0.y*e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s*(v0.x*e0.y - v0.y*e0.x)), vec2(dot(q1, q1), s*(v1.x*e1.y - v1.y*e1.x))), vec2(dot(q2, q2), s*(v2.x*e2.y - v2.y*e2.x)));
  return -sqrt(d.x)*sign(d.y); }
// arc from angle a0 to a1 in degrees: 0 = right, 90 = down
float sdArc(vec2 p, float r, float w, float a0, float a1){ float sw = clamp(a1 - a0, 0.0, 360.0);
  float rel = mod(degrees(atan(p.y, p.x)) - a0, 360.0);
  if (rel <= sw) return abs(length(p) - r) - w*0.5;
  vec2 e0 = r*vec2(cos(radians(a0)), sin(radians(a0))); vec2 e1 = r*vec2(cos(radians(a0 + sw)), sin(radians(a0 + sw)));
  return min(length(p - e0), length(p - e1)) - w*0.5; }
// n-pointed star, one point straight up at angle 0; k = inner radius / outer radius
float sdStar(vec2 p, float r, float k, float n, float deg){ p = rot(p, deg);
  n = max(floor(n + 0.5), 2.0); k = clamp(k, 0.05, 1.0);
  float an = 3.14159265 / n; float a = atan(p.x, -p.y);
  float b = mod(a + an, 2.0*an) - an;
  vec2 q = length(p)*vec2(abs(sin(b)), cos(b));
  vec2 A = vec2(0.0, r); vec2 B = r*k*vec2(sin(an), cos(an));
  vec2 pa = q - A; vec2 ba = B - A; float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba*h);
  return (ba.x*pa.y - ba.y*pa.x) < 0.0 ? -d : d; }
`;

// src/parser.js
function lexLine(src, line) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "	" || c === "\r") {
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") break;
    if (c === "#") {
      const m = /^#([0-9a-fA-F]+)(?![0-9a-zA-Z_])/.exec(src.slice(i));
      if (m && toks.length > 0) {
        const h = m[1];
        if (h.length === 3 || h.length === 6) {
          toks.push({ k: "col", v: h });
          i += m[0].length;
          continue;
        }
        if (h.length === 4 || h.length === 8) {
          const n = h.length / 4, alpha = parseInt(h.slice(3 * n), 16) / (n === 1 ? 15 : 255);
          throw new XytError(line, `'#${h}' has a transparency part, but colors are #rgb or #rrggbb; write #${h.slice(0, 3 * n)} and alpha=${+alpha.toFixed(2)} instead`);
        }
      }
      break;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(src.slice(i));
      if (!m) throw new XytError(line, `unexpected '${c}'`);
      toks.push({ k: "num", v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (m[0].length > LIMITS.nameLength) throw new XytError(line, `the name '${m[0].slice(0, 16)}...' is too long; names can be up to ${LIMITS.nameLength} characters`);
      toks.push({ k: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if ([">=", "<=", "==", "!=", "&&", "||"].includes(two)) {
      toks.push({ k: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/%^(),=<>:".includes(c)) {
      toks.push({ k: "op", v: c });
      i++;
      continue;
    }
    throw new XytError(line, `unexpected character '${c}'`);
  }
  return toks;
}
var tokStr = (k) => k.k === "col" ? "#" + k.v : String(k.v);
var BINARY = { "||": 1, "&&": 2, "<": 3, ">": 3, "<=": 3, ">=": 3, "==": 3, "!=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5, "^": 7 };
var UNARY_PREC = 6;
var Cursor = class {
  constructor(toks, line) {
    this.t = toks;
    this.i = 0;
    this.line = line;
  }
  peek(o = 0) {
    return this.t[this.i + o];
  }
  next() {
    return this.t[this.i++];
  }
  atEnd() {
    return this.i >= this.t.length;
  }
  isOp(v, o = 0) {
    const k = this.peek(o);
    return !!k && k.k === "op" && k.v === v;
  }
  expect(v) {
    if (!this.isOp(v)) {
      const k = this.peek();
      throw new XytError(this.line, `expected '${v}'` + (k ? ` but found '${tokStr(k)}'` : " before the end of the line"));
    }
    this.i++;
  }
  isNamedValue() {
    const k = this.peek();
    return !!k && k.k === "id" && this.isOp("=", 1);
  }
};
function parseExpr(c, minPrec = 0) {
  let left = parseUnary(c);
  for (; ; ) {
    const k = c.peek();
    if (!k || k.k !== "op" || !(k.v in BINARY)) break;
    const prec = BINARY[k.v];
    if (prec < minPrec) break;
    c.next();
    const right = parseExpr(c, k.v === "^" ? prec : prec + 1);
    left = { t: "bin", op: k.v, a: left, b: right };
  }
  return left;
}
function parseUnary(c) {
  if (c.isOp("-")) {
    c.next();
    return { t: "neg", a: parseExpr(c, UNARY_PREC) };
  }
  if (c.isOp("+")) {
    c.next();
    return parseExpr(c, UNARY_PREC);
  }
  return parsePrimary(c);
}
function parsePrimary(c) {
  const k = c.next();
  if (!k) throw new XytError(c.line, "expected a value before the end of the line");
  if (k.k === "num") return { t: "num", v: k.v };
  if (k.k === "col") return { t: "hex", v: k.v };
  if (k.k === "id") {
    if (c.isOp("(")) {
      c.next();
      const args = [];
      if (!c.isOp(")")) {
        for (; ; ) {
          args.push(parseExpr(c, 0));
          if (c.isOp(",")) {
            c.next();
            continue;
          }
          break;
        }
      }
      c.expect(")");
      return { t: "call", fn: k.v, args };
    }
    return { t: "var", name: k.v };
  }
  if (k.k === "op" && k.v === "(") {
    const e = parseExpr(c, 0);
    c.expect(")");
    return e;
  }
  throw new XytError(c.line, `expected a value but found '${tokStr(k)}'`);
}
function parseNamed(c, what) {
  const attrs = {};
  while (!c.atEnd()) {
    if (!c.isNamedValue()) {
      throw new XytError(c.line, `${what} takes named values like ${what === "fill" ? "alpha=0.5" : "color=red"}; found '${tokStr(c.peek())}'`);
    }
    const name = c.next().v;
    c.next();
    if (attrs[name]) throw new XytError(c.line, `'${name}' is given twice`);
    attrs[name] = parseExpr(c, 0);
  }
  return attrs;
}
function constNumber(c, what) {
  let sign = 1;
  if (c.isOp("-")) {
    c.next();
    sign = -1;
  }
  const k = c.next();
  if (!k || k.k !== "num") throw new XytError(c.line, `${what} needs a plain number`);
  return sign * k.v;
}
function constValue(c, line, name) {
  if (c.isOp("-")) {
    c.next();
    const k = c.next();
    if (k && k.k === "num") return { kind: "num", value: -k.v };
  } else {
    const k = c.next();
    if (k && k.k === "num") return { kind: "num", value: k.v };
    if (k && k.k === "col") return { kind: "col", value: parseHex(k.v) };
    if (k && k.k === "id" && NAMED_COLORS[k.v]) return { kind: "col", value: parseHex(NAMED_COLORS[k.v]) };
  }
  throw new XytError(line, `input ${name} needs a starting value that is a plain number or color, like: input ${name} = 0.5`);
}
function parse(src) {
  const lines = String(src).split("\n");
  const root = { k: "root", body: [] };
  const stack = [root];
  const program = {
    version: null,
    aspect: 1,
    aspectLabel: "1:1",
    duration: null,
    bpm: 120,
    offset: 0,
    inputs: [],
    body: root.body,
    errors: [],
    defines: /* @__PURE__ */ new Set()
  };
  const topLevelOnly = (cmd, line) => {
    if (stack.length > 1) throw new XytError(line, `${cmd} must be at the top level, not inside a ${stack[stack.length - 1].k}`);
  };
  for (let li = 0; li < lines.length; li++) {
    const line = li + 1;
    try {
      const toks = lexLine(lines[li], line);
      if (!toks.length) continue;
      const head = toks[0];
      if (head.k !== "id") throw new XytError(line, "each line starts with a command like fill, circle, rect, let or repeat");
      const c = new Cursor(toks, line);
      c.i = 1;
      const cmd = head.v;
      const body = stack[stack.length - 1].body;
      const done = (what) => {
        if (!c.atEnd()) throw new XytError(line, `unexpected '${tokStr(c.peek())}' after ${what}`);
      };
      switch (cmd) {
        case "xyt": {
          topLevelOnly(cmd, line);
          const m = /^\s*xyt\s+(\d+)\.(\d+)\s*(\/\/.*)?$/.exec(lines[li]);
          if (!m) throw new XytError(line, `xyt needs the language version the program is written for, like: xyt ${LANGUAGE_VERSION}`);
          const [major, minor] = LANGUAGE_VERSION.split(".").map(Number);
          if (+m[1] > major || +m[1] === major && +m[2] > minor) {
            throw new XytError(line, `this program is written for XYT ${m[1]}.${m[2]}, newer than this library (XYT ${LANGUAGE_VERSION}); update xyt-motion`);
          }
          program.version = `${m[1]}.${m[2]}`;
          break;
        }
        case "canvas": {
          topLevelOnly(cmd, line);
          let aspect, label;
          const k = c.peek();
          if (k && k.k === "id" && ASPECT_NAMES[k.v]) {
            c.next();
            aspect = ASPECT_NAMES[k.v];
            label = k.v;
          } else {
            const a = constNumber(c, "canvas");
            if (c.isOp(":")) {
              c.next();
              const b = constNumber(c, "canvas");
              aspect = a / b;
              label = `${a}:${b}`;
            } else if (!c.atEnd()) {
              const b = constNumber(c, "canvas");
              aspect = a / b;
              label = `${a}x${b}`;
            } else {
              aspect = a;
              label = String(a);
            }
          }
          done("the canvas shape");
          if (!(aspect >= 0.2 && aspect <= 5)) throw new XytError(line, "canvas shape must be between 1:5 and 5:1, like: canvas 16:9");
          program.aspect = aspect;
          program.aspectLabel = label;
          break;
        }
        case "duration": {
          topLevelOnly(cmd, line);
          const v = constNumber(c, "duration");
          if (v <= 0) throw new XytError(line, "duration needs a positive number of seconds, like: duration 4");
          done("the duration");
          program.duration = Math.min(v, 3600);
          break;
        }
        case "bpm": {
          topLevelOnly(cmd, line);
          const v = constNumber(c, "bpm");
          if (v <= 0 || v > 600) throw new XytError(line, "bpm needs a tempo between 1 and 600, like: bpm 120");
          program.bpm = v;
          const opts = parseNamed(c, "bpm");
          for (const n of Object.keys(opts)) {
            if (n !== "offset") throw new XytError(line, `bpm has no '${n}'. It takes: offset (seconds before the first beat)`);
            if (opts.offset.t !== "num" && !(opts.offset.t === "neg" && opts.offset.a.t === "num"))
              throw new XytError(line, "bpm offset needs a plain number of seconds");
            program.offset = opts.offset.t === "num" ? opts.offset.v : -opts.offset.a.v;
          }
          break;
        }
        case "input": {
          topLevelOnly(cmd, line);
          const n = c.next();
          if (!n || n.k !== "id") throw new XytError(line, "input needs a name and a starting value: input speed = 1");
          c.expect("=");
          const v = constValue(c, line, n.v);
          const input = { name: n.v, kind: v.kind, value: v.value, min: null, max: null, line };
          const opts = parseNamed(c, "input");
          for (const o of Object.keys(opts)) {
            if (o !== "min" && o !== "max") throw new XytError(line, `input has no '${o}'. It takes: min, max`);
            const e = opts[o];
            const val = e.t === "num" ? e.v : e.t === "neg" && e.a.t === "num" ? -e.a.v : null;
            if (val === null) throw new XytError(line, `input ${o} needs a plain number`);
            input[o] = val;
          }
          if (program.inputs.some((x) => x.name === n.v)) throw new XytError(line, `input '${n.v}' is declared twice`);
          program.inputs.push(input);
          break;
        }
        case "let": {
          const n = c.next();
          if (!n || n.k !== "id") throw new XytError(line, "let needs a name: let speed = 2");
          c.expect("=");
          const expr = parseExpr(c, 0);
          done("the value");
          body.push({ k: "let", name: n.v, expr, line });
          break;
        }
        case "repeat": {
          const n = c.next(), cnt = c.next();
          if (!n || n.k !== "id" || !cnt || cnt.k !== "num" || cnt.v < 1 || cnt.v !== Math.floor(cnt.v))
            throw new XytError(line, "repeat needs a name and a whole count: repeat i 12");
          done("the count");
          const blk = { k: "repeat", name: n.v, count: cnt.v, body: [], line };
          body.push(blk);
          stack.push(blk);
          break;
        }
        case "scene": {
          if (stack.length > 1) throw new XytError(line, `a scene can't go inside a ${stack[stack.length - 1].k}; close it with 'end' first`);
          const a = constNumber(c, "scene"), b = constNumber(c, "scene");
          if (!(b > a)) throw new XytError(line, "scene needs a start and an end time in seconds, end after start: scene 6 12");
          const opts = parseNamed(c, "scene");
          const blk = { k: "scene", start: a, end: b, fadein: 0, fadeout: 0, body: [], line };
          for (const o of Object.keys(opts)) {
            if (!["fade", "fadein", "fadeout"].includes(o)) throw new XytError(line, `scene has no '${o}'.` + suggest(o, ["fade", "fadein", "fadeout"]) + " It takes: fade, fadein, fadeout");
            if (opts[o].t !== "num") throw new XytError(line, `scene ${o} needs a plain number of seconds`);
          }
          if (opts.fade) blk.fadein = blk.fadeout = opts.fade.v;
          if (opts.fadein) blk.fadein = opts.fadein.v;
          if (opts.fadeout) blk.fadeout = opts.fadeout.v;
          body.push(blk);
          stack.push(blk);
          break;
        }
        case "define": {
          topLevelOnly(cmd, line);
          const n = c.next();
          if (!n || n.k !== "id") throw new XytError(line, "define needs a name and its values: define bird cx=0.5 cy=0.5 s=1");
          if (COMMANDS.includes(n.v) || SHAPES[n.v] || SHAPE_ALIASES[n.v] || BUILTINS[n.v] || NAMED_COLORS[n.v] || n.v === "background" || n.v === "bg")
            throw new XytError(line, `'${n.v}' is a built-in name; pick another name`);
          if (program.defines.has(n.v)) throw new XytError(line, `'${n.v}' is defined twice`);
          const params = parseNamed(c, "define");
          const blk = { k: "define", name: n.v, params, body: [], line };
          program.defines.add(n.v);
          body.push(blk);
          stack.push(blk);
          break;
        }
        case "end": {
          if (stack.length === 1) throw new XytError(line, "'end' without a matching repeat, scene or define");
          done("'end'");
          stack.pop();
          break;
        }
        case "fill":
        case "background":
        case "bg": {
          let color = null;
          if (!c.atEnd() && !c.isNamedValue()) color = parseExpr(c, 0);
          const attrs = parseNamed(c, "fill");
          if (color && attrs.color) throw new XytError(line, "fill got two colors");
          body.push({ k: "fill", color: color || attrs.color || null, attrs, line });
          break;
        }
        default: {
          if (SHAPES[cmd] || SHAPE_ALIASES[cmd]) {
            const type = SHAPES[cmd] ? cmd : SHAPE_ALIASES[cmd];
            body.push({ k: "shape", type, attrs: parseNamed(c, type), line });
          } else if (program.defines.has(cmd)) {
            body.push({ k: "call", name: cmd, attrs: parseNamed(c, cmd), line });
          } else {
            const definedLater = lines.slice(li + 1).some((l) => new RegExp(`^\\s*define\\s+${cmd}\\b`).test(l));
            if (definedLater) throw new XytError(line, `'${cmd}' is defined further down; move its define block above this line`);
            const known = COMMANDS.concat(Object.keys(SHAPES), [...program.defines]);
            throw new XytError(line, `unknown command '${cmd}'.` + suggest(cmd, known) + ` Commands: ${COMMANDS.join(", ")}; shapes: ${Object.keys(SHAPES).join(", ")}` + (program.defines.size ? `; defined: ${[...program.defines].join(", ")}` : ""));
          }
        }
      }
    } catch (e) {
      if (e.xyt) program.errors.push(e);
      else throw e;
    }
  }
  if (stack.length > 1) {
    const b = stack[stack.length - 1];
    program.errors.push(new XytError(b.line, `this ${b.k} has no matching 'end'`));
  }
  if (program.duration === null) {
    const ends = root.body.filter((b) => b.k === "scene").map((b) => b.end);
    program.duration = ends.length ? Math.max(...ends) : 4;
  }
  return program;
}

// src/compiler.js
var UNARY = ["sin", "cos", "tan", "asin", "acos", "abs", "floor", "ceil", "fract", "exp", "sign"];
var FUNCTIONS = UNARY.concat([
  "sqrt",
  "log",
  "round",
  "atan",
  "atan2",
  "pow",
  "min",
  "max",
  "mod",
  "clamp",
  "saturate",
  "mix",
  "lerp",
  "smoothstep",
  "step",
  "dist",
  "rgb",
  "gray",
  "hsl",
  "noise",
  "fbm",
  "hash",
  "ease",
  "easein",
  "easeout",
  "backout",
  "bounce",
  "pingpong",
  "keys"
]);
var asCol = (r) => r.t === "col" ? r.c : `vec3(${r.c})`;
var Scope = class {
  constructor(parent = null, context = null) {
    this.vars = /* @__PURE__ */ new Map();
    this.parent = parent;
    this.context = context || parent && parent.context;
  }
  get(n) {
    return this.vars.get(n) || (this.parent ? this.parent.get(n) : null);
  }
  names() {
    return [...this.vars.keys()].concat(this.parent ? this.parent.names() : []);
  }
};
function reservedReason(name, defines) {
  if (BUILTINS[name]) return "a built-in value";
  if (COMMANDS.includes(name) || SHAPES[name]) return "a command";
  if (SCENE_VALUES.includes(name)) return "a scene value";
  if (defines && defines.has(name)) return "a define";
  return null;
}
var Compiler = class {
  constructor(program) {
    this.program = program;
    this.uid = 0;
    this.out = [];
    this.funcs = [];
    this.defs = /* @__PURE__ */ new Map();
    this.errors = [];
    this.inDefine = null;
    this.draws = 0;
    this.work = 0;
  }
  error(line, msg) {
    return new XytError(line, msg);
  }
  checkName(name, line, what) {
    const why = reservedReason(name, this.program.defines);
    if (why) throw this.error(line, `'${name}' is ${why}; pick another name for this ${what}`);
  }
  // ---------- expressions ----------
  ex(n, sc, line) {
    const E = (m) => this.error(line, m);
    switch (n.t) {
      case "num":
        return { c: fmt(n.v), t: "num" };
      case "hex":
        return { c: vec3(parseHex(n.v)), t: "col" };
      case "var": {
        const v = sc.get(n.name);
        if (v) return v;
        if (BUILTINS[n.name]) return { c: BUILTINS[n.name], t: "num" };
        if (NAMED_COLORS[n.name]) return { c: vec3(parseHex(NAMED_COLORS[n.name])), t: "col" };
        if (FUNCTIONS.includes(n.name)) throw E(`${n.name} is a function: write ${n.name}(...)`);
        if (SCENE_VALUES.includes(n.name)) {
          throw E(this.inDefine ? `'${n.name}' is not available inside define ${this.inDefine}; pass it in as a value` : `'${n.name}' only exists inside a scene block`);
        }
        const known = sc.names().concat(Object.keys(BUILTINS), Object.keys(NAMED_COLORS));
        const hint = this.inDefine ? ` Inside define ${this.inDefine}, only its own values, inputs and built-ins exist; pass other values in.` : " Define it first with let.";
        throw E(`unknown name '${n.name}'.` + suggest(n.name, known) + hint);
      }
      case "neg": {
        const a = this.ex(n.a, sc, line);
        return { c: `(-${a.c})`, t: a.t };
      }
      case "bin": {
        const a = this.ex(n.a, sc, line), b = this.ex(n.b, sc, line);
        const anyCol = a.t === "col" || b.t === "col";
        if (["<", ">", "<=", ">=", "==", "!="].includes(n.op)) {
          if (anyCol) throw E(`'${n.op}' compares numbers, not colors`);
          return { c: `(${a.c} ${n.op} ${b.c} ? 1.0 : 0.0)`, t: "num" };
        }
        if (n.op === "&&" || n.op === "||") {
          if (anyCol) throw E(`'${n.op}' combines conditions (numbers), not colors`);
          return { c: `((${a.c} != 0.0) ${n.op} (${b.c} != 0.0) ? 1.0 : 0.0)`, t: "num" };
        }
        if (n.op === "^") {
          if (b.t === "col") throw E("the power after ^ must be a number");
          return a.t === "col" ? { c: `pw3(${a.c},${b.c})`, t: "col" } : { c: `pw(${a.c},${b.c})`, t: "num" };
        }
        if (n.op === "%") {
          if (b.t === "col" && a.t !== "col") throw E("'%' needs a number on the right");
          return { c: `mod(${a.c},${b.c})`, t: a.t };
        }
        return { c: `(${a.c} ${n.op} ${b.c})`, t: anyCol ? "col" : "num" };
      }
      case "call":
        return this.call(n, sc, line);
    }
    throw E("this value could not be understood");
  }
  call(n, sc, line) {
    const E = (m) => this.error(line, m);
    const fn = n.fn;
    if (!FUNCTIONS.includes(fn)) {
      if (this.program.defines.has(fn)) throw E(`${fn} is a define: draw it on its own line, like: ${fn} cx=0.5`);
      throw E(`unknown function '${fn}'.` + suggest(fn, FUNCTIONS));
    }
    const args = n.args.map((a) => this.ex(a, sc, line));
    const count = (lo, hi = lo) => {
      if (args.length < lo || args.length > hi) {
        throw E(`${fn}() takes ${lo === hi ? lo : lo + " to " + hi} value${hi === 1 ? "" : "s"}, got ${args.length}`);
      }
    };
    const nums = () => args.forEach((a, i) => {
      if (a.t !== "num") throw E(`${fn}() value ${i + 1} must be a number, not a color`);
    });
    const anyCol = () => args.some((a) => a.t === "col");
    const c = (i) => args[i].c;
    if (UNARY.includes(fn)) {
      count(1);
      return { c: `${fn}(${c(0)})`, t: args[0].t };
    }
    switch (fn) {
      case "round":
        count(1);
        return { c: `floor(${c(0)}+0.5)`, t: args[0].t };
      case "sqrt":
        count(1);
        return { c: `sqrt(max(${c(0)},0.0))`, t: args[0].t };
      case "log":
        count(1);
        return { c: `log(max(${c(0)},1e-9))`, t: args[0].t };
      case "atan":
        count(1, 2);
        nums();
        return { c: `atan(${args.map((a) => a.c).join(",")})`, t: "num" };
      case "atan2":
        count(2);
        nums();
        return { c: `atan(${c(0)},${c(1)})`, t: "num" };
      case "pow":
        count(2);
        if (args[1].t === "col") throw E("pow() power must be a number");
        return args[0].t === "col" ? { c: `pw3(${c(0)},${c(1)})`, t: "col" } : { c: `pw(${c(0)},${c(1)})`, t: "num" };
      case "min":
      case "max":
      case "mod":
        count(2);
        if (anyCol()) return { c: `${fn}(${asCol(args[0])},${asCol(args[1])})`, t: "col" };
        return { c: `${fn}(${c(0)},${c(1)})`, t: "num" };
      case "saturate":
        count(1);
        return { c: `clamp(${c(0)},0.0,1.0)`, t: args[0].t };
      case "clamp":
        count(1, 3);
        if (args.length === 2) throw E("clamp() takes clamp(v) for 0 to 1, or clamp(v, low, high)");
        if (args.length === 1) return { c: `clamp(${c(0)},0.0,1.0)`, t: args[0].t };
        if (args[0].t === "num" && (args[1].t === "col" || args[2].t === "col")) throw E("clamp() limits must be numbers");
        if (args[1].t !== args[2].t) return { c: `clamp(${c(0)},${asCol(args[1])},${asCol(args[2])})`, t: "col" };
        return { c: `clamp(${c(0)},${c(1)},${c(2)})`, t: args[0].t };
      case "mix":
      case "lerp":
        count(3);
        if (anyCol()) return { c: `mix(${asCol(args[0])},${asCol(args[1])},${c(2)})`, t: "col" };
        return { c: `mix(${c(0)},${c(1)},${c(2)})`, t: "num" };
      case "smoothstep":
        count(3);
        if (args[0].t === "col" || args[1].t === "col") throw E("smoothstep() edges must be numbers");
        return args[2].t === "col" ? { c: `ssf3(${c(0)},${c(1)},${c(2)})`, t: "col" } : { c: `ssf(${c(0)},${c(1)},${c(2)})`, t: "num" };
      case "step":
        count(2);
        if (args[0].t === "col") throw E("step() edge must be a number");
        return { c: `step(${c(0)},${c(1)})`, t: args[1].t };
      case "dist":
        if (args.length === 2) {
          nums();
          return { c: `length(vec2(${c(0)},${c(1)}))`, t: "num" };
        }
        count(4);
        nums();
        return { c: `distance(vec2(${c(0)},${c(1)}),vec2(${c(2)},${c(3)}))`, t: "num" };
      case "rgb":
        count(3);
        nums();
        return { c: `vec3(${c(0)},${c(1)},${c(2)})`, t: "col" };
      case "gray":
        count(1);
        nums();
        return { c: `vec3(${c(0)})`, t: "col" };
      case "hsl":
        count(3);
        nums();
        return { c: `hsl(${c(0)},${c(1)},${c(2)})`, t: "col" };
      case "noise":
      case "fbm": {
        count(1, 3);
        nums();
        this.work += FUNCTION_COST[fn][args.length - 1];
        const f = fn === "noise" ? "vn" : "fb";
        if (args.length === 3) return { c: `${f}3(vec3(${c(0)},${c(1)},${c(2)}))`, t: "num" };
        return { c: `${f}2(vec2(${c(0)},${args.length > 1 ? c(1) : "0.0"}))`, t: "num" };
      }
      case "hash":
        count(1, 2);
        nums();
        return args.length === 1 ? { c: `h11(${c(0)})`, t: "num" } : { c: `h21(vec2(${c(0)},${c(1)}))`, t: "num" };
      case "ease":
        count(1);
        nums();
        return { c: `ssf(0.0,1.0,${c(0)})`, t: "num" };
      case "easein":
        count(1);
        nums();
        return { c: `e_in(${c(0)})`, t: "num" };
      case "easeout":
        count(1);
        nums();
        return { c: `e_out(${c(0)})`, t: "num" };
      case "backout":
        count(1);
        nums();
        return { c: `e_back(${c(0)})`, t: "num" };
      case "bounce":
        count(1);
        nums();
        return { c: `e_bounce(${c(0)})`, t: "num" };
      case "pingpong":
        count(1);
        nums();
        return { c: `(1.0-abs(fract(${c(0)})*2.0-1.0))`, t: "num" };
      case "keys": {
        if (args.length < 5 || (args.length - 1) % 2 !== 0) {
          throw E("keys() takes a time, then pairs of key time and value: keys(t, 0, 0.2, 1.5, 0.8, 3, 0.2)");
        }
        if (args[0].t !== "num") throw E("keys() first value must be the time, a number");
        const pairs = [];
        for (let i = 1; i < args.length; i += 2) {
          if (args[i].t !== "num") throw E(`keys() value ${i + 1} is a key time and must be a number`);
          pairs.push([args[i], args[i + 1]]);
        }
        const col = pairs.some(([, v]) => v.t === "col");
        const val = (v) => col ? asCol(v) : v.c;
        let r = val(pairs[0][1]);
        for (let i = 1; i < pairs.length; i++) {
          r = `mix(${r},${val(pairs[i][1])},ssf(${pairs[i - 1][0].c},${pairs[i][0].c},${c(0)}))`;
        }
        return { c: r, t: col ? "col" : "num" };
      }
    }
    throw E(`unknown function '${fn}'`);
  }
  // ---------- statements; each returns its cost (shape evaluations per pixel) ----------
  stmts(list, sc, ind) {
    let cost = 0, sceneMax = 0;
    for (const s of list) {
      try {
        const work = this.work;
        let k = this.stmt(s, sc, ind);
        if (s.k !== "repeat" && s.k !== "scene" && s.k !== "define") k += this.work - work;
        if (s.k === "scene") sceneMax = Math.max(sceneMax, k);
        else cost += k;
      } catch (e) {
        if (!e.xyt) throw e;
        this.errors.push(e);
        if (s.k === "let" && !sc.vars.has(s.name)) sc.vars.set(s.name, { c: "0.0", t: "num" });
      }
      if (this.errors.length > 20) break;
    }
    return cost + sceneMax;
  }
  stmt(s, sc, ind) {
    const E = (m) => this.error(s.line, m);
    const o = this.out;
    switch (s.k) {
      case "let": {
        this.checkName(s.name, s.line, "value");
        const r = this.ex(s.expr, sc, s.line);
        const g = `v_${glslName(s.name)}_${++this.uid}`;
        o.push(`${ind}${r.t === "col" ? "vec3" : "float"} ${g} = ${r.c};`);
        sc.vars.set(s.name, { c: g, t: r.t });
        return 0;
      }
      case "repeat": {
        this.checkName(s.name, s.line, "loop counter");
        if (s.count > LIMITS.repeat) throw E(`repeat counts up to ${LIMITS.repeat}; use a smaller count`);
        const id = ++this.uid, g = `v_${glslName(s.name)}_${id}`;
        o.push(`${ind}for (int k_${id} = 0; k_${id} < ${s.count}; k_${id}++) { float ${g} = float(k_${id});`);
        const inner = new Scope(sc);
        inner.vars.set(s.name, { c: g, t: "num" });
        const cost = this.stmts(s.body, inner, ind + "  ");
        o.push(`${ind}}`);
        return cost * s.count;
      }
      case "scene": {
        const id = ++this.uid, a = fmt(s.start), b = fmt(s.end);
        o.push(`${ind}if (T >= ${a} && T < ${b}) { vec3 sv_${id} = col;`);
        o.push(`${ind}  float v_st_${id} = T - ${a}; float v_sp_${id} = v_st_${id} / ${fmt(s.end - s.start)};`);
        const inner = new Scope(sc);
        inner.vars.set("st", { c: `v_st_${id}`, t: "num" });
        inner.vars.set("sp", { c: `v_sp_${id}`, t: "num" });
        const cost = this.stmts(s.body, inner, ind + "  ");
        let fade = "";
        if (s.fadein > 0) fade += ` * clamp(v_st_${id} / ${fmt(s.fadein)}, 0.0, 1.0)`;
        if (s.fadeout > 0) fade += ` * clamp((${b} - T) / ${fmt(s.fadeout)}, 0.0, 1.0)`;
        if (fade) o.push(`${ind}  col = mix(sv_${id}, col, 1.0${fade});`);
        o.push(`${ind}}`);
        return cost;
      }
      case "define":
        return this.define(s, sc);
      case "call": {
        if (s.name === this.inDefine) throw E(`'${s.name}' can't be used inside its own define`);
        const d = this.defs.get(s.name);
        if (!d) throw E(`'${s.name}' can't be drawn because its define has a problem`);
        const names = d.params.map((q) => q.name);
        for (const a of Object.keys(s.attrs)) {
          if (!names.includes(a)) throw E(`${s.name} has no '${a}'.` + suggest(a, names) + ` It takes: ${names.join(", ")}`);
        }
        const args = d.params.map((q) => {
          if (!s.attrs[q.name]) return q.def;
          const r = this.ex(s.attrs[q.name], sc, s.line);
          if (q.t === "num" && r.t === "col") throw E(`'${q.name}' must be a number, not a color`);
          return q.t === "col" ? asCol(r) : r.c;
        });
        o.push(`${ind}col = ${d.fname}(col${args.map((a) => ", " + a).join("")});`);
        this.draws++;
        return d.cost;
      }
      case "fill":
        return this.fill(s, sc, ind);
      case "shape":
        return this.shape(s, sc, ind);
    }
    throw E("this line could not be understood");
  }
  define(s, sc) {
    const E = (m) => this.error(s.line, m);
    const params = [];
    for (const pn of Object.keys(s.params)) {
      this.checkName(pn, s.line, "value");
      const r = this.ex(s.params[pn], sc.root, s.line);
      params.push({ name: pn, t: r.t, def: r.c });
    }
    const fname = `f_${glslName(s.name)}`;
    const body = new Scope(sc.root);
    for (const q of params) body.vars.set(q.name, { c: `a_${glslName(q.name)}`, t: q.t });
    const saved = this.out;
    this.out = [];
    this.inDefine = s.name;
    let cost;
    try {
      cost = this.stmts(s.body, body, "  ");
    } finally {
      this.inDefine = null;
    }
    const code = this.out;
    this.out = saved;
    this.funcs.push(`vec3 ${fname}(vec3 col${params.map((q) => `, ${q.t === "col" ? "vec3" : "float"} a_${glslName(q.name)}`).join("")}) {
${code.join("\n")}
  return col;
}`);
    this.defs.set(s.name, { fname, params, cost });
    if (!s.body.length) throw E(`define ${s.name} is empty; put shapes between it and 'end'`);
    return 0;
  }
  fill(s, sc, ind) {
    const E = (m) => this.error(s.line, m);
    for (const a of Object.keys(s.attrs)) {
      if (a !== "alpha" && a !== "color" && a !== "opacity") throw E(`fill has no '${a}'.` + suggest(a, ["alpha", "color"]) + " It takes: color, alpha");
    }
    if (!s.color) throw E("fill needs a color, like: fill #102030");
    if (!this.inDefine) this.draws++;
    const color = asCol(this.ex(s.color, sc, s.line));
    const alphaExpr = s.attrs.alpha || s.attrs.opacity;
    if (alphaExpr) {
      const a = this.ex(alphaExpr, sc, s.line);
      if (a.t === "col") throw E("'alpha' must be a number, not a color");
      this.out.push(`${ind}col = mix(col, ${color}, clamp(${a.c},0.0,1.0));`);
    } else {
      this.out.push(`${ind}col = ${color};`);
    }
    return 1;
  }
  shape(s, sc, ind) {
    const E = (m) => this.error(s.line, m);
    const allowed = Object.assign({}, SHAPES[s.type], COMMON);
    const aliases = Object.assign({}, ALIASES._all, ALIASES[s.type]);
    const v = {};
    for (const raw of Object.keys(s.attrs)) {
      const name = Object.prototype.hasOwnProperty.call(allowed, raw) ? raw : aliases[raw];
      if (!name || !Object.prototype.hasOwnProperty.call(allowed, name)) {
        throw E(`${s.type} has no '${raw}'.` + suggest(raw, Object.keys(allowed)) + ` It takes: ${Object.keys(allowed).join(", ")}`);
      }
      if (v[name]) throw E(`'${name}' is given twice`);
      v[name] = this.ex(s.attrs[raw], sc, s.line);
      if (name !== "color" && v[name].t === "col") throw E(`'${raw}' must be a number, not a color`);
    }
    if (!this.inDefine) this.draws++;
    const num = (k) => v[k] ? `(${v[k].c})` : fmt(allowed[k]);
    const color = v.color ? asCol(v.color) : "vec3(1.0)";
    const at = (cx, cy) => `PP - vec2(${num(cx)},${num(cy)})`;
    let d;
    switch (s.type) {
      case "circle":
        d = `length(${at("cx", "cy")}) - ${num("r")}`;
        break;
      case "ring":
        d = `abs(length(${at("cx", "cy")}) - ${num("r")}) - ${num("width")}*0.5`;
        break;
      case "ellipse":
        d = `sdEll(${at("cx", "cy")}, vec2(${num("rx")},${num("ry")}), ${num("angle")})`;
        break;
      case "rect":
        d = `sdBox(${at("cx", "cy")}, vec2(${num("w")},${num("h")})*0.5, ${num("radius")}, ${num("angle")})`;
        break;
      case "line":
        d = `sdSeg(PP, vec2(${num("x1")},${num("y1")}), vec2(${num("x2")},${num("y2")})) - ${num("width")}*0.5`;
        break;
      case "tri":
        d = `sdTri(PP, vec2(${num("x1")},${num("y1")}), vec2(${num("x2")},${num("y2")}), vec2(${num("x3")},${num("y3")}))`;
        break;
      case "arc":
        d = `sdArc(${at("cx", "cy")}, ${num("r")}, ${num("width")}, ${num("start")}, ${num("end")})`;
        break;
      case "star":
        d = `sdStar(${at("cx", "cy")}, ${num("r")}, ${num("inner")}, ${num("points")}, ${num("angle")})`;
        break;
    }
    const thickness = v.stroke ? `abs(${num("stroke")})` : {
      circle: `2.0*abs(${num("r")})`,
      ellipse: `2.0*min(abs(${num("rx")}),abs(${num("ry")}))`,
      rect: `min(abs(${num("w")}),abs(${num("h")}))`,
      line: `abs(${num("width")})`,
      ring: `abs(${num("width")})`,
      arc: `abs(${num("width")})`,
      star: `2.0*abs(${num("r")})*clamp(${num("inner")},0.05,1.0)`,
      tri: null
    }[s.type];
    const o = this.out;
    o.push(`${ind}{ float d = ${d};`);
    if (v.stroke) o.push(`${ind}  d = abs(d) - ${num("stroke")}*0.5;`);
    o.push(`${ind}  float w = max(${num("blur")}, PX);`);
    o.push(`${ind}  float cv = (1.0 - ssf(-w*0.5, w*0.5, d))${thickness ? ` * clamp(${thickness}/PX, 0.0, 1.0)` : ""}${v.alpha ? ` * clamp(${v.alpha.c},0.0,1.0)` : ""};`);
    o.push(`${ind}  if (cv > 0.0) col = mix(col, ${color}, cv); }`);
    return 1;
  }
};
function compile(source) {
  const program = parse(source);
  const c = new Compiler(program);
  c.errors.push(...program.errors);
  const root = new Scope(null);
  root.root = root;
  for (const inp of program.inputs) {
    try {
      c.checkName(inp.name, inp.line, "input");
      root.vars.set(inp.name, { c: `u_in_${glslName(inp.name)}`, t: inp.kind });
    } catch (e) {
      c.errors.push(e);
    }
  }
  const main = new Scope(root);
  main.root = root;
  let cost = 0;
  if (!program.errors.length) cost = c.stmts(program.body, main, "  ");
  const errors = c.errors.sort((a, b) => a.line - b.line).map((e) => ({ line: e.line, message: e.message }));
  if (!errors.length && c.draws === 0) {
    errors.push({ line: 1, message: "nothing to draw yet: add a fill or a shape" });
  }
  const warnings = [];
  if (cost > LIMITS.warnCost) {
    warnings.push({ line: 0, message: `every pixel costs about ${Math.round(cost)} shapes (noise and fbm count as several); this may be slow on phones` });
  }
  if (cost > LIMITS.cost) {
    errors.push({ line: 0, message: `every pixel costs about ${Math.round(cost)} shapes, over the limit of ${LIMITS.cost}; use smaller repeat counts or less noise and fbm inside repeat` });
  }
  const bps = program.bpm / 60;
  const uniforms = program.inputs.map((i) => `uniform ${i.kind === "col" ? "vec3" : "float"} u_in_${glslName(i.name)};`).join("\n");
  const glsl = `${PRELUDE}${uniforms}
${c.funcs.join("\n")}
void main(){
  ASPECT = u_res.x / u_res.y;
  X = gl_FragCoord.x / u_res.y; Y = 1.0 - gl_FragCoord.y / u_res.y;
  T = u_t; D = u_dur; P = T / D; PX = 1.0 / u_res.y; PP = vec2(X, Y);
  BEAT = (T - ${fmt(program.offset)}) * ${fmt(bps)}; PULSE = BEAT < 0.0 ? 0.0 : exp(-fract(BEAT) * 5.0);
  MX = u_mouse.x; MY = u_mouse.y;
  vec3 col = vec3(0.0);
${c.out.join("\n")}
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    glsl,
    duration: program.duration,
    aspect: program.aspect,
    aspectLabel: program.aspectLabel,
    bpm: program.bpm,
    offset: program.offset,
    inputs: program.inputs.map(({ name, kind, value, min, max }) => ({ name, kind, value, min, max })),
    scenes: program.body.filter((b) => b.k === "scene").map(({ start, end, fadein, fadeout }) => ({ start, end, fadein, fadeout })),
    defines: [...c.defs.keys()],
    cost: Math.round(cost)
  };
}

// src/player.js
var VERTEX = "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }";
var hasRAF = typeof requestAnimationFrame === "function";
function toInputValue(value, kind) {
  if (kind === "col") {
    if (typeof value === "string") return parseHex(value) || [1, 1, 1];
    if (Array.isArray(value) && value.length === 3) return value.map(Number);
    if (typeof value === "number") return [value, value, value];
    return [1, 1, 1];
  }
  return Number(value) || 0;
}
var Player = class {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {string} [options.source] XYT program to load right away
   * @param {boolean} [options.autoplay=true]
   * @param {boolean} [options.loop=true]
   * @param {() => number} [options.clock] external time source in seconds, e.g. () => audio.currentTime
   * @param {'still'|'play'} [options.reducedMotion='still'] show a still frame when the viewer prefers reduced motion
   * @param {boolean} [options.still=false] always show the still frame instead of playing
   * @param {number} [options.poster] time of the still frame (default: 30% of the duration)
   * @param {boolean} [options.adaptive=true] lower the resolution automatically if frames take too long
   * @param {boolean} [options.pauseWhenHidden=true] stop drawing while the canvas is off screen
   * @param {boolean} [options.pointer=true] feed the pointer position into mx and my
   * @param {number} [options.maxPixelRatio=2]
   * @param {number} [options.maxPixels=4147200] cap on canvas pixels (default 2 x 1080p)
   * @param {boolean} [options.fitAspect=true] set the canvas CSS aspect ratio to the program's canvas shape
   * @param {boolean} [options.preserveDrawingBuffer=false]
   * @param {object} [options.inputs] initial values for the program's inputs
   */
  constructor(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("Player needs a <canvas> element");
    this.canvas = canvas;
    this.options = Object.assign({
      autoplay: true,
      loop: true,
      clock: null,
      reducedMotion: "still",
      still: false,
      poster: null,
      adaptive: true,
      pauseWhenHidden: true,
      pointer: true,
      maxPixelRatio: 2,
      maxPixels: 1920 * 1080 * 2,
      fitAspect: true,
      preserveDrawingBuffer: false,
      inputs: {}
    }, options);
    this.result = null;
    this.fps = 0;
    this._time = 0;
    this._playing = false;
    this._raf = 0;
    this._last = 0;
    this._resetAdaptive();
    this._frames = 0;
    this._fpsT = 0;
    this._inputs = {};
    this._mouse = null;
    this._visible = true;
    this._fixed = null;
    this._listeners = {};
    this._cleanup = [];
    this._tick = this._tick.bind(this);
    this._initGL();
    this._observe();
    this._still = !!this.options.still || this.options.reducedMotion === "still" && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const [k, v] of Object.entries(this.options.inputs || {})) this._inputs[k] = v;
    if (this.options.source != null) this.load(this.options.source);
    if (this.options.autoplay && !this._still) this.play();
    else this._requestDraw();
  }
  // ---------- public API ----------
  /** Compile and show a program. On errors the previous program keeps running. Returns the compile result. */
  load(source) {
    var _a;
    const result = compile(source);
    if (!result.ok) {
      this._emit("error", result.errors);
      return result;
    }
    const gpuError = this._build(result);
    if (gpuError) {
      const errors = [{ line: 0, message: "The GPU rejected the compiled shader: " + gpuError }];
      this._emit("error", errors);
      return Object.assign({}, result, { ok: false, errors });
    }
    const previous = this._inputs;
    this._inputs = {};
    for (const inp of result.inputs) {
      this._inputs[inp.name] = previous[inp.name] !== void 0 ? toInputValue(previous[inp.name], inp.kind) : inp.value;
    }
    const first = !this.result;
    this.result = result;
    if (first && this._still && !this._playing) {
      this._time = Math.min(Math.max(0, (_a = this.options.poster) != null ? _a : result.duration * 0.3), result.duration);
    } else if (this._time > result.duration) this._time %= result.duration;
    this._resetAdaptive();
    this._fpsT = 0;
    if (this.options.fitAspect) {
      if (!this.canvas.style.width) this.canvas.style.width = "100%";
      this.canvas.style.aspectRatio = String(result.aspect);
    }
    this._emit("load", result);
    this._requestDraw();
    return result;
  }
  play() {
    if (this._playing) return this;
    this._playing = true;
    this._last = 0;
    this._emit("play");
    this._requestDraw();
    return this;
  }
  pause() {
    if (!this._playing) return this;
    this._playing = false;
    this._emit("pause");
    return this;
  }
  /** Jump to a time in seconds. */
  seek(time) {
    const d = this.duration;
    this._time = Math.max(0, Math.min(Number(time) || 0, d));
    this._requestDraw();
    return this;
  }
  /** Change an input declared in the program (`input wind = 0.5`). Colors accept '#rrggbb' or [r, g, b]. */
  set(name, value) {
    const inp = this.result && this.result.inputs.find((i) => i.name === name);
    this._inputs[name] = inp ? toInputValue(value, inp.kind) : value;
    this._requestDraw();
    return this;
  }
  get(name) {
    return this._inputs[name];
  }
  get time() {
    return this._time;
  }
  set time(v) {
    this.seek(v);
  }
  get duration() {
    return this.result ? this.result.duration : 0;
  }
  get playing() {
    return this._playing;
  }
  /** Fix the drawing size in pixels (for exports), or pass nothing to size from the page again. */
  setSize(width, height) {
    if (width && height) {
      this._fixed = [Math.round(width), Math.round(height)];
      this.canvas.width = this._fixed[0];
      this.canvas.height = this._fixed[1];
    } else {
      this._fixed = null;
      this.resize();
    }
    this._requestDraw();
    return this;
  }
  /** Draw one frame at a given time, right now. Pair with readPixels() for exports. */
  renderAt(time) {
    this._time = Math.max(0, Number(time) || 0);
    this.resize();
    this._draw(this._time);
    return this;
  }
  /** RGBA pixels of the last frame, top row first. Call right after renderAt(). */
  readPixels() {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const row = w * 4, out = new Uint8Array(px.length);
    for (let y = 0; y < h; y++) out.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    return out;
  }
  /** Match the canvas resolution to its size on the page. Called automatically. */
  resize() {
    if (this._fixed) return;
    const aspect = this.result ? this.result.aspect : 1;
    const cssWidth = this.canvas.clientWidth;
    if (!cssWidth) return;
    const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
    const ratio = Math.min(dpr, this.options.maxPixelRatio) * this._scale;
    let w = Math.max(1, Math.round(cssWidth * ratio));
    let h = Math.max(1, Math.round(w / aspect));
    const max = this.options.maxPixels;
    if (w * h > max) {
      const f = Math.sqrt(max / (w * h));
      w = Math.round(w * f);
      h = Math.round(h * f);
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }
  /** Listen to 'load', 'error', 'frame', 'play', 'pause', 'end'. Returns a function that stops listening. */
  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
    return () => {
      this._listeners[event] = (this._listeners[event] || []).filter((f) => f !== fn);
    };
  }
  destroy() {
    this.pause();
    if (this._raf && hasRAF) cancelAnimationFrame(this._raf);
    this._raf = 0;
    for (const off of this._cleanup) off();
    this._cleanup = [];
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      if (this._prog) gl.deleteProgram(this._prog);
      if (this._vs) gl.deleteShader(this._vs);
      if (this._buf) gl.deleteBuffer(this._buf);
    }
    this._prog = null;
    this.result = null;
    this._listeners = {};
  }
  // ---------- internals ----------
  _emit(event, data) {
    const list = this._listeners[event];
    if (list) for (const fn of list.slice()) fn(data);
  }
  _initGL() {
    const attrs = { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: !!this.options.preserveDrawingBuffer };
    const gl = this.canvas.getContext("webgl", attrs) || this.canvas.getContext("experimental-webgl", attrs);
    if (!gl) throw new Error("WebGL is not available in this browser, and XYT needs it to draw.");
    this.gl = gl;
    this._buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this._vs = this._shader(gl.VERTEX_SHADER, VERTEX);
    this._prog = null;
  }
  _shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(log || "shader failed to compile");
    }
    return s;
  }
  _build(result) {
    const gl = this.gl;
    try {
      const fs = this._shader(gl.FRAGMENT_SHADER, result.glsl);
      const p = gl.createProgram();
      gl.attachShader(p, this._vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p) || "link failed");
      if (this._prog) gl.deleteProgram(this._prog);
      this._prog = p;
      const u = (n) => gl.getUniformLocation(p, n);
      this._loc = { a: gl.getAttribLocation(p, "a"), res: u("u_res"), t: u("u_t"), dur: u("u_dur"), mouse: u("u_mouse"), inputs: {} };
      for (const inp of result.inputs) this._loc.inputs[inp.name] = { loc: u("u_in_" + glslName(inp.name)), kind: inp.kind };
      return null;
    } catch (e) {
      return String(e.message || e).slice(0, 400);
    }
  }
  _draw(t) {
    if (!this._prog || !this.result || this.gl.isContextLost()) return;
    const gl = this.gl, L = this._loc, w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(this._prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
    gl.enableVertexAttribArray(L.a);
    gl.vertexAttribPointer(L.a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(L.res, w, h);
    gl.uniform1f(L.t, t);
    gl.uniform1f(L.dur, this.result.duration);
    const m = this._mouse || [w / h / 2, 0.5];
    gl.uniform2f(L.mouse, m[0], m[1]);
    for (const [name, { loc, kind }] of Object.entries(L.inputs)) {
      const v = this._inputs[name];
      if (kind === "col") gl.uniform3f(loc, v[0], v[1], v[2]);
      else gl.uniform1f(loc, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this._emit("frame", t);
  }
  _requestDraw() {
    if (!this._raf && hasRAF) this._raf = requestAnimationFrame(this._tick);
  }
  _tick(now) {
    this._raf = 0;
    if (!this.result) return;
    const gap = this._last ? now - this._last : Infinity;
    const dt = this._last ? Math.min(gap / 1e3, 0.25) : 0;
    this._last = now;
    const D = this.result.duration;
    if (this._playing) {
      const clock = this.options.clock;
      let t = clock ? Number(clock()) || 0 : this._time + dt;
      if (t >= D) {
        if (this.options.loop) t %= D;
        else {
          t = D;
          this._playing = false;
          this._emit("end");
        }
      }
      this._time = t;
      this._measure(now, gap > 500);
    }
    if (this._visible) {
      this.resize();
      this._draw(this._time);
    }
    if (this._playing && this._visible) this._raf = requestAnimationFrame(this._tick);
  }
  _measure(now, restart) {
    if (restart || !this._fpsT) {
      this._fpsT = now;
      this._frames = 0;
      return;
    }
    this._frames++;
    if (now - this._fpsT < 1e3) return;
    this.fps = Math.round(this._frames * 1e3 / (now - this._fpsT));
    this._frames = 0;
    this._fpsT = now;
    if (this.options.adaptive) this._adapt(this.fps);
  }
  _resetAdaptive() {
    this._trial = null;
    this._cap = 0;
    this._raiseAfter = 5;
    this._setLevel(0);
  }
  _setLevel(level) {
    this._level = level;
    this._scale = Math.max(0.35, 0.8 ** level);
    this._slow = this._fast = 0;
  }
  // Called once a second while playing. Lowers the resolution while frames are slow, but keeps a
  // lower one only if frames got faster: when the screen or a power-saving mode holds the frame rate
  // at 30, they can't, and the picture would only get blurrier. Higher resolutions are tried again
  // after a while, waiting twice as long after each try that turns out too slow.
  _adapt(fps) {
    const trial = this._trial;
    this._trial = null;
    if (trial && this._level > trial.level && fps < trial.fps * 1.15) {
      this._cap = fps;
      this._setLevel(trial.level);
      return;
    }
    if (trial && this._level < trial.level && fps < 40 && fps < trial.fps * 0.85) {
      this._raiseAfter *= 2;
      this._setLevel(trial.level);
      return;
    }
    if (this._cap && fps > this._cap * 1.3) this._cap = 0;
    const slow = fps < 40 && !(this._cap && fps >= this._cap * 0.85);
    const fast = fps >= 50 || this._cap > 0 && fps >= this._cap * 0.95;
    this._slow = slow ? this._slow + 1 : 0;
    this._fast = fast ? this._fast + 1 : 0;
    if (this._slow >= 2 && this._level < 5) this._try(this._level + 1, fps);
    else if (this._fast >= this._raiseAfter && this._level > 0) this._try(this._level - 1, fps);
  }
  _try(level, fps) {
    this._trial = { level: this._level, fps };
    this._setLevel(level);
  }
  _observe() {
    const c = this.canvas;
    const add = (target, ev, fn, opts) => {
      target.addEventListener(ev, fn, opts);
      this._cleanup.push(() => target.removeEventListener(ev, fn, opts));
    };
    add(c, "webglcontextlost", (e) => {
      e.preventDefault();
    });
    add(c, "webglcontextrestored", () => {
      this._initGL();
      if (this.result) this._build(this.result);
      this._requestDraw();
    });
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(() => this._requestDraw());
      ro.observe(c);
      this._cleanup.push(() => ro.disconnect());
    }
    if (this.options.pauseWhenHidden && typeof IntersectionObserver === "function") {
      const io = new IntersectionObserver((entries) => {
        const vis = entries[entries.length - 1].isIntersecting;
        if (vis === this._visible) return;
        this._visible = vis;
        if (vis) {
          this._last = 0;
          this._requestDraw();
        }
      });
      io.observe(c);
      this._cleanup.push(() => io.disconnect());
    }
    if (this.options.pointer) {
      const move = (e) => {
        const r = c.getBoundingClientRect();
        if (!r.height) return;
        this._mouse = [(e.clientX - r.left) / r.height, (e.clientY - r.top) / r.height];
        if (!this._playing) this._requestDraw();
      };
      add(c, "pointermove", move);
      add(c, "pointerdown", move);
    }
  }
};

// src/element.js
function defineElement(tag = "xyt-player") {
  if (typeof customElements === "undefined" || typeof HTMLElement === "undefined" || customElements.get(tag)) return;
  class XytPlayerElement extends HTMLElement {
    static get observedAttributes() {
      return ["src", "paused"];
    }
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = '<style>:host{display:block;position:relative}canvas{display:block;width:100%}</style><canvas part="canvas"></canvas>';
      this._canvas = root.querySelector("canvas");
      this._source = null;
      this.player = null;
    }
    connectedCallback() {
      if (this.player) return;
      this.player = new Player(this._canvas, {
        autoplay: !this.hasAttribute("paused"),
        loop: !this.hasAttribute("once"),
        still: this.hasAttribute("still")
      });
      this.player.on("error", (errors) => this.dispatchEvent(new CustomEvent("xyt-error", { detail: errors })));
      this.player.on("load", (result) => this.dispatchEvent(new CustomEvent("xyt-load", { detail: result })));
      this._loadSource();
    }
    disconnectedCallback() {
      if (this.player) {
        this.player.destroy();
        this.player = null;
      }
    }
    attributeChangedCallback(name) {
      if (!this.player) return;
      if (name === "src") this._loadSource();
      if (name === "paused") {
        if (this.hasAttribute("paused")) this.player.pause();
        else this.player.play();
      }
    }
    /** The program text. Setting it loads it. */
    get source() {
      return this._source;
    }
    set source(text) {
      this._source = String(text);
      if (this.player) this.player.load(this._source);
    }
    /** Shortcut for player.set(name, value). */
    set(name, value) {
      if (this.player) this.player.set(name, value);
      return this;
    }
    async _loadSource() {
      if (this._source != null) {
        this.player.load(this._source);
        return;
      }
      const inline = this.querySelector('script[type="text/xyt"]');
      if (inline) {
        this.player.load(inline.textContent);
        return;
      }
      const src = this.getAttribute("src");
      if (!src) {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => {
            if (this.player) this._loadSource();
          }, { once: true });
        }
        return;
      }
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (this.player && this.getAttribute("src") === src) this.player.load(text);
      } catch (e) {
        this.dispatchEvent(new CustomEvent("xyt-error", { detail: [{ line: 0, message: `could not load ${src}: ${e.message}` }] }));
      }
    }
  }
  customElements.define(tag, XytPlayerElement);
}

// src/reference.js
var reference = `XYT: describe pictures and motion with formulas of x, y and t.

Coordinates: y goes 0 (top) to 1 (bottom). x goes 0 (left) to aspect (right); aspect is 1 on the default square canvas.
Time: t = seconds since the start; the animation loops every "duration" seconds (default 4, or the end of the last scene).
p = t / duration, the loop progress from 0 to 1. Any value can be a formula using x, y, t, p.
Lines are drawn in order: later lines paint over earlier ones. Comments start with //.

Setup (top of the program, all optional):
canvas 16:9                        // or canvas 9:16, canvas 1:1 (default). Then x goes 0 to aspect (1.778 for 16:9)
duration 8
bpm 120 offset=0                   // tempo for beat and pulse; offset = seconds before the first beat
input wind = 0.5 min=0 max=1       // a value the host page can change live (number or color)

Drawing (one command per line, values are named):
fill COLOR alpha=1                 // paints every pixel; COLOR can vary with x, y, t
circle  cx= cy= r=
ellipse cx= cy= rx= ry= angle=
rect    cx= cy= w= h= radius= angle=   // centered at cx,cy; radius rounds corners
line    x1= y1= x2= y2= width=
tri     x1= y1= x2= y2= x3= y3=
ring    cx= cy= r= width=
arc     cx= cy= r= width= start= end=  // part of a ring; degrees, 0 = right, 90 = down
star    cx= cy= r= inner= points= angle=   // inner = 0-1 depth of the points, default 5 points
Every shape also takes: color= alpha= (0 to 1) blur= (soft edge width) stroke= (outline width instead of filled).
Sizes and positions share the same units (1 = canvas height). angle is in degrees, clockwise.
A shape's color can vary per pixel, like color=mix(red, yellow, y).
let name = formula                 // reusable number or color, may use x, y, t

Blocks (close each with end):
repeat i 12                        // i = 0, 1, ..., 11
scene 6 12 fade=0.5                // only draws from 6 s to 12 s; fade (or fadein/fadeout) in seconds
                                   // inside a scene: st = seconds since the scene began, sp = scene progress 0-1
define hero cx=0.5 cy=0.5 s=1 tint=gold   // a reusable drawing (character, cloud) with named values and defaults
end
hero cx=0.3 s=0.8                  // draw it anywhere, as often as needed, changing only what differs
Inside define, use its own values plus x, y, t and inputs; pass anything else in as a value. Define it above where it is used.

Colors: #rgb or #rrggbb, rgb(r,g,b) with 0-1 values, hsl(hue_degrees, s, l) with s and l 0-1, gray(v),
names: white black red green blue yellow orange purple pink cyan magenta gray navy teal brown gold sky.
Color math works: mix(c1, c2, k), c * 0.5, c1 + c2.

Math: + - * / % ^ and < > (give 1 or 0), sin cos tan abs floor ceil fract round sqrt exp log sign
min max clamp(v) clamp(v,lo,hi) mix(a,b,k) smoothstep(edge0,edge1,v) step(edge,v) atan2(y,x) pow(a,b)
dist(x1,y1,x2,y2) = distance between two points. Constants: pi tau.
Motion: keys(t, 0, 0.2, 1.5, 0.8, 3, 0.2) moves smoothly through values at key times (values may be colors);
ease(v) easein(v) easeout(v) backout(v) (overshoots) bounce(v) take 0-1 progress; pingpong(v) goes 0 to 1 to 0 each unit.
Randomness: noise(a,b) or noise(a,b,c) smooth 0-1; fbm(a,b) or fbm(a,b,c) cloudy 0-1; hash(n) fixed random 0-1 per number.
Rhythm: beat = beats since the first beat, pulse = 1 on every beat, fading to 0 before the next.
Pointer: mx, my = where the viewer's pointer is (canvas center until it moves).
Math is safe: no errors from sqrt, pow or log of negatives.

Example:
duration 4
fill mix(#0b1a33, #2c5aa0, y)
let hop = abs(sin(p * tau))
define ball cx=0.5 cy=0.5 tint=orange
  circle cx=cx cy=cy r=0.07 color=tint
  circle cx=cx - 0.02 cy=cy - 0.02 r=0.02 color=white alpha=0.6
end
ball cx=keys(t, 0, 0.2, 2, 0.8, 4, 0.2) cy=0.82 - 0.5 * hop
repeat i 5
  circle cx=0.1 + i * 0.2 cy=0.94 r=0.02 color=white alpha=0.3 + 0.7 * pulse
end`;

// src/index.js
var version = "0.2.0";
if (typeof window !== "undefined") defineElement();
