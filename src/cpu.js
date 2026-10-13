// Formulas evaluated on the CPU, for values that are the same for every pixel of a frame: sim
// states, smooth() and tracks. The shader's functions are mirrored here (see glsl.js), and formulas
// become JavaScript closures, never code built from text, so programs stay safe to run from any source.
// A closure takes (F, A, L): the frame (F.t, F.dt, F.v, F.inputs), and the values and lets of the
// fn being run, if any.
import { XytError } from './util.js';

const fract = (v) => v - Math.floor(v);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const ssf = (a, b, v) => {
  const k = (v - a) / (b - a);
  if (k !== k) return v >= a ? 1 : 0; // a == b
  const c = clamp(k, 0, 1);
  return c * c * (3 - 2 * c);
};
const mod = (a, b) => a - b * Math.floor(a / b);
export function pw(a, b) {
  const e = Math.abs(a);
  if (b === Math.floor(b)) {
    if (e === 0) return b > 0 ? 0 : 1;
    const r = e ** b;
    return a < 0 && mod(b, 2) === 1 ? -r : r;
  }
  return a <= 0 ? 0 : a ** b;
}
const eIn = (v) => { v = clamp(v, 0, 1); return v * v * v; };
const eOut = (v) => { v = 1 - clamp(v, 0, 1); return 1 - v * v * v; };
const eBack = (v) => { v = clamp(v, 0, 1) - 1; return 1 + 2.70158 * v * v * v + 1.70158 * v * v; };
const eBounce = (v) => {
  v = clamp(v, 0, 1);
  if (v < 0.36363636) return 7.5625 * v * v;
  if (v < 0.72727273) { v -= 0.54545455; return 7.5625 * v * v + 0.75; }
  if (v < 0.90909091) { v -= 0.81818182; return 7.5625 * v * v + 0.9375; }
  v -= 0.95454545; return 7.5625 * v * v + 0.984375;
};
const spring = (t, f, d) => (t <= 0 ? 0 : Math.exp(-d * t) * Math.sin(6.28318531 * f * t));
const hit = (t) => (t < 0 ? 0 : Math.exp(-t * 8));

// the shader's hashes and noise (in double precision here, so values differ slightly from the GPU's)
const h11 = (p) => { p = fract(p * 0.1031 + 0.3183); p *= p + 33.33; p *= p + p; return fract(p); };
const h21 = (x, y) => {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d; b += d; c += d;
  return fract((a + b) * c);
};
const h31 = (x, y, z) => {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(z * 0.1031);
  const d = a * (c + 31.32) + b * (b + 31.32) + c * (a + 31.32);
  a += d; b += d; c += d;
  return fract((a + b) * c);
};
const smooth3 = (f) => f * f * (3 - 2 * f);
const mixn = (a, b, k) => a + (b - a) * k;
const vn2 = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y), ux = smooth3(x - ix), uy = smooth3(y - iy);
  return mixn(mixn(h21(ix, iy), h21(ix + 1, iy), ux), mixn(h21(ix, iy + 1), h21(ix + 1, iy + 1), ux), uy);
};
const vn3 = (x, y, z) => {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const ux = smooth3(x - ix), uy = smooth3(y - iy), uz = smooth3(z - iz);
  const a = mixn(mixn(h31(ix, iy, iz), h31(ix + 1, iy, iz), ux), mixn(h31(ix, iy + 1, iz), h31(ix + 1, iy + 1, iz), ux), uy);
  const b = mixn(mixn(h31(ix, iy, iz + 1), h31(ix + 1, iy, iz + 1), ux), mixn(h31(ix, iy + 1, iz + 1), h31(ix + 1, iy + 1, iz + 1), ux), uy);
  return mixn(a, b, uz);
};
const fb2 = (x, y) => {
  let s = 0, a = 0.5;
  for (let k = 0; k < 5; k++) { s += a * vn2(x, y); const nx = 1.6 * x - 1.2 * y + 17, ny = 1.2 * x + 1.6 * y + 17; x = nx; y = ny; a *= 0.5; }
  return s / 0.96875;
};
const fb3 = (x, y, z) => {
  let s = 0, a = 0.5;
  for (let k = 0; k < 5; k++) { s += a * vn3(x, y, z); x = x * 2.03 + 17; y = y * 2.03 + 17; z = z * 2.03 + 17; a *= 0.5; }
  return s / 0.96875;
};

/** The value of a track at time t: its values one step apart, joined by straight lines. */
export function sampleTrack(values, step, t) {
  const pos = t / step;
  if (!(pos > 0)) return values[0];
  const i = Math.floor(pos);
  if (i >= values.length - 1) return values[values.length - 1];
  return mixn(values[i], values[i + 1], pos - i);
}

const UNARY = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, exp: Math.exp, sign: Math.sign,
  asin: (v) => Math.asin(clamp(v, -1, 1)), acos: (v) => Math.acos(clamp(v, -1, 1)), fract,
  round: (v) => Math.floor(v + 0.5), sqrt: (v) => Math.sqrt(Math.max(v, 0)), log: (v) => Math.log(Math.max(v, 1e-9)),
  saturate: (v) => clamp(v, 0, 1), ease: (v) => ssf(0, 1, v), easein: eIn, easeout: eOut, backout: eBack, bounce: eBounce,
  pingpong: (v) => 1 - Math.abs(fract(v) * 2 - 1),
};
const BINARY = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '%': mod, '^': pw,
  '<': (a, b) => +(a < b), '>': (a, b) => +(a > b), '<=': (a, b) => +(a <= b), '>=': (a, b) => +(a >= b),
  '==': (a, b) => +(a === b), '!=': (a, b) => +(a !== b), '&&': (a, b) => +(a !== 0 && b !== 0), '||': (a, b) => +(a !== 0 || b !== 0),
};

/**
 * Turns a formula into a closure (F, A, L) => number.
 * ctx: line, what (for errors: "a sim", "smooth()"), resolve(name) -> closure (throws when it can't),
 * fn(name) -> { params, impl(F, args) } or null, bar(n, b) -> seconds, smooth(argNodes) -> closure.
 */
export function buildCpu(node, ctx) {
  const E = (m) => new XytError(ctx.line, m);
  const build = (n) => buildCpu(n, ctx);
  switch (node.t) {
    case 'num': { const v = node.v; return () => v; }
    case 'hex': throw E(`${ctx.what} works with numbers; colors can't go here`);
    case 'var': return ctx.resolve(node.name);
    case 'neg': { const a = build(node.a); return (F, A, L) => -a(F, A, L); }
    case 'bin': {
      const a = build(node.a), b = build(node.b), op = BINARY[node.op];
      return (F, A, L) => op(a(F, A, L), b(F, A, L));
    }
    case 'call': return buildCall(node, ctx, build, E);
  }
  throw E('this value could not be understood');
}
function buildCall(node, ctx, build, E) {
  const fn = node.fn;
  const user = ctx.fn(fn);
  if (user) {
    if (node.args.length !== user.params.length) throw E(`${fn}() takes ${user.params.length} value${user.params.length === 1 ? '' : 's'}: ${fn}(${user.params.join(', ')})`);
    const args = node.args.map(build), impl = user.impl;
    return (F, A, L) => impl(F, args.map((g) => g(F, A, L)));
  }
  if (fn === 'smooth') return ctx.smooth(node.args);
  if (['rgb', 'gray', 'hsl'].includes(fn)) throw E(`${ctx.what} works with numbers; ${fn}() makes a color`);
  const args = node.args.map(build);
  const n = args.length;
  const count = (lo, hi = lo) => { if (n < lo || n > hi) throw E(`${fn}() takes ${lo === hi ? lo : lo + ' to ' + hi} value${hi === 1 ? '' : 's'}, got ${n}`); };
  const [a, b, c] = args;
  if (UNARY[fn]) { count(1); const f = UNARY[fn]; return (F, A, L) => f(a(F, A, L)); }
  switch (fn) {
    case 'atan': count(1, 2); return n === 1 ? (F, A, L) => Math.atan(a(F, A, L)) : (F, A, L) => Math.atan2(a(F, A, L), b(F, A, L));
    case 'atan2': count(2); return (F, A, L) => Math.atan2(a(F, A, L), b(F, A, L));
    case 'pow': count(2); return (F, A, L) => pw(a(F, A, L), b(F, A, L));
    case 'min': count(2); return (F, A, L) => Math.min(a(F, A, L), b(F, A, L));
    case 'max': count(2); return (F, A, L) => Math.max(a(F, A, L), b(F, A, L));
    case 'mod': count(2); return (F, A, L) => mod(a(F, A, L), b(F, A, L));
    case 'clamp':
      count(1, 3);
      if (n === 2) throw E('clamp() takes clamp(v) for 0 to 1, or clamp(v, low, high)');
      return n === 1 ? (F, A, L) => clamp(a(F, A, L), 0, 1) : (F, A, L) => clamp(a(F, A, L), b(F, A, L), c(F, A, L));
    case 'mix': case 'lerp': count(3); return (F, A, L) => mixn(a(F, A, L), b(F, A, L), c(F, A, L));
    case 'smoothstep': count(3); return (F, A, L) => ssf(a(F, A, L), b(F, A, L), c(F, A, L));
    case 'step': count(2); return (F, A, L) => (b(F, A, L) < a(F, A, L) ? 0 : 1);
    case 'dist':
      if (n === 2) return (F, A, L) => Math.hypot(a(F, A, L), b(F, A, L));
      count(4);
      return (F, A, L) => Math.hypot(a(F, A, L) - c(F, A, L), b(F, A, L) - args[3](F, A, L));
    case 'noise':
      count(1, 3);
      return n === 3 ? (F, A, L) => vn3(a(F, A, L), b(F, A, L), c(F, A, L)) : (F, A, L) => vn2(a(F, A, L), n > 1 ? b(F, A, L) : 0);
    case 'fbm':
      count(1, 3);
      return n === 3 ? (F, A, L) => fb3(a(F, A, L), b(F, A, L), c(F, A, L)) : (F, A, L) => fb2(a(F, A, L), n > 1 ? b(F, A, L) : 0);
    case 'hash': count(1, 2); return n === 1 ? (F, A, L) => h11(a(F, A, L)) : (F, A, L) => h21(a(F, A, L), b(F, A, L));
    case 'spring': count(1, 3); return (F, A, L) => spring(a(F, A, L), n > 1 ? b(F, A, L) : 2, n > 2 ? c(F, A, L) : 4);
    case 'hits': {
      if (n < 2) throw E('hits() takes a time, then the times of the hits: hits(t, 1, 2.5, 4)');
      const times = args.slice(1);
      return (F, A, L) => { const t = a(F, A, L); let m = 0; for (const h of times) m = Math.max(m, hit(t - h(F, A, L))); return m; };
    }
    case 'keys': {
      if (n < 5 || (n - 1) % 2 !== 0) throw E('keys() takes a time, then pairs of key time and value: keys(t, 0, 0.2, 1.5, 0.8, 3, 0.2)');
      const ks = [], vs = [];
      for (let i = 1; i < n; i += 2) { ks.push(args[i]); vs.push(args[i + 1]); }
      return (F, A, L) => {
        const t = a(F, A, L);
        let r = vs[0](F, A, L);
        for (let i = 1; i < ks.length; i++) r = mixn(r, vs[i](F, A, L), ssf(ks[i - 1](F, A, L), ks[i](F, A, L), t));
        return r;
      };
    }
    case 'bar': {
      count(1, 2);
      const bt = ctx.bar;
      return n === 1 ? (F, A, L) => bt(a(F, A, L), 1) : (F, A, L) => bt(a(F, A, L), b(F, A, L));
    }
  }
  throw E(`unknown function '${fn}'`);
}
