/*! xyt-motion 0.4.0 | MIT */
var XYT = (() => {
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
  var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    BUILTINS: () => BUILTINS,
    FUNCTIONS: () => FUNCTIONS,
    FrameValues: () => FrameValues,
    NAMED_COLORS: () => NAMED_COLORS,
    Player: () => Player,
    SHAPES: () => SHAPES,
    compile: () => compile,
    defineElement: () => defineElement,
    parse: () => parse,
    reference: () => reference,
    use: () => use,
    version: () => version
  });

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
    star: { cx: 0.5, cy: 0.5, r: 0.1, inner: 0.45, points: 5, angle: 0 },
    // a quadratic Bezier curve from (x1, y1) to (x2, y2), pulled toward the control point (cx, cy)
    curve: { x1: 0.2, y1: 0.6, cx: 0.5, cy: 0.3, x2: 0.8, y2: 0.6, width: 0.01 }
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
    star: { radius: "r", x: "cx", y: "cy", rotation: "angle", rotate: "angle", n: "points" },
    curve: { thickness: "width", qx: "cx", qy: "cy" }
  };
  var SHAPE_ALIASES = {
    rectangle: "rect",
    square: "rect",
    box: "rect",
    triangle: "tri",
    oval: "ellipse",
    segment: "line",
    circ: "circle",
    bezier: "curve"
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
  var TRANSFORM = { cx: null, cy: 0.5, angle: 0, scale: 1, flip: 1, dx: 0, dy: 0, shake: 0 };
  var TRANSFORM_ALIASES = { x: "cx", y: "cy", rotation: "angle", rotate: "angle", zoom: "scale", mirror: "flip" };
  var CLIP_OPTIONS = { blur: 0, stroke: 0, invert: 0 };
  var SCENE_VALUES = ["st", "sp", "sb"];
  var COMMANDS = ["xyt", "use", "canvas", "duration", "bpm", "input", "let", "fill", "repeat", "scene", "define", "group", "camera", "clip", "end"];
  var LATER_COMMANDS = ["fn", "sim", "cue", "track"];
  var BLOCK_COMMANDS = { return: "fn", anchor: "define", bounds: "define", state: "sim", if: "sim", else: "sim" };
  var ANCHOR = { x: 0.5, y: 0.5, angle: 0 };
  var BOUNDS = { cx: 0.5, cy: 0.5, r: 0.5 };
  var LANGUAGE_VERSION = "0.4";
  var ASPECT_NAMES = { square: 1, wide: 16 / 9, landscape: 16 / 9, tall: 9 / 16, portrait: 9 / 16, cinema: 2.39 };
  var LIMITS = {
    repeat: 500,
    cost: 2e3,
    warnCost: 400,
    warnLine: 100,
    nameLength: 64,
    // per-frame values (sim states, tracks, smooth) and the work of simulating them before the first frame
    frameValues: 256,
    simWork: 4e7
  };
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

// a wobble that starts at t = 0: swings between -1 and 1 at f per second, dying out at rate d
float spring(float t, float f, float d){ return t <= 0.0 ? 0.0 : exp(-d*t) * sin(6.28318531*f*t); }
// 1 at the moment of a hit, fading quickly (hits() takes the largest over its times)
float hit(float t){ return t < 0.0 ? 0.0 : exp(-t*8.0); }

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
// the other way round: where a point drawn inside a transform (group, camera, define call) appears outside it
vec2 fwd(vec2 p, vec2 c, float s, float f, float deg, vec2 d){ p -= c; p.x *= f; p *= s; return rot(p, -deg) + c + d; }

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
// quadratic Bezier curve from A to C pulled toward B, exact distance (after Inigo Quilez, MIT).
// Nearly straight curves use a segment: the cubic solution loses precision there.
float sdBez(vec2 pos, vec2 A, vec2 B, vec2 C){
  vec2 a = B - A; vec2 b = A - 2.0*B + C; vec2 c = a*2.0; vec2 d = A - pos; vec2 ac = C - A;
  float bb = dot(b, b);
  if (bb < 1e-5*dot(ac, ac) + 1e-12) return sdSeg(pos, A, C);
  float kk = 1.0/bb; float kx = kk*dot(a, b); float ky = kk*(2.0*dot(a, a) + dot(d, b))/3.0; float kz = kk*dot(d, a);
  float p = ky - kx*kx; float q = kx*(2.0*kx*kx - 3.0*ky) + kz; float h = q*q + 4.0*p*p*p;
  float res;
  if (h >= 0.0) { h = sqrt(h); vec2 x = (vec2(h, -h) - q)*0.5; vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
    float t = clamp(uv.x + uv.y - kx, 0.0, 1.0); vec2 e = d + (c + b*t)*t; res = dot(e, e); }
  else { float z = sqrt(-p); float v = acos(clamp(q/(p*z*2.0), -1.0, 1.0))/3.0; float m = cos(v); float n = sin(v)*1.732050808;
    vec3 t = clamp(vec3(m + m, -n - m, n - m)*z - kx, 0.0, 1.0);
    vec2 e1 = d + (c + b*t.x)*t.x; vec2 e2 = d + (c + b*t.y)*t.y; res = min(dot(e1, e1), dot(e2, e2)); }
  return sqrt(res); }
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

  // src/registry.js
  var loaded = /* @__PURE__ */ new Map();
  function use(plugin) {
    if (!plugin || typeof plugin.name !== "string" || !/^[a-z][a-z0-9]*$/.test(plugin.name)) {
      throw new TypeError("use() needs an XYT plugin, like the default export of xyt-motion/text");
    }
    for (const name of Object.keys(plugin.shapes || {})) {
      if (COMMANDS.includes(name) || SHAPES[name] || SHAPE_ALIASES[name] || BUILTINS[name] || NAMED_COLORS[name]) {
        throw new Error(`the ${plugin.name} plugin's '${name}' is already part of the language`);
      }
    }
    loaded.set(plugin.name, plugin);
  }
  var pluginNamed = (name) => loaded.get(name);
  var loadedPlugins = () => [...loaded.values()];
  var KNOWN_PLUGINS = {
    text: { commands: ["text"], load: "import text from 'xyt-motion/text' and call use(text), or load dist/xyt-text.min.js after the library" }
  };

  // src/parser.js
  var own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
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
      if (c === '"' || c === "'") {
        let v = "", j = i + 1;
        for (; j < src.length && src[j] !== c; j++) v += src[j] === "\\" && j + 1 < src.length ? src[++j] : src[j];
        if (j >= src.length) throw new XytError(line, `these words have no closing ${c}`);
        toks.push({ k: "str", v });
        i = j + 1;
        continue;
      }
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
        const m = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i));
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
  var tokStr = (k) => k.k === "col" ? "#" + k.v : k.k === "str" ? `"${k.v}"` : String(k.v);
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
    if (k.k === "str") throw new XytError(c.line, `words in quotes only go right after a command that writes them, like: text "Hello" x=0.5`);
    throw new XytError(c.line, `expected a value but found '${tokStr(k)}'`);
  }
  function parseNamed(c, what) {
    const attrs = {};
    while (!c.atEnd()) {
      if (!c.isNamedValue()) {
        const example = { fill: "alpha=0.5", group: "angle=30", camera: "zoom=2" }[what] || (what.startsWith("clip") ? "r=0.3" : "color=red");
        throw new XytError(c.line, `${what} takes named values like ${example}; found '${tokStr(c.peek())}'`);
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
  function plainName(k) {
    return !!k && k.k === "id" && !k.v.includes(".");
  }
  function constEval(e, line, env, what) {
    const ev = (n) => constEval(n, line, env, what);
    switch (e.t) {
      case "num":
        return e.v;
      case "neg":
        return -ev(e.a);
      case "bin": {
        const a = ev(e.a), b = ev(e.b);
        const ops = { "+": a + b, "-": a - b, "*": a * b, "/": b === 0 ? 0 : a / b, "%": b === 0 ? 0 : a - b * Math.floor(a / b), "^": a ** b };
        if (e.op in ops) return ops[e.op];
        break;
      }
      case "var":
        if (env.cues.has(e.name)) return env.cues.get(e.name);
        if (e.name === "pi") return Math.PI;
        if (e.name === "tau") return Math.PI * 2;
        if (e.name === "dur" && env.duration !== null) return env.duration;
        throw new XytError(line, `${what} must be a number, a cue name or bar(...); '${e.name}' is not a cue named above.` + suggest(e.name, [...env.cues.keys()]));
      case "call": {
        const args = e.args.map(ev);
        const fns = { min: Math.min, max: Math.max, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: (v) => Math.floor(v + 0.5) };
        if (e.fn === "bar") {
          if (args.length < 1 || args.length > 2) throw new XytError(line, "bar() takes the bar, and optionally the beat, counting from 1: bar(9) or bar(9, 3)");
          return env.barTime(args[0], args.length > 1 ? args[1] : 1);
        }
        if (fns[e.fn] && args.length >= 1) return fns[e.fn](...args);
        break;
      }
    }
    throw new XytError(line, `${what} must be a number, a cue name or bar(...), like: scene 12 bar(9) or scene splash splash + 4`);
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
      bar: 4,
      inputs: [],
      body: root.body,
      errors: [],
      defines: /* @__PURE__ */ new Set(),
      uses: [],
      fns: /* @__PURE__ */ new Set(),
      sims: /* @__PURE__ */ new Set(),
      cues: [],
      tracks: []
    };
    const pluginShape = (name) => {
      for (const p of program.uses) if (p.shapes && own(p.shapes, name)) return { plugin: p, def: p.shapes[name] };
      return null;
    };
    const pluginShapeLine = (c, name, line, what) => {
      const { plugin, def } = pluginShape(name);
      let str = null;
      if (def.string) {
        const k = c.peek();
        if (!k || k.k !== "str") throw new XytError(line, `${name} needs its words in quotes first, like: ${name} "Hello" x=0.5`);
        c.next();
        str = k.v;
      }
      return { plugin, def, str, attrs: parseNamed(c, what) };
    };
    let durationBars = null, durationExpr = null;
    const barScenes = [], exprScenes = [];
    const inBars = (c) => {
      const k = c.peek();
      if (k && k.k === "id" && (k.v === "bars" || k.v === "bar") && !c.isOp("(", 1)) {
        c.next();
        return true;
      }
      return false;
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
        const top = stack[stack.length - 1];
        const body = top.body;
        const done = (what) => {
          if (!c.atEnd()) throw new XytError(line, `unexpected '${tokStr(c.peek())}' after ${what}`);
        };
        if (top.k === "fn" && !["let", "return", "end"].includes(cmd)) {
          throw new XytError(line, `a fn holds let lines and one return line, like: return 2 * a + b; '${cmd}' can't go inside it`);
        }
        if (top.k === "fn" && top.ret && cmd === "let") throw new XytError(line, "return is the last line of a fn; put let lines above it");
        if (stack.some((b) => b.k === "sim")) {
          const op = (o) => toks[o] && toks[o].k === "op" ? toks[o].v : null;
          const assign = op(1) === "=" ? "=" : ["+", "-", "*", "/"].includes(op(1)) && op(2) === "=" ? op(1) : null;
          if (assign && !["let", "state"].includes(cmd)) {
            if (!plainName(head)) throw new XytError(line, `a sim can only change its own states; '${cmd}' belongs to something else`);
            c.i = assign === "=" ? 2 : 3;
            const expr = parseExpr(c, 0);
            done("the value");
            body.push({ k: "set", name: cmd, op: assign, expr, line });
            continue;
          }
          if (!["let", "state", "if", "else", "end"].includes(cmd)) {
            throw new XytError(line, `a sim holds state, let, if and else lines, and lines that change a state, like: vy += 9.8 * dt. It draws nothing: '${cmd}' goes after its end`);
          }
        }
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
          case "use": {
            topLevelOnly(cmd, line);
            const n = c.next();
            if (!n || n.k !== "id") throw new XytError(line, "use needs the name of a plugin, like: use text");
            done("the plugin name");
            const p = pluginNamed(n.v);
            if (!p) {
              const names = [...new Set(Object.keys(KNOWN_PLUGINS).concat(loadedPlugins().map((q) => q.name)))];
              throw new XytError(line, KNOWN_PLUGINS[n.v] ? `this program uses the '${n.v}' plugin, which isn't loaded here: ${KNOWN_PLUGINS[n.v].load}` : `there is no '${n.v}' plugin.` + suggest(n.v, names) + ` Plugins: ${names.join(", ")}`);
            }
            if (!program.uses.includes(p)) program.uses.push(p);
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
            const bars = inBars(c);
            if (!bars && !c.atEnd() && !(c.peek().k === "num" && c.peek(1) === void 0)) {
              durationExpr = { expr: parseExpr(c, 0), line };
              done("the duration");
              break;
            }
            const v = constNumber(c, "duration");
            if (v <= 0) throw new XytError(line, bars ? "duration bars needs a positive number of bars, like: duration bars 16" : "duration needs a positive number of seconds, like: duration 4");
            done("the duration");
            if (bars) durationBars = v;
            else program.duration = Math.min(v, 3600);
            break;
          }
          case "bpm": {
            topLevelOnly(cmd, line);
            const v = constNumber(c, "bpm");
            if (v <= 0 || v > 600) throw new XytError(line, "bpm needs a tempo between 1 and 600, like: bpm 120");
            program.bpm = v;
            const opts = parseNamed(c, "bpm");
            for (const n of Object.keys(opts)) {
              if (n !== "offset" && n !== "bar") {
                throw new XytError(line, `bpm has no '${n}'.` + suggest(n, ["offset", "bar"]) + " It takes: offset (seconds before the first beat), bar (beats per bar)");
              }
              const e = opts[n], val = e.t === "num" ? e.v : e.t === "neg" && e.a.t === "num" ? -e.a.v : null;
              if (n === "offset") {
                if (val === null) throw new XytError(line, "bpm offset needs a plain number of seconds");
                program.offset = val;
              } else {
                if (!(val >= 1 && val <= 32 && val === Math.floor(val))) throw new XytError(line, "bpm bar needs a whole number of beats per bar, like: bpm 120 bar=3");
                program.bar = val;
              }
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
          case "fn": {
            topLevelOnly(cmd, line);
            const n = c.next();
            if (!plainName(n)) throw new XytError(line, "fn needs a name and its values in parentheses: fn wave(x) = sin(x * 3)");
            if (!c.isOp("(")) throw new XytError(line, `fn ${n.v} needs its values in parentheses after the name, like: fn ${n.v}(x) = x * 2, or fn ${n.v}() = t * 2`);
            c.next();
            const params = [];
            if (!c.isOp(")")) {
              for (; ; ) {
                const k = c.next();
                if (!plainName(k)) throw new XytError(line, `the values of fn ${n.v} are names, like: fn ${n.v}(x, height) = ...`);
                if (params.includes(k.v)) throw new XytError(line, `'${k.v}' is given twice`);
                params.push(k.v);
                if (c.isOp(",")) {
                  c.next();
                  continue;
                }
                break;
              }
            }
            c.expect(")");
            if (program.fns.has(n.v)) throw new XytError(line, `fn '${n.v}' is written twice`);
            program.fns.add(n.v);
            const blk = { k: "fn", name: n.v, params, body: [], ret: null, retLine: line, line };
            body.push(blk);
            if (c.isOp("=")) {
              c.next();
              blk.ret = parseExpr(c, 0);
              done("the formula");
            } else {
              done(`fn ${n.v}(...)`);
              stack.push(blk);
            }
            break;
          }
          case "return": {
            if (top.k !== "fn") throw new XytError(line, "return only goes in a fn block: fn name(a) ... return a * 2 ... end");
            if (top.ret) throw new XytError(line, `fn ${top.name} already returns a value; a fn has one return line`);
            top.ret = parseExpr(c, 0);
            top.retLine = line;
            done("the value");
            break;
          }
          case "anchor": {
            const di = stack.findIndex((b) => b.k === "define");
            if (di < 0) throw new XytError(line, "anchor only goes inside a define, where it names a point of the drawing: anchor hand x=cx + 0.1 * s y=cy");
            const inside = stack.slice(di + 1).find((b) => b.k !== "group");
            if (inside) throw new XytError(line, `an anchor can't go inside a ${inside.k}; put it in the define itself or inside a group`);
            const n = c.next();
            if (!plainName(n)) throw new XytError(line, "anchor needs a name and its point: anchor hand x=cx + 0.1 y=cy - 0.2 angle=30");
            const def = stack[di];
            if (def.anchors.includes(n.v)) throw new XytError(line, `anchor '${n.v}' is given twice in define ${def.name}`);
            def.anchors.push(n.v);
            body.push({ k: "anchor", name: n.v, attrs: parseNamed(c, "anchor"), line });
            break;
          }
          case "bounds": {
            if (top.k !== "define") {
              throw new XytError(line, "bounds goes directly inside a define, as the circle its drawing stays within: bounds cx=cx cy=cy - 0.1 * s r=0.3 * s");
            }
            if (top.bounded) throw new XytError(line, `define ${top.name} already has bounds`);
            top.bounded = true;
            body.push({ k: "bounds", attrs: parseNamed(c, "bounds"), line });
            break;
          }
          case "sim": {
            topLevelOnly(cmd, line);
            const n = c.next();
            if (!plainName(n)) throw new XytError(line, "sim needs a name, like: sim ball. Its states are then read as ball.y");
            if (program.sims.has(n.v)) throw new XytError(line, `sim '${n.v}' is written twice`);
            program.sims.add(n.v);
            const blk = { k: "sim", name: n.v, step: null, body: [], line };
            body.push(blk);
            stack.push(blk);
            const opts = parseNamed(c, "sim");
            for (const o of Object.keys(opts)) {
              if (o !== "step") throw new XytError(line, `sim has no '${o}'.` + suggest(o, ["step"]) + " It takes: step (seconds per step, default 1/240)");
              const e = opts[o];
              if (e.t !== "num" && !(e.t === "bin" && e.op === "/" && e.a.t === "num" && e.b.t === "num")) throw new XytError(line, "sim step needs a plain number of seconds, like: step=0.002 or step=1/500");
              blk.step = e.t === "num" ? e.v : e.a.v / e.b.v;
              if (!(blk.step >= 1e-4 && blk.step <= 0.1)) {
                blk.step = null;
                throw new XytError(line, "sim step must be between 0.0001 and 0.1 seconds");
              }
            }
            break;
          }
          case "state": {
            if (top.k !== "sim") throw new XytError(line, "state goes directly inside a sim (not inside if): state y = 0.2");
            const n = c.next();
            if (!plainName(n)) throw new XytError(line, "state needs a name and its starting value: state y = 0.2");
            c.expect("=");
            const expr = parseExpr(c, 0);
            done("the starting value");
            body.push({ k: "state", name: n.v, expr, line });
            break;
          }
          case "if": {
            if (!stack.some((q) => q.k === "sim")) {
              throw new XytError(line, "if only goes inside a sim block; elsewhere a condition is a number you multiply by, like: alpha=(t > 2) * 0.5");
            }
            if (c.atEnd()) throw new XytError(line, "if needs a condition: if y > 0.8");
            const blk = { k: "if", cond: parseExpr(c, 0), then: [], other: null, line };
            blk.body = blk.then;
            done("the condition");
            body.push(blk);
            stack.push(blk);
            break;
          }
          case "else": {
            if (top.k !== "if" || top.other) throw new XytError(line, "else goes between an if and its 'end', once");
            done("else");
            top.other = [];
            top.body = top.other;
            break;
          }
          case "cue": {
            topLevelOnly(cmd, line);
            const n = c.next();
            if (!plainName(n)) throw new XytError(line, "cue needs a name and a time: cue splash 12.5, or cue chorus bar(17)");
            if (c.isOp("=")) c.next();
            if (c.atEnd()) throw new XytError(line, `cue ${n.v} needs a time: cue ${n.v} 12.5`);
            const expr = parseExpr(c, 0);
            done("the time");
            if (program.cues.some((q) => q.name === n.v)) throw new XytError(line, `cue '${n.v}' is named twice`);
            program.cues.push({ name: n.v, expr, line, value: 0 });
            break;
          }
          case "track": {
            topLevelOnly(cmd, line);
            const n = c.next();
            const how = "track needs a name, step= (the seconds between values) and its values: track level step=0.05 0 0.2 0.5";
            if (!plainName(n) || !c.isNamedValue() || c.peek().v !== "step") throw new XytError(line, how);
            c.next();
            c.next();
            const step = constNumber(c, "track step");
            if (!(step > 0)) throw new XytError(line, how);
            const values = [];
            while (!c.atEnd()) values.push(constNumber(c, "each value of a track"));
            if (!values.length) throw new XytError(line, how);
            if (program.tracks.some((q) => q.name === n.v)) throw new XytError(line, `track '${n.v}' is written twice`);
            program.tracks.push({ name: n.v, step, values, line });
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
            const bars = inBars(c);
            let a, b, ea = null, eb = null;
            if (bars) {
              a = constNumber(c, "scene");
              b = constNumber(c, "scene");
              if (!(a >= 1 && b >= a)) throw new XytError(line, "scene bars needs its first and last bar, counting from 1, both included: scene bars 9 16");
            } else {
              const how = "scene needs a start and an end time in seconds, end after start: scene 6 12";
              if (c.atEnd() || c.isNamedValue()) throw new XytError(line, how);
              ea = parseExpr(c, 0);
              if (c.atEnd() || c.isNamedValue()) throw new XytError(line, how);
              eb = parseExpr(c, 0);
              if (ea.t === "num" && eb.t === "num") {
                a = ea.v;
                b = eb.v;
                ea = eb = null;
                if (!(b > a)) throw new XytError(line, how);
              }
            }
            const opts = parseNamed(c, "scene");
            const blk = { k: "scene", start: a, end: b, fadein: 0, fadeout: 0, body: [], line };
            if (bars) barScenes.push(blk);
            if (ea) {
              blk.startExpr = ea;
              blk.endExpr = eb;
              exprScenes.push(blk);
            }
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
            if (n.v.includes(".")) throw new XytError(line, `a define's name can't have dots: dots read the values of named drawings, like mila.hand.x`);
            if (COMMANDS.includes(n.v) || LATER_COMMANDS.includes(n.v) || BLOCK_COMMANDS[n.v] || SHAPES[n.v] || SHAPE_ALIASES[n.v] || BUILTINS[n.v] || NAMED_COLORS[n.v] || pluginShape(n.v) || n.v === "background" || n.v === "bg")
              throw new XytError(line, `'${n.v}' is a built-in name; pick another name`);
            if (program.defines.has(n.v)) throw new XytError(line, `'${n.v}' is defined twice`);
            const params = parseNamed(c, "define");
            const blk = { k: "define", name: n.v, params, body: [], anchors: [], bounded: false, line };
            program.defines.add(n.v);
            body.push(blk);
            stack.push(blk);
            break;
          }
          case "group": {
            const blk = { k: "group", attrs: parseNamed(c, "group"), body: [], line };
            body.push(blk);
            stack.push(blk);
            break;
          }
          case "camera": {
            body.push({ k: "camera", attrs: parseNamed(c, "camera"), line });
            break;
          }
          case "clip": {
            const k = c.next();
            let blk;
            if (k && k.k === "id" && pluginShape(k.v)) {
              blk = { k: "clip", type: k.v, ...pluginShapeLine(c, k.v, line, `clip ${k.v}`), body: [], line };
            } else {
              const type = k && k.k === "id" && (SHAPES[k.v] ? k.v : SHAPE_ALIASES[k.v]);
              if (!type) {
                throw new XytError(line, `clip needs a shape to draw inside, like: clip circle cx=0.5 cy=0.5 r=0.3. Shapes: ${Object.keys(SHAPES).join(", ")}`);
              }
              blk = { k: "clip", type, attrs: parseNamed(c, `clip ${type}`), body: [], line };
            }
            body.push(blk);
            stack.push(blk);
            break;
          }
          case "end": {
            if (stack.length === 1) throw new XytError(line, "'end' without a matching repeat, scene, define, group, clip, fn, sim or if");
            done("'end'");
            stack.pop();
            if (top.k === "fn" && !top.ret) throw new XytError(line, `fn ${top.name} has no return line; end it with the value it gives, like: return a * 2`);
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
            } else if (pluginShape(cmd)) {
              body.push({ k: "shape", type: cmd, ...pluginShapeLine(c, cmd, line, cmd), line });
            } else {
              const owner = loadedPlugins().find((p) => p.shapes && own(p.shapes, cmd));
              if (owner) throw new XytError(line, `${cmd} comes from the '${owner.name}' plugin: add 'use ${owner.name}' at the top of the program`);
              const official = Object.keys(KNOWN_PLUGINS).find((n) => KNOWN_PLUGINS[n].commands.includes(cmd));
              if (official) throw new XytError(line, `${cmd} comes from the '${official}' plugin: add 'use ${official}' at the top of the program, and load the plugin: ${KNOWN_PLUGINS[official].load}`);
              if (BLOCK_COMMANDS[cmd]) throw new XytError(line, `${cmd} only goes inside a ${BLOCK_COMMANDS[cmd]} block`);
              const definedLater = lines.slice(li + 1).some((l) => new RegExp(`^\\s*define\\s+${cmd.replace(/\./g, "\\.")}\\b`).test(l));
              if (definedLater) throw new XytError(line, `'${cmd}' is defined further down; move its define block above this line`);
              const known = COMMANDS.concat(LATER_COMMANDS, Object.keys(SHAPES), [...program.defines]);
              throw new XytError(line, `unknown command '${cmd}'.` + suggest(cmd, known) + ` Commands: ${COMMANDS.concat(LATER_COMMANDS).join(", ")}; shapes: ${Object.keys(SHAPES).join(", ")}` + (program.defines.size ? `; defined: ${[...program.defines].join(", ")}` : ""));
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
    const barLength = 60 / program.bpm * program.bar;
    for (const s of barScenes) {
      s.start = program.offset + (s.start - 1) * barLength;
      s.end = program.offset + s.end * barLength;
    }
    if (durationBars !== null && program.duration === null) program.duration = Math.min(program.offset + durationBars * barLength, 3600);
    const env = {
      cues: /* @__PURE__ */ new Map(),
      duration: null,
      barTime: (n, b) => program.offset + ((n - 1) * program.bar + (b - 1)) * 60 / program.bpm
    };
    for (const q of program.cues) {
      try {
        q.value = constEval(q.expr, q.line, env, `cue ${q.name}`);
        env.cues.set(q.name, q.value);
      } catch (e) {
        if (e.xyt) program.errors.push(e);
        else throw e;
      }
    }
    program.cueValues = env.cues;
    if (durationExpr) {
      try {
        const v = constEval(durationExpr.expr, durationExpr.line, env, "duration");
        if (!(v > 0)) throw new XytError(durationExpr.line, "duration must be a positive number of seconds");
        if (program.duration === null) program.duration = Math.min(v, 3600);
      } catch (e) {
        if (e.xyt) program.errors.push(e);
        else throw e;
      }
    }
    env.duration = program.duration;
    for (const s of exprScenes) {
      try {
        s.start = constEval(s.startExpr, s.line, env, "a scene time");
        s.end = constEval(s.endExpr, s.line, env, "a scene time");
        if (!(s.end > s.start)) throw new XytError(s.line, `this scene ends (${+s.end.toFixed(3)} s) before it starts (${+s.start.toFixed(3)} s)`);
      } catch (e) {
        if (!e.xyt) throw e;
        program.errors.push(e);
        s.start = 0;
        s.end = 1;
      }
    }
    if (program.duration === null) {
      const ends = root.body.filter((b) => b.k === "scene").map((b) => b.end);
      program.duration = ends.length ? Math.max(...ends) : 4;
    }
    return program;
  }

  // src/cpu.js
  var fract = (v) => v - Math.floor(v);
  var clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  var ssf = (a, b, v) => {
    const k = (v - a) / (b - a);
    if (k !== k) return v >= a ? 1 : 0;
    const c = clamp(k, 0, 1);
    return c * c * (3 - 2 * c);
  };
  var mod = (a, b) => a - b * Math.floor(a / b);
  function pw(a, b) {
    const e = Math.abs(a);
    if (b === Math.floor(b)) {
      if (e === 0) return b > 0 ? 0 : 1;
      const r = e ** b;
      return a < 0 && mod(b, 2) === 1 ? -r : r;
    }
    return a <= 0 ? 0 : a ** b;
  }
  var eIn = (v) => {
    v = clamp(v, 0, 1);
    return v * v * v;
  };
  var eOut = (v) => {
    v = 1 - clamp(v, 0, 1);
    return 1 - v * v * v;
  };
  var eBack = (v) => {
    v = clamp(v, 0, 1) - 1;
    return 1 + 2.70158 * v * v * v + 1.70158 * v * v;
  };
  var eBounce = (v) => {
    v = clamp(v, 0, 1);
    if (v < 0.36363636) return 7.5625 * v * v;
    if (v < 0.72727273) {
      v -= 0.54545455;
      return 7.5625 * v * v + 0.75;
    }
    if (v < 0.90909091) {
      v -= 0.81818182;
      return 7.5625 * v * v + 0.9375;
    }
    v -= 0.95454545;
    return 7.5625 * v * v + 0.984375;
  };
  var spring = (t, f, d) => t <= 0 ? 0 : Math.exp(-d * t) * Math.sin(6.28318531 * f * t);
  var hit = (t) => t < 0 ? 0 : Math.exp(-t * 8);
  var h11 = (p) => {
    p = fract(p * 0.1031 + 0.3183);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  };
  var h21 = (x, y) => {
    let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
    const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
    a += d;
    b += d;
    c += d;
    return fract((a + b) * c);
  };
  var h31 = (x, y, z) => {
    let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(z * 0.1031);
    const d = a * (c + 31.32) + b * (b + 31.32) + c * (a + 31.32);
    a += d;
    b += d;
    c += d;
    return fract((a + b) * c);
  };
  var smooth3 = (f) => f * f * (3 - 2 * f);
  var mixn = (a, b, k) => a + (b - a) * k;
  var vn2 = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), ux = smooth3(x - ix), uy = smooth3(y - iy);
    return mixn(mixn(h21(ix, iy), h21(ix + 1, iy), ux), mixn(h21(ix, iy + 1), h21(ix + 1, iy + 1), ux), uy);
  };
  var vn3 = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const ux = smooth3(x - ix), uy = smooth3(y - iy), uz = smooth3(z - iz);
    const a = mixn(mixn(h31(ix, iy, iz), h31(ix + 1, iy, iz), ux), mixn(h31(ix, iy + 1, iz), h31(ix + 1, iy + 1, iz), ux), uy);
    const b = mixn(mixn(h31(ix, iy, iz + 1), h31(ix + 1, iy, iz + 1), ux), mixn(h31(ix, iy + 1, iz + 1), h31(ix + 1, iy + 1, iz + 1), ux), uy);
    return mixn(a, b, uz);
  };
  var fb2 = (x, y) => {
    let s = 0, a = 0.5;
    for (let k = 0; k < 5; k++) {
      s += a * vn2(x, y);
      const nx = 1.6 * x - 1.2 * y + 17, ny = 1.2 * x + 1.6 * y + 17;
      x = nx;
      y = ny;
      a *= 0.5;
    }
    return s / 0.96875;
  };
  var fb3 = (x, y, z) => {
    let s = 0, a = 0.5;
    for (let k = 0; k < 5; k++) {
      s += a * vn3(x, y, z);
      x = x * 2.03 + 17;
      y = y * 2.03 + 17;
      z = z * 2.03 + 17;
      a *= 0.5;
    }
    return s / 0.96875;
  };
  function sampleTrack(values, step, t) {
    const pos = t / step;
    if (!(pos > 0)) return values[0];
    const i = Math.floor(pos);
    if (i >= values.length - 1) return values[values.length - 1];
    return mixn(values[i], values[i + 1], pos - i);
  }
  var UNARY = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    exp: Math.exp,
    sign: Math.sign,
    asin: (v) => Math.asin(clamp(v, -1, 1)),
    acos: (v) => Math.acos(clamp(v, -1, 1)),
    fract,
    round: (v) => Math.floor(v + 0.5),
    sqrt: (v) => Math.sqrt(Math.max(v, 0)),
    log: (v) => Math.log(Math.max(v, 1e-9)),
    saturate: (v) => clamp(v, 0, 1),
    ease: (v) => ssf(0, 1, v),
    easein: eIn,
    easeout: eOut,
    backout: eBack,
    bounce: eBounce,
    pingpong: (v) => 1 - Math.abs(fract(v) * 2 - 1)
  };
  var BINARY2 = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b,
    "%": mod,
    "^": pw,
    "<": (a, b) => +(a < b),
    ">": (a, b) => +(a > b),
    "<=": (a, b) => +(a <= b),
    ">=": (a, b) => +(a >= b),
    "==": (a, b) => +(a === b),
    "!=": (a, b) => +(a !== b),
    "&&": (a, b) => +(a !== 0 && b !== 0),
    "||": (a, b) => +(a !== 0 || b !== 0)
  };
  function buildCpu(node, ctx) {
    const E = (m) => new XytError(ctx.line, m);
    const build = (n) => buildCpu(n, ctx);
    switch (node.t) {
      case "num": {
        const v = node.v;
        return () => v;
      }
      case "hex":
        throw E(`${ctx.what} works with numbers; colors can't go here`);
      case "var":
        return ctx.resolve(node.name);
      case "neg": {
        const a = build(node.a);
        return (F, A, L) => -a(F, A, L);
      }
      case "bin": {
        const a = build(node.a), b = build(node.b), op = BINARY2[node.op];
        return (F, A, L) => op(a(F, A, L), b(F, A, L));
      }
      case "call":
        return buildCall(node, ctx, build, E);
    }
    throw E("this value could not be understood");
  }
  function buildCall(node, ctx, build, E) {
    const fn = node.fn;
    const user = ctx.fn(fn);
    if (user) {
      if (node.args.length !== user.params.length) throw E(`${fn}() takes ${user.params.length} value${user.params.length === 1 ? "" : "s"}: ${fn}(${user.params.join(", ")})`);
      const args2 = node.args.map(build), impl = user.impl;
      return (F, A, L) => impl(F, args2.map((g) => g(F, A, L)));
    }
    if (fn === "smooth") return ctx.smooth(node.args);
    if (["rgb", "gray", "hsl"].includes(fn)) throw E(`${ctx.what} works with numbers; ${fn}() makes a color`);
    const args = node.args.map(build);
    const n = args.length;
    const count = (lo, hi = lo) => {
      if (n < lo || n > hi) throw E(`${fn}() takes ${lo === hi ? lo : lo + " to " + hi} value${hi === 1 ? "" : "s"}, got ${n}`);
    };
    const [a, b, c] = args;
    if (UNARY[fn]) {
      count(1);
      const f = UNARY[fn];
      return (F, A, L) => f(a(F, A, L));
    }
    switch (fn) {
      case "atan":
        count(1, 2);
        return n === 1 ? (F, A, L) => Math.atan(a(F, A, L)) : (F, A, L) => Math.atan2(a(F, A, L), b(F, A, L));
      case "atan2":
        count(2);
        return (F, A, L) => Math.atan2(a(F, A, L), b(F, A, L));
      case "pow":
        count(2);
        return (F, A, L) => pw(a(F, A, L), b(F, A, L));
      case "min":
        count(2);
        return (F, A, L) => Math.min(a(F, A, L), b(F, A, L));
      case "max":
        count(2);
        return (F, A, L) => Math.max(a(F, A, L), b(F, A, L));
      case "mod":
        count(2);
        return (F, A, L) => mod(a(F, A, L), b(F, A, L));
      case "clamp":
        count(1, 3);
        if (n === 2) throw E("clamp() takes clamp(v) for 0 to 1, or clamp(v, low, high)");
        return n === 1 ? (F, A, L) => clamp(a(F, A, L), 0, 1) : (F, A, L) => clamp(a(F, A, L), b(F, A, L), c(F, A, L));
      case "mix":
      case "lerp":
        count(3);
        return (F, A, L) => mixn(a(F, A, L), b(F, A, L), c(F, A, L));
      case "smoothstep":
        count(3);
        return (F, A, L) => ssf(a(F, A, L), b(F, A, L), c(F, A, L));
      case "step":
        count(2);
        return (F, A, L) => b(F, A, L) < a(F, A, L) ? 0 : 1;
      case "dist":
        if (n === 2) return (F, A, L) => Math.hypot(a(F, A, L), b(F, A, L));
        count(4);
        return (F, A, L) => Math.hypot(a(F, A, L) - c(F, A, L), b(F, A, L) - args[3](F, A, L));
      case "noise":
        count(1, 3);
        return n === 3 ? (F, A, L) => vn3(a(F, A, L), b(F, A, L), c(F, A, L)) : (F, A, L) => vn2(a(F, A, L), n > 1 ? b(F, A, L) : 0);
      case "fbm":
        count(1, 3);
        return n === 3 ? (F, A, L) => fb3(a(F, A, L), b(F, A, L), c(F, A, L)) : (F, A, L) => fb2(a(F, A, L), n > 1 ? b(F, A, L) : 0);
      case "hash":
        count(1, 2);
        return n === 1 ? (F, A, L) => h11(a(F, A, L)) : (F, A, L) => h21(a(F, A, L), b(F, A, L));
      case "spring":
        count(1, 3);
        return (F, A, L) => spring(a(F, A, L), n > 1 ? b(F, A, L) : 2, n > 2 ? c(F, A, L) : 4);
      case "hits": {
        if (n < 2) throw E("hits() takes a time, then the times of the hits: hits(t, 1, 2.5, 4)");
        const times = args.slice(1);
        return (F, A, L) => {
          const t = a(F, A, L);
          let m = 0;
          for (const h of times) m = Math.max(m, hit(t - h(F, A, L)));
          return m;
        };
      }
      case "keys": {
        if (n < 5 || (n - 1) % 2 !== 0) throw E("keys() takes a time, then pairs of key time and value: keys(t, 0, 0.2, 1.5, 0.8, 3, 0.2)");
        const ks = [], vs = [];
        for (let i = 1; i < n; i += 2) {
          ks.push(args[i]);
          vs.push(args[i + 1]);
        }
        return (F, A, L) => {
          const t = a(F, A, L);
          let r = vs[0](F, A, L);
          for (let i = 1; i < ks.length; i++) r = mixn(r, vs[i](F, A, L), ssf(ks[i - 1](F, A, L), ks[i](F, A, L), t));
          return r;
        };
      }
      case "bar": {
        count(1, 2);
        const bt = ctx.bar;
        return n === 1 ? (F, A, L) => bt(a(F, A, L), 1) : (F, A, L) => bt(a(F, A, L), b(F, A, L));
      }
    }
    throw E(`unknown function '${fn}'`);
  }

  // src/frames.js
  var RECORD = 1 / 120;
  var FrameValues = class {
    /**
     * @param {object} spec
     * @param {number} spec.duration
     * @param {number} spec.step       seconds per simulation step (the smallest a sim asked for)
     * @param {number} spec.slots      number of numbers the simulation keeps
     * @param {Array<{slot?: number, track?: {values: number[], step: number}}>} spec.exposed  what the shader reads, in order
     * @param {Array<{init: Function, step: Function}>} spec.steppers  sims and smooth()s, in program order
     * @param {() => boolean} spec.usesInputs  whether the values depend on the program's inputs (known after a run)
     */
    constructor(spec) {
      this.spec = spec;
      this.names = spec.exposed.map((e) => e.name);
      this.last = null;
    }
    /** Whether the values depend on the program's inputs, so a change of input needs a new run. */
    get usesInputs() {
      return this.spec.usesInputs();
    }
    /** Simulates the whole duration with these input values. Returns a sampler with at(t). */
    run(inputs = {}) {
      const key = this.last && this.usesInputs ? JSON.stringify(inputs) : "";
      if (this.last && this.last.key === key) return this.last.sampler;
      const sampler = this.simulate(inputs);
      this.last = { key: this.usesInputs ? JSON.stringify(inputs) : "", sampler };
      return sampler;
    }
    simulate(inputs) {
      const { duration, steppers, exposed } = this.spec;
      const dt = this.spec.step;
      const per = Math.max(1, Math.round(RECORD / dt));
      const every = dt * per;
      const records = Math.floor(duration / every) + 2;
      const slots = exposed.map((e) => e.track ? -1 : e.slot);
      const width = exposed.length;
      const table = new Float32Array(records * width);
      const F = { t: 0, dt, v: new Float64Array(this.spec.slots), inputs };
      const keep = (r) => {
        for (let e = 0; e < width; e++) {
          if (slots[e] < 0) continue;
          const v = F.v[slots[e]];
          table[r * width + e] = Number.isFinite(v) ? v : 0;
        }
      };
      for (const s of steppers) s.init(F);
      keep(0);
      for (let r = 1; r < records; r++) {
        for (let k = 0; k < per; k++) {
          for (const s of steppers) s.step(F);
          F.t += dt;
        }
        F.t = r * every;
        keep(r);
      }
      const out = new Float32Array(Math.ceil(width / 4) * 4);
      return {
        table,
        at(t) {
          const pos = Math.min(Math.max(Number(t) || 0, 0), duration) / every;
          const i = Math.min(Math.floor(pos), records - 2), f = pos - i;
          for (let e = 0; e < width; e++) {
            const x = exposed[e];
            if (x.track) out[e] = sampleTrack(x.track.values, x.track.step, t);
            else out[e] = table[i * width + e] * (1 - f) + table[(i + 1) * width + e] * f;
          }
          return out;
        }
      };
    }
  };

  // src/compiler.js
  var UNARY2 = ["sin", "cos", "tan", "asin", "acos", "abs", "floor", "ceil", "fract", "exp", "sign"];
  var FUNCTIONS = UNARY2.concat([
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
    "keys",
    "spring",
    "hits",
    "bar",
    "smooth"
  ]);
  var asCol = (r) => r.t === "col" ? r.c : `vec3(${r.c})`;
  var own2 = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  var glslType = (t) => t === "col" ? "vec3" : "float";
  var BLOCKS = ["repeat", "scene", "define", "group", "clip", "fn", "sim"];
  var CALL_TRANSFORM = ["angle", "scale", "flip", "dx", "dy"];
  var FRAME_BUILTINS = ["t", "p", "dur", "beat", "pulse", "aspect", "pi", "tau"];
  var SIM_RESERVED = ["t", "dt", "pi", "tau"];
  var SIM_STEP = 1 / 240;
  var Scope = class {
    constructor(parent = null) {
      this.vars = /* @__PURE__ */ new Map();
      this.parent = parent;
    }
    get(n) {
      return this.vars.get(n) || (this.parent ? this.parent.get(n) : null);
    }
    names() {
      return [...this.vars.keys()].concat(this.parent ? this.parent.names() : []);
    }
  };
  function reservedReason(name, defines, uses = []) {
    if (BUILTINS[name]) return "a built-in value";
    if (COMMANDS.includes(name) || SHAPES[name] || uses.some((p) => p.shapes && own2(p.shapes, name))) return "a command";
    if (SCENE_VALUES.includes(name)) return "a scene value";
    if (defines && defines.has(name)) return "a define";
    return null;
  }
  function namesIn(n, out = /* @__PURE__ */ new Set()) {
    if (n.t === "var") out.add(n.name);
    else if (n.t === "neg") namesIn(n.a, out);
    else if (n.t === "bin") {
      namesIn(n.a, out);
      namesIn(n.b, out);
    } else if (n.t === "call") n.args.forEach((a) => namesIn(a, out));
    return out;
  }
  var Compiler = class {
    constructor(program) {
      this.program = program;
      this.uid = 0;
      this.out = [];
      this.funcs = [];
      this.globals = [];
      this.helpers = /* @__PURE__ */ new Map();
      this.defs = /* @__PURE__ */ new Map();
      this.fns = /* @__PURE__ */ new Map();
      this.globalNames = /* @__PURE__ */ new Map();
      this.errors = [];
      this.inDefine = null;
      this.inFn = null;
      this.fnStack = [];
      this.draws = 0;
      this.work = 0;
      this.mult = 1;
      this.lineCost = /* @__PURE__ */ new Map();
      this.warnings = [];
      this.bounded = 0;
      this.boundedExtra = 0;
      this.skipRecord = false;
      this.camStack = [];
      this.xfLevel = 0;
      this.deps = null;
      this.sceneParts = [];
      this.slots = 0;
      this.exposed = [];
      this.steppers = [];
      this.simSteps = [];
      this.hasSmooth = false;
      this.inSim = null;
      this.usesInputs = false;
    }
    record(line, k) {
      if (!this.inDefine && k > 0) this.lineCost.set(line, (this.lineCost.get(line) || 0) + k * this.mult);
    }
    error(line, msg) {
      return new XytError(line, msg);
    }
    checkName(name, line, what) {
      if (name.includes(".")) throw this.error(line, `a name can't have dots ('${name}'): dots read the values of named drawings and sims, like mila.hand.x or ball.y`);
      const why = reservedReason(name, this.program.defines, this.program.uses);
      if (why) throw this.error(line, `'${name}' is ${why}; pick another name for this ${what}`);
    }
    checkSimName(name, line, what) {
      if (SIM_RESERVED.includes(name)) throw this.error(line, `'${name}' is ${name === "t" ? "the time" : name === "dt" ? "the length of a step" : "a constant"} in a sim; pick another name for this ${what}`);
      if (!BUILTINS[name]) this.checkName(name, line, what);
    }
    // The error for a dotted name nobody gave: mila.foot.x
    unknownDotted(name, sc, line) {
      const first = name.split(".")[0], owner = sc.get(first);
      if (owner && owner.values) return this.error(line, `${first} has no '${name.slice(first.length + 1)}'. It has: ${owner.values.join(", ") || "nothing yet"}`);
      return this.error(line, `unknown name '${name}': '${first}' is not a named drawing or a sim here. Name a drawing with name=${first} to read its values and anchors, like ${first}.cx or ${first}.hand.x`);
    }
    // Inputs, cues, tracks, sims and fns share one set of names.
    checkGlobal(name, line, what) {
      this.checkName(name, line, what);
      const other = this.globalNames.get(name);
      if (other) throw this.error(line, `'${name}' is already the name of ${other}; pick another name for this ${what}`);
      this.globalNames.set(name, `${/^[aeiou]/.test(what) ? "an" : "a"} ${what}`);
    }
    noteUse(name) {
      if (this.deps) this.deps.add(name);
    }
    addFunc(name, code, deps) {
      this.funcs.push({ name, code, deps: deps || /* @__PURE__ */ new Set() });
    }
    // Runs fn with the compiler set up for a separate GLSL function body, then puts everything back.
    inBody(setup, fn) {
      const saved = {
        out: this.out,
        deps: this.deps,
        work: this.work,
        inDefine: this.inDefine,
        inFn: this.inFn,
        camStack: this.camStack,
        xfLevel: this.xfLevel,
        mult: this.mult
      };
      this.out = [];
      this.deps = /* @__PURE__ */ new Set();
      this.work = 0;
      this.camStack = [];
      this.xfLevel = 0;
      this.mult = 1;
      Object.assign(this, setup);
      try {
        return fn();
      } finally {
        const body = { out: this.out, deps: this.deps, work: this.work };
        Object.assign(this, saved);
        this.lastBody = body;
      }
    }
    // ---------- per-frame values ----------
    slot() {
      return this.slots++;
    }
    // The shader reads exposed values from one uniform array of vec4s.
    expose(entry) {
      if (this.exposed.length >= LIMITS.frameValues) throw this.error(entry.line || 0, `a program can have up to ${LIMITS.frameValues} sim states, tracks and smooth() values`);
      this.exposed.push(entry);
      const e = this.exposed.length - 1;
      return `u_fv[${e >> 2}].${"xyzw"[e & 3]}`;
    }
    // A formula as a CPU closure, for values that must be the same for every pixel of a frame.
    cpuExpr(node, sc, line, what) {
      return buildCpu(node, {
        line,
        what,
        resolve: (name) => this.cpuName(name, sc, line, what),
        fn: (name) => this.fns.has(name) ? this.cpuFn(name, line, what) : null,
        bar: (n, b) => this.barTime(n, b),
        smooth: (args) => this.hoistSmooth(args, sc, line).cpu
      });
    }
    cpuName(name, sc, line, what) {
      const v = sc.get(name);
      if (v) return this.cpuOf(v, name, line, what);
      if (FRAME_BUILTINS.includes(name)) {
        const D = this.program.duration, bps = this.program.bpm / 60, off = this.program.offset, aspect = this.program.aspect;
        return {
          t: (F) => F.t,
          p: (F) => F.t / D,
          dur: () => D,
          aspect: () => aspect,
          pi: () => Math.PI,
          tau: () => Math.PI * 2,
          beat: (F) => (F.t - off) * bps,
          pulse: (F) => {
            const b = (F.t - off) * bps;
            return b < 0 ? 0 : Math.exp(-(b - Math.floor(b)) * 5);
          }
        }[name];
      }
      if (BUILTINS[name]) throw this.error(line, `${what} uses '${name}', which changes from pixel to pixel (or with the pointer); it needs values that are the same for the whole frame`);
      if (NAMED_COLORS[name]) throw this.error(line, `${what} works with numbers; '${name}' is a color`);
      if (SCENE_VALUES.includes(name)) throw this.error(line, `'${name}' only exists inside a scene block`);
      if (name.includes(".")) throw this.unknownDotted(name, sc, line);
      throw this.error(line, `unknown name '${name}'.` + suggest(name, sc.names()));
    }
    cpuOf(v, name, line, what) {
      if (v.cpu) return v.cpu;
      if (v.failed) throw this.error(line, v.failed);
      if (v.ast) {
        const binds = v.binds;
        const scope = { get: (n) => binds.get(n) || null, names: () => [...binds.keys()] };
        try {
          v.cpu = this.cpuExpr(v.ast, scope, v.line, what);
        } catch (e) {
          if (!e.xyt) throw e;
          v.failed = `${what} uses '${name}', and ${e.message.replace(/^unknown name/, "that uses an unknown name")}`;
          throw this.error(line, v.failed);
        }
        return v.cpu;
      }
      if (v.t === "point") throw this.error(line, `'${name}' is a point; use ${name}.x and ${name}.y`);
      if (v.t === "col") throw this.error(line, `${what} works with numbers; '${name}' is a color`);
      throw this.error(line, `${what} uses '${name}', which changes from pixel to pixel (it depends on x or y, a loop counter or a drawing); it needs values that are the same for the whole frame`);
    }
    // A fn as a CPU closure impl(F, args).
    cpuFn(name, line, what) {
      const f = this.fns.get(name);
      if (f.cpu) return f.cpu;
      if (this.fnStack.includes(name)) throw this.error(line, `fn ${name} can't use itself`);
      this.fnStack.push(name);
      try {
        const scope = new Scope(this.root);
        f.node.params.forEach((p, i) => scope.vars.set(p, { t: "num", cpu: (F, A) => A[i] }));
        const lets = f.node.body.map((l, j) => {
          const g = this.cpuExpr(l.expr, scope, l.line, what);
          scope.vars.set(l.name, { t: "num", cpu: (F, A, L) => L[j] });
          return g;
        });
        const ret = this.cpuExpr(f.node.ret, scope, f.node.retLine, what);
        const n = lets.length;
        f.cpu = {
          params: f.node.params,
          impl: (F, A) => {
            const L = n ? new Array(n) : null;
            for (let j = 0; j < n; j++) L[j] = lets[j](F, A, L);
            return ret(F, A, L);
          }
        };
        return f.cpu;
      } finally {
        this.fnStack.pop();
      }
    }
    barTime(n, b) {
      const P = this.program;
      return P.offset + ((n - 1) * P.bar + (b - 1)) * 60 / P.bpm;
    }
    // smooth(value, seconds): value followed by a critically damped spring, worked out on the CPU.
    hoistSmooth(args, sc, line) {
      if (this.inDefine || this.inFn) {
        throw this.error(line, "smooth() works in scenes and at the top level, not inside a define or fn: smooth there and pass the result in as a value");
      }
      if (this.inSim) throw this.error(line, `smooth() can't go inside a sim; follow a value with a state there, like: v += (target - v) * 4 * dt`);
      this.hasSmooth = true;
      if (args.length !== 2) throw this.error(line, "smooth() takes a value and about how many seconds it lags behind: smooth(PX, 0.5)");
      const target = this.cpuExpr(args[0], sc, line, "smooth()");
      const secs = this.cpuExpr(args[1], sc, line, "smooth()");
      const pos = this.slot(), vel = this.slot();
      this.steppers.push({
        init: (F) => {
          F.v[pos] = target(F);
          F.v[vel] = 0;
        },
        // the exact solution over one step, so any lag and step are stable
        step: (F) => {
          const w = 4 / Math.max(secs(F), 0.02), goal = target(F), dt = F.dt;
          const c1 = F.v[pos] - goal, c2 = F.v[vel] + w * c1, e = Math.exp(-w * dt);
          F.v[pos] = goal + (c1 + c2 * dt) * e;
          F.v[vel] = (c2 - w * (c1 + c2 * dt)) * e;
        },
        work: 6
      });
      const c = this.expose({ slot: pos, name: "smooth", line });
      return { c, cpu: (F) => F.v[pos] };
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
          if (v) {
            if (v.t === "point") throw E(`'${n.name}' is a point; use ${n.name}.x and ${n.name}.y, or attach=${n.name} to place a shape on it`);
            if (v.t === "instance") throw E(`'${n.name}' is a named drawing; read its values like ${n.name}.${v.values[0] || "cx"}`);
            if (v.t === "sim") throw E(`'${n.name}' is a sim; read its states like ${n.name}.${v.values[0] || "y"}`);
            if (v.c === null) throw E(`'${n.name}' only exists inside its sim`);
            return v;
          }
          if (BUILTINS[n.name]) return { c: BUILTINS[n.name], t: "num" };
          if (NAMED_COLORS[n.name]) return { c: vec3(parseHex(NAMED_COLORS[n.name])), t: "col" };
          if (FUNCTIONS.includes(n.name) || this.fns.has(n.name)) throw E(`${n.name} is a function: write ${n.name}(...)`);
          if (SCENE_VALUES.includes(n.name)) {
            throw E(this.inDefine ? `'${n.name}' is not available inside define ${this.inDefine}; pass it in as a value` : this.inFn ? `'${n.name}' is not available inside fn ${this.inFn}; pass it in as a value` : `'${n.name}' only exists inside a scene block`);
          }
          if (n.name.includes(".")) throw this.unknownDotted(n.name, sc, line);
          const known = sc.names().concat(Object.keys(BUILTINS), Object.keys(NAMED_COLORS));
          const hint = this.inDefine ? ` Inside define ${this.inDefine}, only its own values, inputs and built-ins exist; pass other values in.` : this.inFn ? ` Inside fn ${this.inFn}, only its own values, inputs and built-ins exist; pass other values in.` : " Define it first with let.";
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
      if (this.fns.has(fn)) return this.fnCall(n, sc, line);
      if (!FUNCTIONS.includes(fn)) {
        if (this.program.defines.has(fn)) throw E(`${fn} is a define: draw it on its own line, like: ${fn} cx=0.5`);
        if (this.program.fns.has(fn)) throw E(`fn ${fn} is written further down; move it above this line`);
        throw E(`unknown function '${fn}'.` + suggest(fn, FUNCTIONS.concat([...this.fns.keys()])));
      }
      if (fn === "smooth") {
        const { c: c2, cpu } = this.hoistSmooth(n.args, sc, line);
        return { c: c2, t: "num", cpu };
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
      if (UNARY2.includes(fn)) {
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
        case "spring":
          count(1, 3);
          nums();
          return { c: `spring(${c(0)},${args.length > 1 ? c(1) : "2.0"},${args.length > 2 ? c(2) : "4.0"})`, t: "num" };
        case "hits":
          if (args.length < 2) throw E("hits() takes a time, then the times of the hits: hits(t, 1, 2.5, 4)");
          nums();
          return { c: args.slice(1).map((a) => `hit(${c(0)} - ${a.c})`).reduce((x, y) => `max(${x},${y})`), t: "num" };
        case "bar": {
          if (args.length < 1 || args.length > 2) throw E("bar() takes the bar, and optionally the beat, counting from 1: bar(9) or bar(9, 3)");
          nums();
          const P = this.program, beat = 60 / P.bpm;
          return { c: `(${fmt(P.offset)} + (${c(0)} - 1.0) * ${fmt(beat * P.bar)} + (${args.length > 1 ? c(1) : "1.0"} - 1.0) * ${fmt(beat)})`, t: "num" };
        }
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
    // ---------- fn: a formula with its own values, compiled once per kind of value it is given ----------
    fnCall(n, sc, line) {
      const E = (m) => this.error(line, m);
      const f = this.fns.get(n.fn);
      const params = f.node.params;
      if (n.args.length !== params.length) {
        throw E(`${n.fn}() takes ${params.length} value${params.length === 1 ? "" : "s"}: ${n.fn}(${params.join(", ")})`);
      }
      const args = n.args.map((a) => this.ex(a, sc, line));
      const spec = this.fnSpec(f, args.map((a) => a.t), line);
      if (spec.failed) throw E(`${n.fn}() can't be used because its fn has a problem`);
      this.work += spec.work;
      this.noteUse(spec.fname);
      return { c: `${spec.fname}(${args.map((a) => a.c).join(",")})`, t: spec.t };
    }
    fnSpec(f, types, line) {
      const sig = types.join(",");
      if (this.fnStack.includes(f.node.name)) throw this.error(line, `fn ${f.node.name} can't use itself`);
      if (f.specs.has(sig)) return f.specs.get(sig);
      const fname = `F_${glslName(f.node.name)}_${f.specs.size}`;
      const spec = { fname, t: "num", work: 0, failed: false };
      f.specs.set(sig, spec);
      this.fnStack.push(f.node.name);
      try {
        this.inBody({ inFn: f.node.name, inDefine: null }, () => {
          const scope = new Scope(this.root);
          f.node.params.forEach((p, i) => scope.vars.set(p, { c: `a_${glslName(p)}`, t: types[i] }));
          for (const l of f.node.body) {
            this.checkName(l.name, l.line, "value");
            const r2 = this.ex(l.expr, scope, l.line);
            const g = `v_${glslName(l.name)}_${++this.uid}`;
            this.out.push(`  ${glslType(r2.t)} ${g} = ${r2.c};`);
            scope.vars.set(l.name, { c: g, t: r2.t });
          }
          const r = this.ex(f.node.ret, scope, f.node.retLine);
          spec.t = r.t;
          this.out.push(`  return ${r.c};`);
        });
        const body = this.lastBody;
        spec.work = body.work;
        const ps = f.node.params.map((p, i) => `${glslType(types[i])} a_${glslName(p)}`).join(", ");
        this.addFunc(fname, `${glslType(spec.t)} ${fname}(${ps}) {
${body.out.join("\n")}
}`, body.deps);
      } catch (e) {
        if (!e.xyt) throw e;
        spec.failed = true;
        if (!f.reported) {
          f.reported = true;
          this.errors.push(e);
        }
      } finally {
        this.fnStack.pop();
      }
      return spec;
    }
    // ---------- statements; each returns its cost (shape evaluations per pixel) ----------
    stmts(list, sc, ind) {
      let cost = 0, sceneMax = 0;
      const block = { camera: 0 };
      for (const s of list) {
        try {
          const work = this.work;
          this.skipRecord = false;
          let k = this.stmt(s, sc, ind, block);
          if (!BLOCKS.includes(s.k)) {
            k += this.work - work;
            if (!this.skipRecord) this.record(s.line, k);
          }
          if (s.k === "scene") sceneMax = Math.max(sceneMax, k);
          else cost += k;
        } catch (e) {
          if (!e.xyt) throw e;
          this.errors.push(e);
          if (s.k === "let" && !sc.vars.has(s.name)) sc.vars.set(s.name, { c: "0.0", t: "num" });
        }
        if (this.errors.length > 20) break;
      }
      if (block.camera) {
        this.out.push(`${ind}${this.restore(block.camera)}`);
        this.camStack.pop();
      }
      return cost + sceneMax;
    }
    stmt(s, sc, ind, block) {
      const E = (m) => this.error(s.line, m);
      const o = this.out;
      switch (s.k) {
        case "let": {
          this.checkName(s.name, s.line, "value");
          const r = this.ex(s.expr, sc, s.line);
          const g = `v_${glslName(s.name)}_${++this.uid}`;
          o.push(`${ind}${glslType(r.t)} ${g} = ${r.c};`);
          const entry = { c: g, t: r.t };
          if (r.cpu) entry.cpu = r.cpu;
          else if (!this.inDefine && !this.inFn && r.t === "num") {
            entry.ast = s.expr;
            entry.line = s.line;
            entry.binds = new Map([...namesIn(s.expr)].map((n) => [n, sc.get(n)]).filter(([, v]) => v));
          }
          sc.vars.set(s.name, entry);
          return 0;
        }
        case "repeat": {
          this.checkName(s.name, s.line, "loop counter");
          if (s.count > LIMITS.repeat) throw E(`repeat counts up to ${LIMITS.repeat}; use a smaller count`);
          const id = ++this.uid, g = `v_${glslName(s.name)}_${id}`;
          o.push(`${ind}for (int k_${id} = 0; k_${id} < ${s.count}; k_${id}++) { float ${g} = float(k_${id});`);
          const inner = new Scope(sc);
          inner.vars.set(s.name, { c: g, t: "num" });
          const mult = this.mult;
          this.mult *= s.count;
          let cost;
          try {
            cost = this.stmts(s.body, inner, ind + "  ");
          } finally {
            this.mult = mult;
          }
          o.push(`${ind}}`);
          return cost * s.count;
        }
        case "scene": {
          const id = ++this.uid, a = fmt(s.start), b = fmt(s.end);
          const deps = this.deps, from = o.length;
          this.deps = /* @__PURE__ */ new Set();
          o.push(`${ind}if (T >= ${a} && T < ${b}) { vec3 sv_${id} = col;`);
          o.push(`${ind}  float v_st_${id} = T - ${a}; float v_sp_${id} = v_st_${id} / ${fmt(s.end - s.start)}; float v_sb_${id} = v_st_${id} * ${fmt(this.program.bpm / 60)};`);
          const inner = new Scope(sc);
          const start = s.start, len = s.end - s.start, bps = this.program.bpm / 60;
          inner.vars.set("st", { c: `v_st_${id}`, t: "num", cpu: (F) => F.t - start });
          inner.vars.set("sp", { c: `v_sp_${id}`, t: "num", cpu: (F) => (F.t - start) / len });
          inner.vars.set("sb", { c: `v_sb_${id}`, t: "num", cpu: (F) => (F.t - start) * bps });
          let cost;
          try {
            cost = this.stmts(s.body, inner, ind + "  ");
          } finally {
            let fade = "";
            if (s.fadein > 0) fade += ` * clamp(v_st_${id} / ${fmt(s.fadein)}, 0.0, 1.0)`;
            if (s.fadeout > 0) fade += ` * clamp((${b} - T) / ${fmt(s.fadeout)}, 0.0, 1.0)`;
            if (fade) o.push(`${ind}  col = mix(sv_${id}, col, 1.0${fade});`);
            o.push(`${ind}}`);
            this.sceneParts.push({ start: s.start, end: s.end, from, to: o.length, deps: this.deps });
            this.deps = deps;
          }
          return cost;
        }
        case "define":
          return this.define(s);
        case "fn": {
          if (FUNCTIONS.includes(s.name)) throw E(`'${s.name}' is a built-in function; pick another name for this fn`);
          if (this.program.defines.has(s.name)) throw E(`'${s.name}' is a define; pick another name for this fn`);
          this.checkGlobal(s.name, s.line, "fn");
          const f = { node: s, specs: /* @__PURE__ */ new Map(), reported: false };
          this.fns.set(s.name, f);
          this.fnSpec(f, s.params.map(() => "num"), s.line);
          return 0;
        }
        case "sim":
          this.sim(s);
          return 0;
        case "anchor": {
          this.anchorValues(s, sc);
          return 0;
        }
        case "bounds": {
          const { v, num } = this.namedValues(s, sc, BOUNDS, "bounds");
          for (const k of ["cx", "cy", "r"]) if (!v[k]) throw E(`bounds needs cx, cy and r: the circle the whole drawing stays within, like: bounds cx=cx cy=cy r=0.3 * s`);
          const back = this.camStack.length ? ` ${this.restore(this.camStack[0].save)}` : "";
          o.push(`${ind}if (length(PP - vec2(${num("cx")}, ${num("cy")})) - abs(${num("r")}) > PX) {${back} return col; }`);
          return 0;
        }
        case "group": {
          const work = this.work;
          const attrs = Object.assign({}, s.attrs);
          const depth = attrs.depth;
          delete attrs.depth;
          const t = this.transformValues(attrs, sc, s.line, "group");
          const ownCost = this.work - work;
          this.record(s.line, ownCost);
          if (!s.body.length) throw E("this group is empty; put shapes between it and 'end'");
          const id = ++this.uid;
          o.push(`${ind}{ ${this.save(id)}`);
          if (depth) {
            const cam = this.camStack[this.camStack.length - 1];
            if (!cam) throw E("depth makes a group follow the camera more slowly when it is farther: it needs a camera line above it, in this block or scene");
            if (this.xfLevel !== cam.level) throw E("a group with depth must sit directly in its camera's block, not inside another group");
            const d = this.ex(depth, sc, s.line);
            if (d.t === "col") throw E("'depth' must be a number, not a color");
            const j = ++this.uid, c = cam.tid;
            o.push(
              `${ind}  PP = sp_${cam.save}; PX = spx_${cam.save};`,
              `${ind}  float dk_${j} = 1.0 / max(${d.c}, 0.01);`,
              `${ind}  vec2 tc_${j} = tc_${c}; float ts_${j} = sign(ts_${c}) * pow(abs(ts_${c}), dk_${j}); float tf_${j} = tf_${c}; float ta_${j} = ta_${c}; vec2 td_${j} = td_${c} * dk_${j};`,
              ...this.applyVars(j, ind + "  ")
            );
          }
          if (Object.keys(attrs).length || !depth) o.push(...this.applyTransform(t, ind + "  ", ++this.uid));
          this.xfLevel++;
          let cost;
          try {
            cost = this.stmts(s.body, new Scope(sc), ind + "  ");
          } finally {
            this.xfLevel--;
          }
          o.push(`${ind}  ${this.restore(id)} }`);
          return ownCost + cost;
        }
        case "camera": {
          const t = this.transformValues(s.attrs, sc, s.line, "camera");
          const tid = ++this.uid;
          if (block.camera) {
            o.push(`${ind}${this.restore(block.camera)}`);
            this.camStack[this.camStack.length - 1].tid = tid;
          } else {
            block.camera = ++this.uid;
            o.push(`${ind}${this.save(block.camera)}`);
            this.camStack.push({ save: block.camera, tid, level: this.xfLevel });
          }
          o.push(...this.applyTransform(t, ind, tid));
          return 0;
        }
        case "clip": {
          const work = this.work;
          const { v, num, fixed } = this.shapeValues(s, sc, CLIP_OPTIONS, `clip ${s.type}`);
          const ownCost = (s.def && s.def.cost ? s.def.cost(s.str, fixed) : 1) + this.work - work;
          this.record(s.line, ownCost);
          if (!s.body.length) throw E(`this clip ${s.type} is empty; put shapes between it and 'end'`);
          const id = ++this.uid;
          o.push(`${ind}{ vec3 cs_${id} = col; float cc_${id};`, ...this.coverage(s, v, num, ind + "  ", fixed));
          o.push(`${ind}    cc_${id} = ${v.invert ? `mix(cv, 1.0 - cv, clamp(${num("invert")}, 0.0, 1.0))` : "cv"}; }`);
          o.push(`${ind}  if (cc_${id} > 0.0) {`);
          const cost = this.stmts(s.body, new Scope(sc), ind + "    ");
          o.push(`${ind}    col = mix(cs_${id}, col, cc_${id});`, `${ind}  } }`);
          return ownCost + cost;
        }
        case "call":
          return this.callDefine(s, sc, ind);
        case "fill":
          return this.fill(s, sc, ind);
        case "shape":
          return this.shape(s, sc, ind);
      }
      throw E("this line could not be understood");
    }
    // A define drawn on a line: `hero cx=0.3 name=mila attach=boat.seat angle=20`
    callDefine(s, sc, ind) {
      const E = (m) => this.error(s.line, m);
      const o = this.out;
      if (s.name === this.inDefine) throw E(`'${s.name}' can't be used inside its own define`);
      const d = this.defs.get(s.name);
      if (!d) throw E(`'${s.name}' can't be drawn because its define has a problem`);
      const names = d.params.map((q) => q.name);
      const moves = {};
      let attrs = s.attrs, instance = null;
      for (const a of Object.keys(s.attrs)) {
        if (names.includes(a)) continue;
        if (CALL_TRANSFORM.includes(a)) {
          moves[a] = s.attrs[a];
          continue;
        }
        if (a === "name") {
          instance = this.instanceName(s.attrs.name, s.line);
          continue;
        }
        if (a === "attach") continue;
        throw E(`${s.name} has no '${a}'.` + suggest(a, names.concat(CALL_TRANSFORM, ["name", "attach"])) + ` It takes: ${names.join(", ")}; ${CALL_TRANSFORM.join(", ")} to turn, scale, mirror or move it; name= to read its values below; attach= to place it on a point`);
      }
      if (own2(s.attrs, "attach") && !names.includes("attach")) {
        if (!names.includes("cx") || !names.includes("cy")) throw E(`attach places a drawing by its cx and cy, and define ${s.name} has no cx and cy values`);
        attrs = this.attachTo(s.attrs, ["cx", "cy"], sc, s.line);
      }
      let args = d.params.map((q) => {
        if (!attrs[q.name]) return q.def;
        const r = this.ex(attrs[q.name], sc, s.line);
        if (q.t === "num" && r.t === "col") throw E(`'${q.name}' must be a number, not a color`);
        return q.t === "col" ? asCol(r) : r.c;
      });
      const id = ++this.uid;
      if (instance) {
        args = args.map((a, i) => {
          const g = `n_${id}_${i}`;
          o.push(`${ind}${glslType(d.params[i].t)} ${g} = ${a};`);
          return g;
        });
      }
      const call = `col = ${d.fname}(col${args.map((a) => ", " + a).join("")});`;
      this.noteUse(d.fname);
      let tid = null;
      if (Object.keys(moves).length) {
        const at = (n) => {
          const i = names.indexOf(n);
          return i >= 0 && d.params[i].t === "num" ? `(${args[i]})` : null;
        };
        const t = this.transformValues(moves, sc, s.line, s.name, { cx: at("cx"), cy: at("cy") });
        tid = ++this.uid;
        o.push(`${ind}${this.save(id)}`, ...this.applyTransform(t, ind, tid), `${ind}${call}`, `${ind}${this.restore(id)}`);
      } else o.push(`${ind}${call}`);
      if (instance) this.nameInstance(instance, d, args, tid, sc, ind, s.line);
      this.draws++;
      if (!this.inDefine && this.mult > 1 && d.cost * this.mult >= LIMITS.warnLine) {
        this.warnings.push({ line: s.line, message: `${s.name} costs about ${d.cost} shapes and repeat draws it ${this.mult} times, so this line alone costs about ${d.cost * this.mult} per pixel` });
      }
      if (d.bounded) {
        this.bounded = Math.max(this.bounded, d.cost);
        if (!this.inDefine) this.boundedExtra += (d.cost - 1) * this.mult;
        this.record(s.line, d.cost);
        this.skipRecord = true;
        return 1;
      }
      return d.cost;
    }
    instanceName(node, line) {
      if (node.t !== "var" || node.name.includes(".")) {
        throw this.error(line, "name= takes a plain name for this drawing, like name=mila; the lines below then read its values and anchors, like mila.cx or mila.hand.x");
      }
      this.checkName(node.name, line, "drawing");
      const other = this.globalNames.get(node.name);
      if (other) throw this.error(line, `'${node.name}' is already the name of ${other}; pick another name for this drawing`);
      return node.name;
    }
    // The values of a named drawing, for the lines below it: mila.cx, mila.hand, mila.hand.x, mila.hand.angle
    nameInstance(name, d, args, tid, sc, ind, line) {
      const values = [];
      d.params.forEach((q, i) => {
        sc.vars.set(`${name}.${q.name}`, { c: args[i], t: q.t });
        values.push(q.name);
      });
      if (d.anchors.length) {
        const pname = this.anchorFn(d, line);
        this.noteUse(pname);
        this.out.push(`${ind}${pname}(${args.join(", ")});`);
        for (const a of d.anchors) {
          const g = `i_${++this.uid}`;
          this.out.push(`${ind}vec3 ${g} = AN_${glslName(d.name)}_${glslName(a)};`);
          if (tid !== null) {
            this.out.push(`${ind}${g}.xy = fwd(${g}.xy, tc_${tid}, ts_${tid}, tf_${tid}, ta_${tid}, td_${tid}); ${g}.z = (tf_${tid} < 0.0 ? 180.0 - ${g}.z : ${g}.z) + ta_${tid} + (ts_${tid} < 0.0 ? 180.0 : 0.0);`);
          }
          const point = { t: "point", x: `${g}.x`, y: `${g}.y`, angle: `${g}.z` };
          sc.vars.set(`${name}.${a}`, point);
          sc.vars.set(`${name}.${a}.x`, { c: point.x, t: "num" });
          sc.vars.set(`${name}.${a}.y`, { c: point.y, t: "num" });
          sc.vars.set(`${name}.${a}.angle`, { c: point.angle, t: "num" });
          values.push(a, `${a}.x`, `${a}.y`, `${a}.angle`);
        }
      }
      sc.vars.set(name, { t: "instance", values, c: null });
    }
    // attach=mila.hand: the point's x and y become the values named in keys (cx, cy, or x, y for text).
    attachTo(attrs, keys, sc, line) {
      const node = attrs.attach;
      const E = (m) => this.error(line, m);
      const point = node.t === "var" ? sc.get(node.name) : null;
      if (!point || point.t !== "point") {
        throw E(`attach= takes a point of a named drawing, like attach=mila.hand (draw it with name=mila; its define has: anchor hand x=... y=...)`);
      }
      for (const k of keys) if (attrs[k]) throw E(`attach= sets ${keys.join(" and ")}; leave ${k} out`);
      const out = Object.assign({}, attrs);
      delete out.attach;
      out[keys[0]] = { t: "var", name: node.name + ".x" };
      out[keys[1]] = { t: "var", name: node.name + ".y" };
      return out;
    }
    // The values of an anchor line, checked: x, y and angle.
    anchorValues(s, sc) {
      const { v, num } = this.namedValues(s, sc, ANCHOR, `anchor ${s.name}`);
      if (!v.x || !v.y) throw this.error(s.line, `anchor ${s.name} needs x and y: the point, in the define's own coordinates, like: anchor ${s.name} x=cx + 0.1 * s y=cy`);
      return num;
    }
    // A GLSL function that works out a define's anchors from its values, without drawing anything:
    // its lets, the groups and cameras around each anchor, and the anchors of drawings it names.
    anchorFn(d, line) {
      if (d.pfn) return d.pfn;
      const pname = `P_${glslName(d.name)}`;
      for (const a of d.anchors) this.globals.push(`vec3 AN_${glslName(d.name)}_${glslName(a)};`);
      try {
        this.inBody({ inDefine: d.name, inFn: null }, () => {
          const body = new Scope(this.root);
          for (const q of d.params) body.vars.set(q.name, { c: `a_${glslName(q.name)}`, t: q.t });
          this.anchorStmts(d.node.body, body, "  ", [], d);
        });
      } catch (e) {
        if (!e.xyt || !this.errors.length) throw e;
      }
      const b = this.lastBody;
      const ps = d.params.map((q) => `${glslType(q.t)} a_${glslName(q.name)}`).join(", ");
      this.addFunc(pname, `void ${pname}(${ps}) {
${b.out.join("\n")}
}`, b.deps);
      d.pfn = pname;
      return pname;
    }
    anchorStmts(list, sc, ind, xf, d, outerCam = null) {
      let cur = xf.slice(), cam = null;
      const o = this.out;
      for (const s of list) {
        switch (s.k) {
          case "let":
            this.stmt(s, sc, ind, {});
            break;
          case "group": {
            const attrs = Object.assign({}, s.attrs);
            const depth = attrs.depth;
            delete attrs.depth;
            const id = ++this.uid;
            o.push(`${ind}{ ${this.save(id)}`);
            let inner = cur;
            const c = cam || outerCam;
            if (depth && c) {
              const dv = this.ex(depth, sc, s.line), j = ++this.uid;
              o.push(
                `${ind}  PP = sp_${c.save}; PX = spx_${c.save};`,
                `${ind}  float dk_${j} = 1.0 / max(${dv.c}, 0.01);`,
                `${ind}  vec2 tc_${j} = tc_${c.tid}; float ts_${j} = sign(ts_${c.tid}) * pow(abs(ts_${c.tid}), dk_${j}); float tf_${j} = tf_${c.tid}; float ta_${j} = ta_${c.tid}; vec2 td_${j} = td_${c.tid} * dk_${j};`,
                ...this.applyVars(j, ind + "  ")
              );
              inner = cur.filter((x) => x !== c.tid).concat([j]);
            }
            if (Object.keys(attrs).length || !depth) {
              const tid = ++this.uid;
              o.push(...this.applyTransform(this.transformValues(attrs, sc, s.line, "group"), ind + "  ", tid));
              inner = inner.concat([tid]);
            }
            this.anchorStmts(s.body, new Scope(sc), ind + "  ", inner, d, depth ? null : c);
            o.push(`${ind}  ${this.restore(id)} }`);
            break;
          }
          case "camera": {
            const tid = ++this.uid;
            if (cam) o.push(`${ind}${this.restore(cam.save)}`);
            else {
              cam = { save: ++this.uid };
              o.push(`${ind}${this.save(cam.save)}`);
            }
            o.push(...this.applyTransform(this.transformValues(s.attrs, sc, s.line, "camera"), ind, tid));
            cur = cur.filter((x) => x !== cam.tid).concat([tid]);
            cam.tid = tid;
            break;
          }
          case "anchor": {
            const num = this.anchorValues(s, sc);
            const lines = [`${ind}{ vec2 ap = vec2(${num("x")}, ${num("y")}); float aa = ${num("angle")};`];
            for (const x of cur.slice().reverse()) {
              lines.push(`${ind}  ap = fwd(ap, tc_${x}, ts_${x}, tf_${x}, ta_${x}, td_${x}); aa = (tf_${x} < 0.0 ? 180.0 - aa : aa) + ta_${x} + (ts_${x} < 0.0 ? 180.0 : 0.0);`);
            }
            lines.push(`${ind}  AN_${glslName(d.name)}_${glslName(s.name)} = vec3(ap, aa); }`);
            o.push(...lines);
            break;
          }
          case "call": {
            if (!s.attrs.name) break;
            const sub = this.defs.get(s.name);
            if (!sub) break;
            const instance = this.instanceName(s.attrs.name, s.line);
            const attrs = own2(s.attrs, "attach") && !sub.params.some((q) => q.name === "attach") ? this.attachTo(s.attrs, ["cx", "cy"], sc, s.line) : s.attrs;
            const id = ++this.uid;
            const args = sub.params.map((q, i) => {
              const a = attrs[q.name] ? q.t === "col" ? asCol(this.ex(attrs[q.name], sc, s.line)) : this.ex(attrs[q.name], sc, s.line).c : q.def;
              const g = `n_${id}_${i}`;
              o.push(`${ind}${glslType(q.t)} ${g} = ${a};`);
              return g;
            });
            const moves = {};
            for (const k of CALL_TRANSFORM) if (s.attrs[k] && !sub.params.some((q) => q.name === k)) moves[k] = s.attrs[k];
            let tid = null;
            if (Object.keys(moves).length) {
              const names = sub.params.map((q) => q.name);
              const at = (n) => {
                const i = names.indexOf(n);
                return i >= 0 && sub.params[i].t === "num" ? `(${args[i]})` : null;
              };
              tid = ++this.uid;
              const t = this.transformValues(moves, sc, s.line, s.name, { cx: at("cx"), cy: at("cy") });
              o.push(`${ind}vec2 tc_${tid} = vec2(${t.cx}, ${t.cy}); float ts_${tid} = ${t.scale}; float tf_${tid} = ${t.flip}; float ta_${tid} = ${t.angle}; vec2 td_${tid} = vec2(${t.dx}, ${t.dy});`);
            }
            this.nameInstance(instance, sub, args, tid, sc, ind, s.line);
            break;
          }
          default:
            break;
        }
      }
      if (cam) o.push(`${ind}${this.restore(cam.save)}`);
    }
    // ---------- sim: values worked out step by step before the first frame ----------
    sim(s) {
      this.checkGlobal(s.name, s.line, "sim");
      const scope = new Scope(this.root);
      scope.vars.set("dt", { c: null, t: "num", cpu: (F) => F.dt });
      const states = /* @__PURE__ */ new Map(), inits = [];
      let work = 0;
      const compileList = (list, sc, top = false) => {
        const out = [];
        for (const st of list) {
          try {
            const build = (node) => this.cpuExpr(node, sc, st.line, `sim ${s.name}`);
            switch (st.k) {
              case "state": {
                this.checkSimName(st.name, st.line, "state");
                if (states.has(st.name)) throw this.error(st.line, `state '${st.name}' is declared twice`);
                const slot = this.slot(), init = build(st.expr);
                states.set(st.name, slot);
                sc.vars.set(st.name, { c: null, t: "num", cpu: (F) => F.v[slot] });
                inits.push((F) => {
                  F.v[slot] = init(F);
                });
                break;
              }
              case "let": {
                this.checkSimName(st.name, st.line, "value");
                const slot = this.slot(), f = build(st.expr);
                sc.vars.set(st.name, { c: null, t: "num", cpu: (F) => F.v[slot] });
                out.push((F) => {
                  F.v[slot] = f(F);
                });
                if (top) inits.push((F) => {
                  F.v[slot] = f(F);
                });
                work++;
                break;
              }
              case "set": {
                const slot = states.get(st.name);
                if (slot === void 0) {
                  throw this.error(st.line, `'${st.name}' is not a state of sim ${s.name}; declare it above with: state ${st.name} = 0` + suggest(st.name, [...states.keys()]));
                }
                const f = build(st.expr);
                const op = {
                  "=": (F) => {
                    F.v[slot] = f(F);
                  },
                  "+": (F) => {
                    F.v[slot] += f(F);
                  },
                  "-": (F) => {
                    F.v[slot] -= f(F);
                  },
                  "*": (F) => {
                    F.v[slot] *= f(F);
                  },
                  "/": (F) => {
                    const b = f(F);
                    F.v[slot] = b === 0 ? 0 : F.v[slot] / b;
                  }
                }[st.op];
                out.push(op);
                work++;
                break;
              }
              case "if": {
                const cond = build(st.cond);
                const a = compileList(st.then, new Scope(sc)), b = st.other ? compileList(st.other, new Scope(sc)) : [];
                out.push((F) => {
                  const list2 = cond(F) !== 0 ? a : b;
                  for (let i = 0; i < list2.length; i++) list2[i](F);
                });
                work++;
                break;
              }
            }
          } catch (e) {
            if (!e.xyt) throw e;
            this.errors.push(e);
          }
        }
        return out;
      };
      const errors = this.errors.length;
      this.inSim = s.name;
      let body;
      try {
        body = compileList(s.body, scope, true);
      } finally {
        this.inSim = null;
      }
      if (!states.size && this.errors.length === errors) throw this.error(s.line, `sim ${s.name} has no state; give it one, like: state y = 0.2`);
      this.steppers.push({
        init: (F) => {
          for (const f of inits) f(F);
        },
        step: (F) => {
          for (let i = 0; i < body.length; i++) body[i](F);
        },
        work: work + 1
      });
      this.simSteps.push(s.step || SIM_STEP);
      for (const [name, slot] of states) {
        const c = this.expose({ slot, name: `${s.name}.${name}`, line: s.line });
        this.root.vars.set(`${s.name}.${name}`, { c, t: "num", cpu: (F) => F.v[slot] });
      }
      this.root.vars.set(s.name, { t: "sim", values: [...states.keys()], c: null });
    }
    // The values of a group, camera or define call transform as GLSL, with defaults filled in.
    transformValues(attrs, sc, line, what, pivot = {}) {
      const E = (m) => this.error(line, m);
      const t = {};
      for (const raw of Object.keys(attrs)) {
        const name = own2(TRANSFORM, raw) ? raw : own2(TRANSFORM_ALIASES, raw) ? TRANSFORM_ALIASES[raw] : null;
        if (!name) {
          const names = Object.keys(TRANSFORM).map((k) => k === "scale" && what === "camera" ? "zoom" : k).concat(what === "group" ? ["depth"] : []);
          throw E(`${what} has no '${raw}'.` + suggest(raw, names) + ` It takes: ${names.join(", ")}`);
        }
        if (t[name]) throw E(`'${name}' is given twice`);
        const r = this.ex(attrs[raw], sc, line);
        if (r.t === "col") throw E(`'${raw}' must be a number, not a color`);
        t[name] = `(${r.c})`;
      }
      const value = (k) => t[k] || pivot[k] || (k === "cx" ? "(ASPECT*0.5)" : fmt(TRANSFORM[k]));
      return Object.fromEntries(Object.keys(TRANSFORM).map((k) => [k, value(k)]));
    }
    // Moves the sampling point so that whatever is drawn next appears turned by angle (clockwise),
    // scaled and mirrored around (cx, cy), then moved by (dx, dy). PX scales too, so edges stay
    // one pixel wide at any zoom. The values stay in variables named by id (anchors and depth use them).
    applyTransform(t, ind, id) {
      const lines = [`${ind}vec2 tc_${id} = vec2(${t.cx}, ${t.cy}); float ts_${id} = ${t.scale}; float tf_${id} = ${t.flip}; float ta_${id} = ${t.angle}; vec2 td_${id} = vec2(${t.dx}, ${t.dy});`];
      if (t.shake !== "0.0") {
        lines.push(`${ind}{ float sk = ${t.shake}; td_${id} += sk * 2.0 * vec2(vn2(vec2(T * 19.0, 3.1)) - 0.5, vn2(vec2(T * 19.0, 9.7)) - 0.5); ta_${id} += sk * 60.0 * (vn2(vec2(T * 15.0, 5.3)) - 0.5); }`);
      }
      return lines.concat(this.applyVars(id, ind));
    }
    applyVars(id, ind) {
      return [
        `${ind}ts_${id} = abs(ts_${id}) < 1e-6 ? 1e-6 : ts_${id}; tf_${id} = abs(tf_${id}) < 1e-4 ? 1e-4 : tf_${id};`,
        `${ind}PP = rot(PP - tc_${id} - td_${id}, ta_${id}) / ts_${id}; PP.x /= tf_${id}; PP += tc_${id}; PX /= abs(ts_${id}); X = PP.x; Y = PP.y;`
      ];
    }
    save(id) {
      return `vec2 sp_${id} = PP; float spx_${id} = PX;`;
    }
    restore(id) {
      return `PP = sp_${id}; PX = spx_${id}; X = PP.x; Y = PP.y;`;
    }
    define(s) {
      const E = (m) => this.error(s.line, m);
      const params = [];
      for (const pn of Object.keys(s.params)) {
        this.checkName(pn, s.line, "value");
        const r = this.ex(s.params[pn], this.root, s.line);
        params.push({ name: pn, t: r.t, def: r.c });
      }
      const fname = `f_${glslName(s.name)}`;
      let cost;
      this.inBody({ inDefine: s.name, inFn: null }, () => {
        const body = new Scope(this.root);
        for (const q of params) body.vars.set(q.name, { c: `a_${glslName(q.name)}`, t: q.t });
        cost = this.stmts(s.body, body, "  ");
      });
      const b = this.lastBody;
      this.addFunc(fname, `vec3 ${fname}(vec3 col${params.map((q) => `, ${glslType(q.t)} a_${glslName(q.name)}`).join("")}) {
${b.out.join("\n")}
  return col;
}`, b.deps);
      this.defs.set(s.name, { name: s.name, fname, params, cost, anchors: s.anchors || [], bounded: !!s.bounded, node: s, pfn: null });
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
    // Named number values of a line that draws nothing (anchor, bounds), checked like shape values.
    namedValues(s, sc, allowed, what) {
      const v = {};
      for (const raw of Object.keys(s.attrs)) {
        if (!own2(allowed, raw)) throw this.error(s.line, `${what} has no '${raw}'.` + suggest(raw, Object.keys(allowed)) + ` It takes: ${Object.keys(allowed).join(", ")}`);
        v[raw] = this.ex(s.attrs[raw], sc, s.line);
        if (v[raw].t === "col") throw this.error(s.line, `'${raw}' must be a number, not a color`);
      }
      return { v, num: (k) => v[k] ? `(${v[k].c})` : fmt(allowed[k]) };
    }
    // A shape line's values after aliases, checked for names, repeats and types.
    shapeValues(s, sc, options, what) {
      const E = (m) => this.error(s.line, m);
      const allowed = Object.assign({}, s.def ? s.def.values : SHAPES[s.type], options);
      const aliases = Object.assign({}, ALIASES._all, s.def ? s.def.aliases : ALIASES[s.type]);
      const named = s.def && s.def.names || {};
      const fixedNames = s.def && s.def.fixed || {};
      let attrs = s.attrs;
      if (own2(attrs, "attach")) {
        const keys = own2(allowed, "cx") && own2(allowed, "cy") && !["curve"].includes(s.type) ? ["cx", "cy"] : own2(allowed, "x") && own2(allowed, "y") ? ["x", "y"] : null;
        if (!keys) throw E(`attach places a shape by its center, and ${s.type} has none; give its points instead, like x1=mila.hand.x`);
        const given = Object.keys(attrs).filter((k) => k !== "attach").map((k) => own2(allowed, k) ? k : aliases[k] || k);
        for (const k of keys) if (given.includes(k)) throw E(`attach= sets ${keys.join(" and ")}; leave ${k} out`);
        const point = attrs.attach.t === "var" ? sc.get(attrs.attach.name) : null;
        if (!point || point.t !== "point") throw E("attach= takes a point of a named drawing, like attach=mila.hand (draw it with name=mila; its define has: anchor hand x=... y=...)");
        attrs = Object.assign({}, attrs);
        delete attrs.attach;
        attrs[keys[0]] = { t: "var", name: s.attrs.attach.name + ".x" };
        attrs[keys[1]] = { t: "var", name: s.attrs.attach.name + ".y" };
      }
      const v = {}, fixed = {};
      for (const raw of Object.keys(attrs)) {
        if (own2(fixedNames, raw)) {
          const node2 = attrs[raw], choices = fixedNames[raw]();
          if (node2.t !== "var" || !choices.includes(node2.name)) {
            throw E(`'${raw}' takes one of: ${choices.join(", ")}.` + (node2.t === "var" ? suggest(node2.name, choices) : ""));
          }
          fixed[raw] = node2.name;
          continue;
        }
        const name = own2(allowed, raw) ? raw : aliases[raw];
        if (!name || !own2(allowed, name)) {
          const meant = typeof name === "string" ? name : raw;
          const hint = options === CLIP_OPTIONS && (meant === "color" || meant === "alpha") ? " A clip shape is not drawn, so it takes no color or alpha." : "";
          const names = Object.keys(allowed).concat(Object.keys(fixedNames));
          throw E(`${what} has no '${raw}'.` + suggest(raw, names) + hint + ` It takes: ${names.join(", ")}`);
        }
        if (v[name]) throw E(`'${name}' is given twice`);
        let node = attrs[raw];
        if (own2(named, name) && node.t === "var" && !sc.get(node.name)) {
          if (!own2(named[name], node.name)) {
            const words = Object.keys(named[name]);
            throw E(`'${raw}' takes a number or one of: ${words.join(", ")}.` + suggest(node.name, words));
          }
          node = { t: "num", v: named[name][node.name] };
        }
        v[name] = this.ex(node, sc, s.line);
        if (name !== "color" && v[name].t === "col") throw E(`'${raw}' must be a number, not a color`);
      }
      const num = (k) => v[k] ? `(${v[k].c})` : fmt(allowed[k]);
      if (s.def && s.def.check) {
        const problem = s.def.check(s.str, fixed);
        if (problem) throw E(problem);
      }
      return { v, num, fixed };
    }
    // GLSL that opens a block and sets cv to how much of this pixel the shape covers, 0 to 1.
    // The caller uses cv and closes the block.
    coverage(s, v, num, ind, fixed = {}) {
      const type = s.type;
      const at = (cx, cy) => `PP - vec2(${num(cx)},${num(cy)})`;
      let d;
      if (s.def) d = s.def.distance(s.str, num, (name, code) => {
        if (!this.helpers.has(name)) this.helpers.set(name, code);
      }, fixed);
      switch (type) {
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
        case "curve":
          d = `sdBez(PP, vec2(${num("x1")},${num("y1")}), vec2(${num("cx")},${num("cy")}), vec2(${num("x2")},${num("y2")})) - ${num("width")}*0.5`;
          break;
      }
      const thickness = v.stroke ? `abs(${num("stroke")})` : s.def ? s.def.thickness ? s.def.thickness(s.str, num) : null : {
        circle: `2.0*abs(${num("r")})`,
        ellipse: `2.0*min(abs(${num("rx")}),abs(${num("ry")}))`,
        rect: `min(abs(${num("w")}),abs(${num("h")}))`,
        line: `abs(${num("width")})`,
        ring: `abs(${num("width")})`,
        arc: `abs(${num("width")})`,
        star: `2.0*abs(${num("r")})*clamp(${num("inner")},0.05,1.0)`,
        tri: null,
        curve: `abs(${num("width")})`
      }[type];
      const lines = [`${ind}{ float d = ${d};`];
      if (v.stroke) lines.push(`${ind}  d = abs(d) - ${num("stroke")}*0.5;`);
      lines.push(`${ind}  float w = max(${num("blur")}, PX);`);
      lines.push(`${ind}  float cv = (1.0 - ssf(-w*0.5, w*0.5, d))${thickness ? ` * clamp(${thickness}/PX, 0.0, 1.0)` : ""}${v.alpha ? ` * clamp(${v.alpha.c},0.0,1.0)` : ""};`);
      return lines;
    }
    shape(s, sc, ind) {
      const { v, num, fixed } = this.shapeValues(s, sc, COMMON, s.type);
      if (!this.inDefine) this.draws++;
      const color = v.color ? asCol(v.color) : "vec3(1.0)";
      this.out.push(...this.coverage(s, v, num, ind, fixed), `${ind}  if (cv > 0.0) col = mix(col, ${color}, cv); }`);
      return s.def && s.def.cost ? s.def.cost(s.str, fixed) : 1;
    }
  };
  function closure(funcs, roots) {
    const byName = new Map(funcs.map((f) => [f.name, f]));
    const need = /* @__PURE__ */ new Set(), todo = [...roots];
    while (todo.length) {
      const n = todo.pop();
      if (need.has(n) || !byName.has(n)) continue;
      need.add(n);
      todo.push(...byName.get(n).deps);
    }
    return funcs.filter((f) => need.has(f.name));
  }
  function compile(source, options = {}) {
    const program = parse(source);
    const c = new Compiler(program);
    c.errors.push(...program.errors);
    const root = new Scope(null);
    c.root = root;
    for (const inp of program.inputs) {
      try {
        c.checkGlobal(inp.name, inp.line, "input");
        const name = inp.name;
        root.vars.set(name, {
          c: `u_in_${glslName(name)}`,
          t: inp.kind,
          cpu: inp.kind === "num" ? (F) => {
            const v = F.inputs[name];
            return typeof v === "number" ? v : inp.value;
          } : null
        });
        if (inp.kind === "num") root.vars.get(name).usesInput = true;
      } catch (e) {
        c.errors.push(e);
      }
    }
    for (const q of program.cues) {
      try {
        c.checkGlobal(q.name, q.line, "cue");
        const v = q.value;
        root.vars.set(q.name, { c: fmt(v), t: "num", cpu: () => v });
      } catch (e) {
        c.errors.push(e);
      }
    }
    for (const tr of program.tracks) {
      try {
        c.checkGlobal(tr.name, tr.line, "track");
        const track = { values: Float64Array.from(tr.values), step: tr.step };
        const g = c.expose({ track, name: tr.name, line: tr.line });
        root.vars.set(tr.name, { c: g, t: "num", cpu: (F) => sampleTrack(track.values, track.step, F.t) });
      } catch (e) {
        c.errors.push(e);
      }
    }
    for (const v of root.vars.values()) {
      if (v.usesInput && v.cpu) {
        const f = v.cpu;
        v.cpu = (F) => {
          c.usesInputs = true;
          return f(F);
        };
      }
    }
    const main = new Scope(root);
    let cost = 0;
    const topDeps = /* @__PURE__ */ new Set();
    c.deps = topDeps;
    if (!program.errors.length) cost = c.stmts(program.body, main, "  ");
    const errors = c.errors.sort((a, b) => a.line - b.line).map((e) => ({ line: e.line, message: e.message }));
    if (!errors.length && c.draws === 0) {
      errors.push({ line: 1, message: "nothing to draw yet: add a fill or a shape" });
    }
    const worst = Math.round(cost + c.boundedExtra);
    cost += c.bounded;
    const costs = [...c.lineCost].map(([line, k]) => ({ line, cost: Math.round(k) })).filter((x) => x.cost > 0).sort((a, b) => b.cost - a.cost || a.line - b.line);
    const heaviest = costs.slice(0, 3).map((x) => `line ${x.line} (${x.cost})`).join(", ");
    const warnings = c.warnings.sort((a, b) => a.line - b.line);
    if (cost > LIMITS.warnCost) {
      warnings.push({ line: 0, message: `every pixel costs about ${Math.round(cost)} shapes (noise and fbm count as several); this may be slow on phones. Heaviest: ${heaviest}` });
    }
    if (cost > LIMITS.cost) {
      errors.push({ line: 0, message: `every pixel costs about ${Math.round(cost)} shapes, over the limit of ${LIMITS.cost}; use smaller repeat counts or less noise and fbm inside repeat, or give big drawings bounds. Heaviest: ${heaviest}` });
    }
    let frames = null;
    if (c.exposed.length) {
      let step = c.simSteps.length ? Math.min(...c.simSteps) : SIM_STEP;
      if (c.hasSmooth) step = Math.min(step, SIM_STEP);
      const work = c.steppers.reduce((s, x) => s + x.work, 0) * program.duration / step;
      if (work > LIMITS.simWork) {
        errors.push({ line: 0, message: `the sims and smooth() values would take too long to work out (${Math.round(work / 1e6)} million steps); use a larger sim step, fewer of them or a shorter duration` });
      }
      frames = new FrameValues({
        duration: program.duration,
        step,
        slots: c.slots,
        exposed: c.exposed,
        steppers: c.steppers,
        usesInputs: () => c.usesInputs
      });
      if (errors.length === 0) {
        try {
          frames.run(Object.fromEntries(program.inputs.map((i) => [i.name, i.value])));
        } catch (e) {
          errors.push({ line: 0, message: `the sims could not be worked out: ${e.message}` });
        }
      }
    }
    const bps = program.bpm / 60;
    const uniforms = program.inputs.map((i) => `uniform ${i.kind === "col" ? "vec3" : "float"} u_in_${glslName(i.name)};`).concat(c.exposed.length ? [`uniform vec4 u_fv[${Math.ceil(c.exposed.length / 4)}];`] : []).join("\n");
    const assemble = (funcs, lines) => `${PRELUDE}${uniforms}
${c.globals.join("\n")}
${[...c.helpers.values()].join("\n")}
${funcs.map((f) => f.code).join("\n")}
void main(){
  ASPECT = u_res.x / u_res.y;
  X = gl_FragCoord.x / u_res.y; Y = 1.0 - gl_FragCoord.y / u_res.y;
  T = u_t; D = u_dur; P = T / D; PX = 1.0 / u_res.y; PP = vec2(X, Y);
  BEAT = (T - ${fmt(program.offset)}) * ${fmt(bps)}; PULSE = BEAT < 0.0 ? 0.0 : exp(-fract(BEAT) * 5.0);
  MX = u_mouse.x; MY = u_mouse.y;
  vec3 col = vec3(0.0);
${lines.join("\n")}
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
    const glsl = assemble(c.funcs, c.out);
    let parts = null;
    const split = options.split === void 0 ? "auto" : options.split;
    const scenes = c.sceneParts;
    if (errors.length === 0 && scenes.length && (split === true || split === "auto" && scenes.length >= 2 && glsl.length > 6e4)) {
      const D = program.duration;
      const cuts = [.../* @__PURE__ */ new Set([0, D, ...scenes.flatMap((s) => [s.start, s.end])])].filter((x) => x >= 0 && x <= D).sort((a, b) => a - b);
      parts = [];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const a = cuts[i], b = cuts[i + 1];
        if (!(b > a)) continue;
        const active = scenes.filter((s) => s.start < b && s.end > a);
        const last = parts[parts.length - 1];
        if (last && last.active.length === active.length && last.active.every((s, k) => s === active[k])) {
          last.end = b;
          continue;
        }
        parts.push({ start: a, end: b, active });
      }
      parts = parts.map(({ start, end, active }) => {
        const roots = new Set(topDeps);
        for (const s of active) for (const d of s.deps) roots.add(d);
        const skip = scenes.filter((s) => !active.includes(s));
        const lines = c.out.filter((_, i) => !skip.some((s) => i >= s.from && i < s.to));
        return { start, end, glsl: assemble(closure(c.funcs, roots), lines) };
      });
    }
    return {
      ok: errors.length === 0,
      errors,
      warnings,
      glsl,
      parts,
      frames,
      duration: program.duration,
      aspect: program.aspect,
      aspectLabel: program.aspectLabel,
      bpm: program.bpm,
      offset: program.offset,
      beatsPerBar: program.bar,
      inputs: program.inputs.map(({ name, kind, value, min, max }) => ({ name, kind, value, min, max })),
      scenes: program.body.filter((b) => b.k === "scene").map(({ start, end, fadein, fadeout }) => ({ start, end, fadein, fadeout })),
      cues: program.cues.map(({ name, value }) => ({ name, time: value })),
      defines: [...c.defs.keys()],
      fns: [...c.fns.keys()],
      sims: program.body.filter((b) => b.k === "sim").map((b) => b.name),
      plugins: program.uses.map((p) => p.name),
      cost: Math.round(cost),
      worstCost: Math.max(worst, Math.round(cost)),
      costs
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
     * @param {boolean|'auto'} [options.split='auto'] one shader per stretch of time with the same scenes (see compile)
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
        inputs: {},
        split: "auto"
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
      this._progs = [];
      this._fv = null;
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
      const result = compile(source, { split: this.options.split });
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
      this._fv = result.frames ? result.frames.run(this._inputs) : null;
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
      if (this.result && this.result.frames && this.result.frames.usesInputs) this._fv = this.result.frames.run(this._inputs);
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
        for (const p of this._progs) if (p) gl.deleteProgram(p.prog);
        if (this._vs) gl.deleteShader(this._vs);
        if (this._buf) gl.deleteBuffer(this._buf);
      }
      this._progs = [];
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
      this._progs = [];
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
    // Checks a new program on the GPU by building the shader it needs now; a split program's other
    // parts are built when they are first needed. Returns an error message, or null.
    _build(result) {
      const old = this._progs;
      this._progs = (result.parts || [null]).map(() => null);
      const error = this._buildPart(this._partAt(result, this._time), result);
      if (error) {
        this._progs = old;
        return error;
      }
      const gl = this.gl;
      if (!gl.isContextLost()) {
        for (const p of old) if (p) gl.deleteProgram(p.prog);
      }
      return null;
    }
    _partAt(result, t) {
      const parts = result.parts;
      if (!parts) return 0;
      let i = 0;
      while (i + 1 < parts.length && t >= parts[i + 1].start) i++;
      return i;
    }
    _buildPart(i, result) {
      const gl = this.gl;
      try {
        const fs = this._shader(gl.FRAGMENT_SHADER, result.parts ? result.parts[i].glsl : result.glsl);
        const p = gl.createProgram();
        gl.attachShader(p, this._vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p) || "link failed");
        const u = (n) => gl.getUniformLocation(p, n);
        const loc = { a: gl.getAttribLocation(p, "a"), res: u("u_res"), t: u("u_t"), dur: u("u_dur"), mouse: u("u_mouse"), fv: u("u_fv"), inputs: {} };
        for (const inp of result.inputs) loc.inputs[inp.name] = { loc: u("u_in_" + glslName(inp.name)), kind: inp.kind };
        this._progs[i] = { prog: p, loc };
        return null;
      } catch (e) {
        return String(e.message || e).slice(0, 400);
      }
    }
    _draw(t) {
      if (!this.result || this.gl.isContextLost()) return;
      const i = this._partAt(this.result, t);
      if (!this._progs[i]) {
        const error = this._buildPart(i, this.result);
        if (error) {
          this._emit("error", [{ line: 0, message: "The GPU rejected the compiled shader: " + error }]);
          return;
        }
      }
      const gl = this.gl, { prog, loc: L } = this._progs[i], w = this.canvas.width, h = this.canvas.height;
      gl.viewport(0, 0, w, h);
      gl.useProgram(prog);
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
      if (this._fv && L.fv) gl.uniform4fv(L.fv, this._fv.at(t));
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
        if (this.result) this._progs = (this.result.parts || [null]).map(() => null);
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
duration 8                         // or in bars: duration bars 16
bpm 120 offset=0 bar=4             // tempo for beat and pulse; offset = seconds before the first beat; bar = beats per bar
input wind = 0.5 min=0 max=1       // a value the host page can change live (number or color)
cue drop 32.5                      // a named time (or bar(17)), usable anywhere: scene drop drop + 4, hits(t, drop)

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
curve   x1= y1= cx= cy= x2= y2= width=     // a line from x1,y1 to x2,y2 bent toward cx,cy (smiles, ropes, tails)
Every shape also takes: color= alpha= (0 to 1) blur= (soft edge width) stroke= (outline width instead of filled).
Sizes and positions share the same units (1 = canvas height). angle is in degrees, clockwise.
A shape's color can vary per pixel, like color=mix(red, yellow, y).
let name = formula                 // reusable number or color, may use x, y, t
fn hill(x) = 0.8 - 0.1 * x         // your own function, used like sin(); or a block: fn f(a, b), let lines, return VALUE, end

Blocks (close each with end):
repeat i 12                        // i = 0, 1, ..., 11
scene 6 12 fade=0.5                // only draws from 6 s to 12 s; fade (or fadein/fadeout) in seconds
scene bars 9 16                    // or bars 9 to 16 (counting from 1, both included), following the tempo
                                   // inside a scene: st = seconds since it began, sp = progress 0-1, sb = beats since it began
define hero cx=0.5 cy=0.5 s=1 tint=gold   // a reusable drawing (character, cloud) with named values and defaults
end
hero cx=0.3 s=0.8                  // draw it anywhere, as often as needed, changing only what differs
Inside define, use its own values plus x, y, t and inputs; pass anything else in as a value. Define it above where it is used.
group cx= cy= angle= scale= flip= dx= dy=   // turns, scales and mirrors (flip=-1) the lines inside around cx,cy
                                   // (default: canvas center), then moves them by dx,dy; coordinates inside stay the same
clip circle cx= cy= r=             // draws the lines inside only within that shape (any shape; invert=1 for outside)
camera cx= cy= zoom= angle=        // like group, for the rest of its block (a scene), without end; shake=0.02 * hits(t, 4)
group depth=3                      // under a camera: moves a third as much (parallax)
hero cx=0.3 angle=20 flip=-1       // a define call also takes angle scale flip dx dy, turning around its own cx,cy
In a define, anchor hand x= y= angle= names a point; draw it with name=mila, then read mila.hand.x and mila.hand.y,
or put a shape or drawing there with attach=mila.hand. bounds cx= cy= r= in a define: the circle it stays within (faster).
sim ball                           // values with memory, worked out before playing: physics, bounces
  state y = 0.2                    // starting value; read below as ball.y. dt = seconds per step
  state vy = 0
  vy += 2.5 * dt                   // lines that change states; also: if y > 0.8 ... else ... end
  y += vy * dt
end

Colors: #rgb or #rrggbb, rgb(r,g,b) with 0-1 values, hsl(hue_degrees, s, l) with s and l 0-1, gray(v),
names: white black red green blue yellow orange purple pink cyan magenta gray navy teal brown gold sky.
Color math works: mix(c1, c2, k), c * 0.5, c1 + c2.

Math: + - * / % ^ and < > (give 1 or 0), sin cos tan abs floor ceil fract round sqrt exp log sign
min max clamp(v) clamp(v,lo,hi) mix(a,b,k) smoothstep(edge0,edge1,v) step(edge,v) atan2(y,x) pow(a,b)
dist(x1,y1,x2,y2) = distance between two points. Constants: pi tau.
Motion: keys(t, 0, 0.2, 1.5, 0.8, 3, 0.2) moves smoothly through values at key times (values may be colors);
ease(v) easein(v) easeout(v) backout(v) (overshoots) bounce(v) take 0-1 progress; pingpong(v) goes 0 to 1 to 0 each unit.
spring(t - 2, freq, damping) swings between -1 and 1 from 2 s on and dies out (defaults 2, 4); hits(t, 1, 2.5) is 1 at each time, fading fast.
smooth(value, 0.5) follows a value with a gentle lag (cameras that follow); bar(9) or bar(9, 3) = the time of bar 9 (beat 3).
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
  var version = "0.4.0";
  if (typeof window !== "undefined") defineElement();
  return __toCommonJS(index_exports);
})();
