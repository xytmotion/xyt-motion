// Syntax tree -> type-checked GLSL. Every value is either a number ('num') or a color ('col').
import { XytError, suggest, fmt, parseHex, vec3, glslName } from './util.js';
import {
  SHAPES, COMMON, ALIASES, NAMED_COLORS, BUILTINS, SCENE_VALUES, COMMANDS, LIMITS, FUNCTION_COST,
  TRANSFORM, TRANSFORM_ALIASES, CLIP_OPTIONS, ANCHOR, BOUNDS,
} from './language.js';
import { PRELUDE } from './glsl.js';
import { parse } from './parser.js';
import { buildCpu, sampleTrack } from './cpu.js';
import { FrameValues } from './frames.js';

const UNARY = ['sin', 'cos', 'tan', 'asin', 'acos', 'abs', 'floor', 'ceil', 'fract', 'exp', 'sign'];
export const FUNCTIONS = UNARY.concat(['sqrt', 'log', 'round', 'atan', 'atan2', 'pow', 'min', 'max', 'mod', 'clamp',
  'saturate', 'mix', 'lerp', 'smoothstep', 'step', 'dist', 'rgb', 'gray', 'hsl', 'noise', 'fbm', 'hash',
  'ease', 'easein', 'easeout', 'backout', 'bounce', 'pingpong', 'keys', 'spring', 'hits', 'bar', 'smooth']);

const asCol = (r) => (r.t === 'col' ? r.c : `vec3(${r.c})`);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const glslType = (t) => (t === 'col' ? 'vec3' : 'float');

// Statements that hold other statements; they count the cost of their contents themselves.
const BLOCKS = ['repeat', 'scene', 'define', 'group', 'clip', 'fn', 'sim'];
// Transform values a define call takes on top of the define's own values.
const CALL_TRANSFORM = ['angle', 'scale', 'flip', 'dx', 'dy'];
// Built-in values that are the same for every pixel of a frame, as CPU closures (see cpu.js).
const FRAME_BUILTINS = ['t', 'p', 'dur', 'beat', 'pulse', 'aspect', 'pi', 'tau'];
// Built-in names a sim's states and lets may not take: the others (x, y, p, ...) are natural names
// for positions, and inside a sim the pixel values don't exist anyway.
const SIM_RESERVED = ['t', 'dt', 'pi', 'tau'];
// Simulations default to this many steps per second, enough for bounces and springs.
const SIM_STEP = 1 / 240;

class Scope {
  constructor(parent = null) { this.vars = new Map(); this.parent = parent; }
  get(n) { return this.vars.get(n) || (this.parent ? this.parent.get(n) : null); }
  names() { return [...this.vars.keys()].concat(this.parent ? this.parent.names() : []); }
}

// Names a program may not reuse for its own values. Function and color names are allowed:
// `let bounce = ...` or `let sky = ...` are natural, and calls always have parentheses.
function reservedReason(name, defines, uses = []) {
  if (BUILTINS[name]) return 'a built-in value';
  if (COMMANDS.includes(name) || SHAPES[name] || uses.some((p) => p.shapes && own(p.shapes, name))) return 'a command';
  if (SCENE_VALUES.includes(name)) return 'a scene value';
  if (defines && defines.has(name)) return 'a define';
  return null;
}

// The names a formula reads, so a value's CPU closure can be built later from the meanings they had.
function namesIn(n, out = new Set()) {
  if (n.t === 'var') out.add(n.name);
  else if (n.t === 'neg') namesIn(n.a, out);
  else if (n.t === 'bin') { namesIn(n.a, out); namesIn(n.b, out); }
  else if (n.t === 'call') n.args.forEach((a) => namesIn(a, out));
  return out;
}

class Compiler {
  constructor(program) {
    this.program = program;
    this.uid = 0;
    this.out = [];
    this.funcs = []; // GLSL functions in order: { name, code, deps }
    this.globals = []; // GLSL globals (anchor values)
    this.helpers = new Map(); // GLSL functions plugins add, by name, each emitted once
    this.defs = new Map();
    this.fns = new Map();
    this.globalNames = new Map(); // name -> what it is, for inputs, cues, tracks, sims and fns
    this.errors = [];
    this.inDefine = null;
    this.inFn = null;
    this.fnStack = [];
    this.draws = 0; // drawing statements outside defines, plus define uses
    this.work = 0; // running total of expensive function calls, in shapes (see FUNCTION_COST)
    this.mult = 1; // how many times the current line runs per pixel: the product of enclosing repeat counts
    this.lineCost = new Map(); // source line -> cost per pixel while it is drawn (outside defines)
    this.warnings = [];
    this.bounded = 0; // the heaviest define with bounds: pixels pay for it only inside its circle
    this.boundedExtra = 0; // what bounded drawings would add if they all covered the same pixel
    this.skipRecord = false;
    this.camStack = []; // cameras in force: { save, tid, level }
    this.xfLevel = 0; // groups entered since the start of the define or program
    this.deps = null; // the GLSL functions the code being compiled calls (for one shader per scene)
    this.sceneParts = []; // top-level scenes: where their code is in out, and what they call
    // per-frame values: sim states, smooth() and tracks
    this.slots = 0;
    this.exposed = [];
    this.steppers = [];
    this.simSteps = []; // each sim's step; smooth() wants SIM_STEP or finer
    this.hasSmooth = false;
    this.inSim = null;
    this.usesInputs = false;
  }

  record(line, k) {
    if (!this.inDefine && k > 0) this.lineCost.set(line, (this.lineCost.get(line) || 0) + k * this.mult);
  }

  error(line, msg) { return new XytError(line, msg); }

  checkName(name, line, what) {
    if (name.includes('.')) throw this.error(line, `a name can't have dots ('${name}'): dots read the values of named drawings and sims, like mila.hand.x or ball.y`);
    const why = reservedReason(name, this.program.defines, this.program.uses);
    if (why) throw this.error(line, `'${name}' is ${why}; pick another name for this ${what}`);
  }

  checkSimName(name, line, what) {
    if (SIM_RESERVED.includes(name)) throw this.error(line, `'${name}' is ${name === 't' ? 'the time' : name === 'dt' ? 'the length of a step' : 'a constant'} in a sim; pick another name for this ${what}`);
    if (!BUILTINS[name]) this.checkName(name, line, what);
  }

  // The error for a dotted name nobody gave: mila.foot.x
  unknownDotted(name, sc, line) {
    const first = name.split('.')[0], owner = sc.get(first);
    if (owner && owner.values) return this.error(line, `${first} has no '${name.slice(first.length + 1)}'. It has: ${owner.values.join(', ') || 'nothing yet'}`);
    return this.error(line, `unknown name '${name}': '${first}' is not a named drawing or a sim here. Name a drawing with name=${first} to read its values and anchors, like ${first}.cx or ${first}.hand.x`);
  }

  // Inputs, cues, tracks, sims and fns share one set of names.
  checkGlobal(name, line, what) {
    this.checkName(name, line, what);
    const other = this.globalNames.get(name);
    if (other) throw this.error(line, `'${name}' is already the name of ${other}; pick another name for this ${what}`);
    this.globalNames.set(name, `${/^[aeiou]/.test(what) ? 'an' : 'a'} ${what}`);
  }

  noteUse(name) { if (this.deps) this.deps.add(name); }
  addFunc(name, code, deps) { this.funcs.push({ name, code, deps: deps || new Set() }); }

  // Runs fn with the compiler set up for a separate GLSL function body, then puts everything back.
  inBody(setup, fn) {
    const saved = {
      out: this.out, deps: this.deps, work: this.work, inDefine: this.inDefine, inFn: this.inFn,
      camStack: this.camStack, xfLevel: this.xfLevel, mult: this.mult,
    };
    this.out = []; this.deps = new Set(); this.work = 0; this.camStack = []; this.xfLevel = 0; this.mult = 1;
    Object.assign(this, setup);
    try { return fn(); } finally {
      const body = { out: this.out, deps: this.deps, work: this.work };
      Object.assign(this, saved);
      this.lastBody = body;
    }
  }

  // ---------- per-frame values ----------
  slot() { return this.slots++; }
  // The shader reads exposed values from one uniform array of vec4s.
  expose(entry) {
    if (this.exposed.length >= LIMITS.frameValues) throw this.error(entry.line || 0, `a program can have up to ${LIMITS.frameValues} sim states, tracks and smooth() values`);
    this.exposed.push(entry);
    const e = this.exposed.length - 1;
    return `u_fv[${e >> 2}].${'xyzw'[e & 3]}`;
  }

  // How much work a formula is on the CPU: its operations, and the bodies of the fns it calls.
  cpuWork(node) {
    switch (node.t) {
      case 'neg': return 1 + this.cpuWork(node.a);
      case 'bin': return 1 + this.cpuWork(node.a) + this.cpuWork(node.b);
      case 'call': {
        let w = 1 + node.args.reduce((s, a) => s + this.cpuWork(a), 0);
        if (node.fn === 'fbm') w += 20;
        else if (node.fn === 'noise') w += 4;
        const f = this.fns.get(node.fn);
        if (f) {
          if (f.cpuWork === undefined) {
            f.cpuWork = Infinity; // a fn can't use itself; this only guards the count
            f.cpuWork = f.node.body.reduce((s, l) => s + this.cpuWork(l.expr), 0) + this.cpuWork(f.node.ret);
          }
          w += f.cpuWork;
        }
        return w;
      }
      default: return 1;
    }
  }

  // A formula as a CPU closure, for values that must be the same for every pixel of a frame.
  cpuExpr(node, sc, line, what) {
    return buildCpu(node, {
      line, what,
      resolve: (name) => this.cpuName(name, sc, line, what),
      fn: (name) => (this.fns.has(name) ? this.cpuFn(name, line, what) : null),
      bar: (n, b) => this.barTime(n, b),
      smooth: (args) => this.hoistSmooth(args, sc, line).cpu,
    });
  }

  cpuName(name, sc, line, what) {
    const v = sc.get(name);
    if (v) return this.cpuOf(v, name, line, what);
    if (FRAME_BUILTINS.includes(name)) {
      const D = this.program.duration, bps = this.program.bpm / 60, off = this.program.offset, aspect = this.program.aspect;
      return {
        t: (F) => F.t, p: (F) => F.t / D, dur: () => D, aspect: () => aspect, pi: () => Math.PI, tau: () => Math.PI * 2,
        beat: (F) => (F.t - off) * bps,
        pulse: (F) => { const b = (F.t - off) * bps; return b < 0 ? 0 : Math.exp(-(b - Math.floor(b)) * 5); },
      }[name];
    }
    if (BUILTINS[name]) throw this.error(line, `${what} uses '${name}', which changes from pixel to pixel (or with the pointer); it needs values that are the same for the whole frame`);
    if (NAMED_COLORS[name]) throw this.error(line, `${what} works with numbers; '${name}' is a color`);
    if (SCENE_VALUES.includes(name)) throw this.error(line, `'${name}' only exists inside a scene block`);
    if (name.includes('.')) throw this.unknownDotted(name, sc, line);
    throw this.error(line, `unknown name '${name}'.` + suggest(name, sc.names()));
  }

  cpuOf(v, name, line, what) {
    if (v.cpu) return v.cpu;
    if (v.failed) throw this.error(line, v.failed);
    if (v.ast) {
      // a let: built from the meanings its names had where it was written
      const binds = v.binds;
      const scope = { get: (n) => binds.get(n) || null, names: () => [...binds.keys()] };
      try { v.cpu = this.cpuExpr(v.ast, scope, v.line, what); } catch (e) {
        if (!e.xyt) throw e;
        v.failed = `${what} uses '${name}', and ${e.message.replace(/^unknown name/, 'that uses an unknown name')}`;
        throw this.error(line, v.failed);
      }
      return v.cpu;
    }
    if (v.t === 'point') throw this.error(line, `'${name}' is a point; use ${name}.x and ${name}.y`);
    if (v.t === 'col') throw this.error(line, `${what} works with numbers; '${name}' is a color`);
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
      f.node.params.forEach((p, i) => scope.vars.set(p, { t: 'num', cpu: (F, A) => A[i] }));
      const lets = f.node.body.map((l, j) => {
        const g = this.cpuExpr(l.expr, scope, l.line, what);
        scope.vars.set(l.name, { t: 'num', cpu: (F, A, L) => L[j] });
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
        },
      };
      return f.cpu;
    } finally { this.fnStack.pop(); }
  }

  barTime(n, b) {
    const P = this.program;
    return P.offset + ((n - 1) * P.bar + (b - 1)) * 60 / P.bpm;
  }

  // smooth(value, seconds): value followed by a critically damped spring, worked out on the CPU.
  hoistSmooth(args, sc, line) {
    if (this.inDefine || this.inFn) {
      throw this.error(line, 'smooth() works in scenes and at the top level, not inside a define or fn: smooth there and pass the result in as a value');
    }
    if (this.inSim) throw this.error(line, `smooth() can't go inside a sim; follow a value with a state there, like: v += (target - v) * 4 * dt`);
    this.hasSmooth = true;
    if (args.length !== 2) throw this.error(line, 'smooth() takes a value and about how many seconds it lags behind: smooth(PX, 0.5)');
    const target = this.cpuExpr(args[0], sc, line, 'smooth()');
    const secs = this.cpuExpr(args[1], sc, line, 'smooth()');
    const pos = this.slot(), vel = this.slot();
    this.steppers.push({
      init: (F) => { F.v[pos] = target(F); F.v[vel] = 0; },
      // the exact solution over one step, so any lag and step are stable
      step: (F) => {
        const w = 4 / Math.max(secs(F), 0.02), goal = target(F), dt = F.dt;
        const c1 = F.v[pos] - goal, c2 = F.v[vel] + w * c1, e = Math.exp(-w * dt);
        F.v[pos] = goal + (c1 + c2 * dt) * e;
        F.v[vel] = (c2 - w * (c1 + c2 * dt)) * e;
      },
      work: 6 + this.cpuWork(args[0]) + this.cpuWork(args[1]),
    });
    const c = this.expose({ slot: pos, name: 'smooth', line });
    return { c, cpu: (F) => F.v[pos] };
  }

  // ---------- expressions ----------
  ex(n, sc, line) {
    const E = (m) => this.error(line, m);
    switch (n.t) {
      case 'num': return { c: fmt(n.v), t: 'num' };
      case 'hex': return { c: vec3(parseHex(n.v)), t: 'col' };
      case 'var': {
        const v = sc.get(n.name);
        if (v) {
          if (v.t === 'point') throw E(`'${n.name}' is a point; use ${n.name}.x and ${n.name}.y, or attach=${n.name} to place a shape on it`);
          if (v.t === 'instance') throw E(`'${n.name}' is a named drawing; read its values like ${n.name}.${v.values[0] || 'cx'}`);
          if (v.t === 'sim') throw E(`'${n.name}' is a sim; read its states like ${n.name}.${v.values[0] || 'y'}`);
          if (v.c === null) throw E(`'${n.name}' only exists inside its sim`);
          return v;
        }
        if (BUILTINS[n.name]) return { c: BUILTINS[n.name], t: 'num' };
        if (NAMED_COLORS[n.name]) return { c: vec3(parseHex(NAMED_COLORS[n.name])), t: 'col' };
        if (FUNCTIONS.includes(n.name) || this.fns.has(n.name)) throw E(`${n.name} is a function: write ${n.name}(...)`);
        if (SCENE_VALUES.includes(n.name)) {
          throw E(this.inDefine ? `'${n.name}' is not available inside define ${this.inDefine}; pass it in as a value`
            : this.inFn ? `'${n.name}' is not available inside fn ${this.inFn}; pass it in as a value` : `'${n.name}' only exists inside a scene block`);
        }
        if (n.name.includes('.')) throw this.unknownDotted(n.name, sc, line);
        const known = sc.names().concat(Object.keys(BUILTINS), Object.keys(NAMED_COLORS));
        const hint = this.inDefine ? ` Inside define ${this.inDefine}, only its own values, inputs and built-ins exist; pass other values in.`
          : this.inFn ? ` Inside fn ${this.inFn}, only its own values, inputs and built-ins exist; pass other values in.` : ' Define it first with let.';
        throw E(`unknown name '${n.name}'.` + suggest(n.name, known) + hint);
      }
      case 'neg': { const a = this.ex(n.a, sc, line); return { c: `(-${a.c})`, t: a.t }; }
      case 'bin': {
        const a = this.ex(n.a, sc, line), b = this.ex(n.b, sc, line);
        const anyCol = a.t === 'col' || b.t === 'col';
        if (['<', '>', '<=', '>=', '==', '!='].includes(n.op)) {
          if (anyCol) throw E(`'${n.op}' compares numbers, not colors`);
          return { c: `(${a.c} ${n.op} ${b.c} ? 1.0 : 0.0)`, t: 'num' };
        }
        if (n.op === '&&' || n.op === '||') {
          if (anyCol) throw E(`'${n.op}' combines conditions (numbers), not colors`);
          return { c: `((${a.c} != 0.0) ${n.op} (${b.c} != 0.0) ? 1.0 : 0.0)`, t: 'num' };
        }
        if (n.op === '^') {
          if (b.t === 'col') throw E('the power after ^ must be a number');
          return a.t === 'col' ? { c: `pw3(${a.c},${b.c})`, t: 'col' } : { c: `pw(${a.c},${b.c})`, t: 'num' };
        }
        if (n.op === '%') {
          if (b.t === 'col' && a.t !== 'col') throw E("'%' needs a number on the right");
          return { c: `mod(${a.c},${b.c})`, t: a.t };
        }
        return { c: `(${a.c} ${n.op} ${b.c})`, t: anyCol ? 'col' : 'num' };
      }
      case 'call': return this.call(n, sc, line);
    }
    throw E('this value could not be understood');
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
    if (fn === 'smooth') {
      const { c, cpu } = this.hoistSmooth(n.args, sc, line);
      return { c, t: 'num', cpu };
    }
    const args = n.args.map((a) => this.ex(a, sc, line));
    const count = (lo, hi = lo) => {
      if (args.length < lo || args.length > hi) {
        throw E(`${fn}() takes ${lo === hi ? lo : lo + ' to ' + hi} value${hi === 1 ? '' : 's'}, got ${args.length}`);
      }
    };
    const nums = () => args.forEach((a, i) => { if (a.t !== 'num') throw E(`${fn}() value ${i + 1} must be a number, not a color`); });
    const anyCol = () => args.some((a) => a.t === 'col');
    const c = (i) => args[i].c;
    if (UNARY.includes(fn)) { count(1); return { c: `${fn}(${c(0)})`, t: args[0].t }; }
    switch (fn) {
      case 'round': count(1); return { c: `floor(${c(0)}+0.5)`, t: args[0].t };
      case 'sqrt': count(1); return { c: `sqrt(max(${c(0)},0.0))`, t: args[0].t };
      case 'log': count(1); return { c: `log(max(${c(0)},1e-9))`, t: args[0].t };
      case 'atan': count(1, 2); nums(); return { c: `atan(${args.map((a) => a.c).join(',')})`, t: 'num' };
      case 'atan2': count(2); nums(); return { c: `atan(${c(0)},${c(1)})`, t: 'num' };
      case 'pow':
        count(2);
        if (args[1].t === 'col') throw E('pow() power must be a number');
        return args[0].t === 'col' ? { c: `pw3(${c(0)},${c(1)})`, t: 'col' } : { c: `pw(${c(0)},${c(1)})`, t: 'num' };
      case 'min': case 'max': case 'mod':
        count(2);
        if (anyCol()) return { c: `${fn}(${asCol(args[0])},${asCol(args[1])})`, t: 'col' };
        return { c: `${fn}(${c(0)},${c(1)})`, t: 'num' };
      case 'saturate': count(1); return { c: `clamp(${c(0)},0.0,1.0)`, t: args[0].t };
      case 'clamp':
        count(1, 3);
        if (args.length === 2) throw E('clamp() takes clamp(v) for 0 to 1, or clamp(v, low, high)');
        if (args.length === 1) return { c: `clamp(${c(0)},0.0,1.0)`, t: args[0].t };
        if (args[0].t === 'num' && (args[1].t === 'col' || args[2].t === 'col')) throw E('clamp() limits must be numbers');
        // GLSL has clamp(color, number, number) and clamp(color, color, color), but no mix of the two
        if (args[1].t !== args[2].t) return { c: `clamp(${c(0)},${asCol(args[1])},${asCol(args[2])})`, t: 'col' };
        return { c: `clamp(${c(0)},${c(1)},${c(2)})`, t: args[0].t };
      case 'mix': case 'lerp':
        count(3);
        if (anyCol()) return { c: `mix(${asCol(args[0])},${asCol(args[1])},${c(2)})`, t: 'col' };
        return { c: `mix(${c(0)},${c(1)},${c(2)})`, t: 'num' };
      case 'smoothstep':
        count(3);
        if (args[0].t === 'col' || args[1].t === 'col') throw E('smoothstep() edges must be numbers');
        return args[2].t === 'col' ? { c: `ssf3(${c(0)},${c(1)},${c(2)})`, t: 'col' } : { c: `ssf(${c(0)},${c(1)},${c(2)})`, t: 'num' };
      case 'step':
        count(2);
        if (args[0].t === 'col') throw E('step() edge must be a number');
        return { c: `step(${c(0)},${c(1)})`, t: args[1].t };
      case 'dist':
        if (args.length === 2) { nums(); return { c: `length(vec2(${c(0)},${c(1)}))`, t: 'num' }; }
        count(4); nums();
        return { c: `distance(vec2(${c(0)},${c(1)}),vec2(${c(2)},${c(3)}))`, t: 'num' };
      case 'rgb': count(3); nums(); return { c: `vec3(${c(0)},${c(1)},${c(2)})`, t: 'col' };
      case 'gray': count(1); nums(); return { c: `vec3(${c(0)})`, t: 'col' };
      case 'hsl': count(3); nums(); return { c: `hsl(${c(0)},${c(1)},${c(2)})`, t: 'col' };
      case 'noise': case 'fbm': {
        count(1, 3); nums();
        this.work += FUNCTION_COST[fn][args.length - 1];
        const f = fn === 'noise' ? 'vn' : 'fb';
        if (args.length === 3) return { c: `${f}3(vec3(${c(0)},${c(1)},${c(2)}))`, t: 'num' };
        return { c: `${f}2(vec2(${c(0)},${args.length > 1 ? c(1) : '0.0'}))`, t: 'num' };
      }
      case 'hash':
        count(1, 2); nums();
        return args.length === 1 ? { c: `h11(${c(0)})`, t: 'num' } : { c: `h21(vec2(${c(0)},${c(1)}))`, t: 'num' };
      case 'ease': count(1); nums(); return { c: `ssf(0.0,1.0,${c(0)})`, t: 'num' };
      case 'easein': count(1); nums(); return { c: `e_in(${c(0)})`, t: 'num' };
      case 'easeout': count(1); nums(); return { c: `e_out(${c(0)})`, t: 'num' };
      case 'backout': count(1); nums(); return { c: `e_back(${c(0)})`, t: 'num' };
      case 'bounce': count(1); nums(); return { c: `e_bounce(${c(0)})`, t: 'num' };
      case 'pingpong': count(1); nums(); return { c: `(1.0-abs(fract(${c(0)})*2.0-1.0))`, t: 'num' };
      case 'spring':
        // spring(t, freq, damping): a wobble starting at t = 0
        count(1, 3); nums();
        return { c: `spring(${c(0)},${args.length > 1 ? c(1) : '2.0'},${args.length > 2 ? c(2) : '4.0'})`, t: 'num' };
      case 'hits':
        // hits(t, t1, t2, ...): 1 at each listed time, fading fast
        if (args.length < 2) throw E('hits() takes a time, then the times of the hits: hits(t, 1, 2.5, 4)');
        nums();
        return { c: args.slice(1).map((a) => `hit(${c(0)} - ${a.c})`).reduce((x, y) => `max(${x},${y})`), t: 'num' };
      case 'bar': {
        // bar(n, beat): the time of beat `beat` of bar n, both counting from 1
        if (args.length < 1 || args.length > 2) throw E('bar() takes the bar, and optionally the beat, counting from 1: bar(9) or bar(9, 3)');
        nums();
        const P = this.program, beat = 60 / P.bpm;
        return { c: `(${fmt(P.offset)} + (${c(0)} - 1.0) * ${fmt(beat * P.bar)} + (${args.length > 1 ? c(1) : '1.0'} - 1.0) * ${fmt(beat)})`, t: 'num' };
      }
      case 'keys': {
        // keys(time, t0, v0, t1, v1, ...): smooth movement between key values
        if (args.length < 5 || (args.length - 1) % 2 !== 0) {
          throw E('keys() takes a time, then pairs of key time and value: keys(t, 0, 0.2, 1.5, 0.8, 3, 0.2)');
        }
        if (args[0].t !== 'num') throw E('keys() first value must be the time, a number');
        const pairs = [];
        for (let i = 1; i < args.length; i += 2) {
          if (args[i].t !== 'num') throw E(`keys() value ${i + 1} is a key time and must be a number`);
          pairs.push([args[i], args[i + 1]]);
        }
        const col = pairs.some(([, v]) => v.t === 'col');
        const val = (v) => (col ? asCol(v) : v.c);
        let r = val(pairs[0][1]);
        for (let i = 1; i < pairs.length; i++) {
          r = `mix(${r},${val(pairs[i][1])},ssf(${pairs[i - 1][0].c},${pairs[i][0].c},${c(0)}))`;
        }
        return { c: r, t: col ? 'col' : 'num' };
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
      throw E(`${n.fn}() takes ${params.length} value${params.length === 1 ? '' : 's'}: ${n.fn}(${params.join(', ')})`);
    }
    const args = n.args.map((a) => this.ex(a, sc, line));
    const spec = this.fnSpec(f, args.map((a) => a.t), line);
    if (spec.failed) throw E(`${n.fn}() can't be used because its fn has a problem`);
    // a call counts as one shape plus its body, so fns that call fns can't hide their work from the limit
    this.work += 1 + spec.work;
    this.noteUse(spec.fname);
    return { c: `${spec.fname}(${args.map((a) => a.c).join(',')})`, t: spec.t };
  }

  fnSpec(f, types, line) {
    const sig = types.join(',');
    // GLSL has no recursion; checked before the cache, which holds a fn while it compiles
    if (this.fnStack.includes(f.node.name)) throw this.error(line, `fn ${f.node.name} can't use itself`);
    if (f.specs.has(sig)) return f.specs.get(sig);
    const fname = `F_${glslName(f.node.name)}_${f.specs.size}`;
    const spec = { fname, t: 'num', work: 0, failed: false };
    f.specs.set(sig, spec);
    this.fnStack.push(f.node.name);
    try {
      this.inBody({ inFn: f.node.name, inDefine: null }, () => {
        const scope = new Scope(this.root);
        f.node.params.forEach((p, i) => scope.vars.set(p, { c: `a_${glslName(p)}`, t: types[i] }));
        for (const l of f.node.body) {
          this.checkName(l.name, l.line, 'value');
          const r = this.ex(l.expr, scope, l.line);
          const g = `v_${glslName(l.name)}_${++this.uid}`;
          this.out.push(`  ${glslType(r.t)} ${g} = ${r.c};`);
          scope.vars.set(l.name, { c: g, t: r.t });
        }
        const r = this.ex(f.node.ret, scope, f.node.retLine);
        spec.t = r.t;
        this.out.push(`  return ${r.c};`);
      });
      const body = this.lastBody;
      spec.work = body.work;
      const ps = f.node.params.map((p, i) => `${glslType(types[i])} a_${glslName(p)}`).join(', ');
      this.addFunc(fname, `${glslType(spec.t)} ${fname}(${ps}) {\n${body.out.join('\n')}\n}`, body.deps);
    } catch (e) {
      if (!e.xyt) throw e;
      spec.failed = true;
      if (!f.reported) { f.reported = true; this.errors.push(e); }
    } finally { this.fnStack.pop(); }
    return spec;
  }

  // ---------- statements; each returns its cost (shape evaluations per pixel) ----------
  stmts(list, sc, ind) {
    let cost = 0, sceneMax = 0;
    const block = { camera: 0 }; // a camera lasts until the end of its block
    for (const s of list) {
      try {
        const work = this.work;
        this.skipRecord = false;
        let k = this.stmt(s, sc, ind, block);
        // Blocks count their own contents; single lines add the noise and fbm they call.
        if (!BLOCKS.includes(s.k)) {
          k += this.work - work;
          if (!this.skipRecord) this.record(s.line, k);
        }
        if (s.k === 'scene') sceneMax = Math.max(sceneMax, k); else cost += k;
      } catch (e) {
        if (!e.xyt) throw e;
        this.errors.push(e);
        if (s.k === 'let' && !sc.vars.has(s.name)) sc.vars.set(s.name, { c: '0.0', t: 'num' }); // avoid cascades
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
      case 'let': {
        this.checkName(s.name, s.line, 'value');
        const r = this.ex(s.expr, sc, s.line);
        const g = `v_${glslName(s.name)}_${++this.uid}`;
        o.push(`${ind}${glslType(r.t)} ${g} = ${r.c};`);
        const entry = { c: g, t: r.t };
        if (r.cpu) entry.cpu = r.cpu; // let cam = smooth(...)
        else if (!this.inDefine && !this.inFn && r.t === 'num') {
          // remembered, so smooth() can follow this value on the CPU if it is the same for the whole frame
          entry.ast = s.expr;
          entry.line = s.line;
          entry.binds = new Map([...namesIn(s.expr)].map((n) => [n, sc.get(n)]).filter(([, v]) => v));
        }
        sc.vars.set(s.name, entry);
        return 0;
      }
      case 'repeat': {
        this.checkName(s.name, s.line, 'loop counter');
        if (s.count > LIMITS.repeat) throw E(`repeat counts up to ${LIMITS.repeat}; use a smaller count`);
        const id = ++this.uid, g = `v_${glslName(s.name)}_${id}`;
        o.push(`${ind}for (int k_${id} = 0; k_${id} < ${s.count}; k_${id}++) { float ${g} = float(k_${id});`);
        const inner = new Scope(sc);
        inner.vars.set(s.name, { c: g, t: 'num' });
        const mult = this.mult;
        this.mult *= s.count;
        let cost;
        try { cost = this.stmts(s.body, inner, ind + '  '); } finally { this.mult = mult; }
        o.push(`${ind}}`);
        return cost * s.count;
      }
      case 'scene': {
        const id = ++this.uid, a = fmt(s.start), b = fmt(s.end);
        // what the scene calls, and where its code is, so a shader can leave out the scenes not playing
        const deps = this.deps, from = o.length;
        this.deps = new Set();
        o.push(`${ind}if (T >= ${a} && T < ${b}) { vec3 sv_${id} = col;`);
        o.push(`${ind}  float v_st_${id} = T - ${a}; float v_sp_${id} = v_st_${id} / ${fmt(s.end - s.start)}; float v_sb_${id} = v_st_${id} * ${fmt(this.program.bpm / 60)};`);
        const inner = new Scope(sc);
        const start = s.start, len = s.end - s.start, bps = this.program.bpm / 60;
        inner.vars.set('st', { c: `v_st_${id}`, t: 'num', cpu: (F) => F.t - start });
        inner.vars.set('sp', { c: `v_sp_${id}`, t: 'num', cpu: (F) => (F.t - start) / len });
        inner.vars.set('sb', { c: `v_sb_${id}`, t: 'num', cpu: (F) => (F.t - start) * bps });
        let cost;
        try { cost = this.stmts(s.body, inner, ind + '  '); } finally {
          let fade = '';
          if (s.fadein > 0) fade += ` * clamp(v_st_${id} / ${fmt(s.fadein)}, 0.0, 1.0)`;
          if (s.fadeout > 0) fade += ` * clamp((${b} - T) / ${fmt(s.fadeout)}, 0.0, 1.0)`;
          if (fade) o.push(`${ind}  col = mix(sv_${id}, col, 1.0${fade});`);
          o.push(`${ind}}`);
          this.sceneParts.push({ start: s.start, end: s.end, from, to: o.length, deps: this.deps });
          this.deps = deps;
        }
        return cost;
      }
      case 'define': return this.define(s);
      case 'fn': {
        if (FUNCTIONS.includes(s.name)) throw E(`'${s.name}' is a built-in function; pick another name for this fn`);
        if (this.program.defines.has(s.name)) throw E(`'${s.name}' is a define; pick another name for this fn`);
        this.checkGlobal(s.name, s.line, 'fn');
        const f = { node: s, specs: new Map(), reported: false };
        this.fns.set(s.name, f);
        // compiled once with numbers, so problems show even before it is used
        this.fnSpec(f, s.params.map(() => 'num'), s.line);
        return 0;
      }
      case 'sim': this.sim(s); return 0;
      case 'anchor': {
        // drawn nothing here: checked, and computed only for named uses (see anchorFn)
        this.anchorValues(s, sc);
        return 0;
      }
      case 'bounds': {
        const { v, num } = this.namedValues(s, sc, BOUNDS, 'bounds');
        for (const k of ['cx', 'cy', 'r']) if (!v[k]) throw E(`bounds needs cx, cy and r: the circle the whole drawing stays within, like: bounds cx=cx cy=cy r=0.3 * s`);
        // a camera above it in the define is put back first: callers without a transform don't save the sampling point
        const back = this.camStack.length ? ` ${this.restore(this.camStack[0].save)}` : '';
        o.push(`${ind}if (length(PP - vec2(${num('cx')}, ${num('cy')})) - abs(${num('r')}) > PX) {${back} return col; }`);
        return 0;
      }
      case 'group': {
        const work = this.work;
        const attrs = Object.assign({}, s.attrs);
        const depth = attrs.depth;
        delete attrs.depth;
        const t = this.transformValues(attrs, sc, s.line, 'group');
        const ownCost = this.work - work;
        this.record(s.line, ownCost);
        if (!s.body.length) throw E("this group is empty; put shapes between it and 'end'");
        const id = ++this.uid;
        o.push(`${ind}{ ${this.save(id)}`);
        if (depth) {
          // parallax: the camera's movement, divided by the depth
          const cam = this.camStack[this.camStack.length - 1];
          if (!cam) throw E('depth makes a group follow the camera more slowly when it is farther: it needs a camera line above it, in this block or scene');
          if (this.xfLevel !== cam.level) throw E("a group with depth must sit directly in its camera's block, not inside another group");
          const d = this.ex(depth, sc, s.line);
          if (d.t === 'col') throw E("'depth' must be a number, not a color");
          const j = ++this.uid, c = cam.tid;
          o.push(`${ind}  PP = sp_${cam.save}; PX = spx_${cam.save};`,
            `${ind}  float dk_${j} = 1.0 / max(${d.c}, 0.01);`,
            `${ind}  vec2 tc_${j} = tc_${c}; float ts_${j} = sign(ts_${c}) * pow(abs(ts_${c}), dk_${j}); float tf_${j} = tf_${c}; float ta_${j} = ta_${c}; vec2 td_${j} = td_${c} * dk_${j};`,
            ...this.applyVars(j, ind + '  '));
        }
        if (Object.keys(attrs).length || !depth) o.push(...this.applyTransform(t, ind + '  ', ++this.uid));
        this.xfLevel++;
        let cost;
        try { cost = this.stmts(s.body, new Scope(sc), ind + '  '); } finally { this.xfLevel--; }
        o.push(`${ind}  ${this.restore(id)} }`);
        return ownCost + cost;
      }
      case 'camera': {
        const t = this.transformValues(s.attrs, sc, s.line, 'camera');
        const tid = ++this.uid;
        // A later camera in the same block replaces the earlier one.
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
      case 'clip': {
        const work = this.work;
        const { v, num, fixed } = this.shapeValues(s, sc, CLIP_OPTIONS, `clip ${s.type}`);
        const ownCost = (s.def && s.def.cost ? s.def.cost(s.str, fixed) : 1) + this.work - work;
        this.record(s.line, ownCost);
        if (!s.body.length) throw E(`this clip ${s.type} is empty; put shapes between it and 'end'`);
        // The contents blend over what was there before by the shape's coverage, the way scene
        // fades do, and pixels outside the shape skip the contents entirely.
        const id = ++this.uid;
        o.push(`${ind}{ vec3 cs_${id} = col; float cc_${id};`, ...this.coverage(s, v, num, ind + '  ', fixed));
        o.push(`${ind}    cc_${id} = ${v.invert ? `mix(cv, 1.0 - cv, clamp(${num('invert')}, 0.0, 1.0))` : 'cv'}; }`);
        o.push(`${ind}  if (cc_${id} > 0.0) {`);
        const cost = this.stmts(s.body, new Scope(sc), ind + '    ');
        o.push(`${ind}    col = mix(cs_${id}, col, cc_${id});`, `${ind}  } }`);
        return ownCost + cost;
      }
      case 'call': return this.callDefine(s, sc, ind);
      case 'fill': return this.fill(s, sc, ind);
      case 'shape': return this.shape(s, sc, ind);
    }
    throw E('this line could not be understood');
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
      if (CALL_TRANSFORM.includes(a)) { moves[a] = s.attrs[a]; continue; }
      if (a === 'name') { instance = this.instanceName(s.attrs.name, s.line); continue; }
      if (a === 'attach') continue;
      throw E(`${s.name} has no '${a}'.` + suggest(a, names.concat(CALL_TRANSFORM, ['name', 'attach'])) +
        ` It takes: ${names.join(', ')}; ${CALL_TRANSFORM.join(', ')} to turn, scale, mirror or move it; name= to read its values below; attach= to place it on a point`);
    }
    if (own(s.attrs, 'attach') && !names.includes('attach')) {
      if (!names.includes('cx') || !names.includes('cy')) throw E(`attach places a drawing by its cx and cy, and define ${s.name} has no cx and cy values`);
      attrs = this.attachTo(s.attrs, ['cx', 'cy'], sc, s.line);
    }
    let args = d.params.map((q) => {
      if (!attrs[q.name]) return q.def;
      const r = this.ex(attrs[q.name], sc, s.line);
      if (q.t === 'num' && r.t === 'col') throw E(`'${q.name}' must be a number, not a color`);
      return q.t === 'col' ? asCol(r) : r.c;
    });
    const id = ++this.uid;
    if (instance) {
      // worked out once, so the drawing and the values read from it agree
      args = args.map((a, i) => { const g = `n_${id}_${i}`; o.push(`${ind}${glslType(d.params[i].t)} ${g} = ${a};`); return g; });
    }
    const call = `col = ${d.fname}(col${args.map((a) => ', ' + a).join('')});`;
    this.noteUse(d.fname);
    let tid = null;
    if (Object.keys(moves).length) {
      // A drawing with cx and cy turns and scales around them; others around the canvas center.
      const at = (n) => { const i = names.indexOf(n); return i >= 0 && d.params[i].t === 'num' ? `(${args[i]})` : null; };
      const t = this.transformValues(moves, sc, s.line, s.name, { cx: at('cx'), cy: at('cy') });
      tid = ++this.uid;
      o.push(`${ind}${this.save(id)}`, ...this.applyTransform(t, ind, tid), `${ind}${call}`, `${ind}${this.restore(id)}`);
    } else o.push(`${ind}${call}`);
    if (instance) {
      this.nameInstance(instance, d, args, tid, sc, ind, s.line);
      this.work += d.pwork || 0; // its anchors are worked out again, lets and all
    }
    this.draws++;
    if (!this.inDefine && this.mult > 1 && d.cost * this.mult >= LIMITS.warnLine) {
      this.warnings.push({ line: s.line, message: `${s.name} costs about ${d.cost} shapes and repeat draws it ${this.mult} times, so this line alone costs about ${d.cost * this.mult} per pixel` });
    }
    if (d.bounded) {
      // pixels outside its circle only pay for the test
      this.bounded = Math.max(this.bounded, d.cost);
      if (!this.inDefine) this.boundedExtra += (d.cost - 1) * this.mult;
      this.record(s.line, d.cost);
      this.skipRecord = true;
      return 1;
    }
    return d.cost;
  }

  instanceName(node, line) {
    if (node.t !== 'var' || node.name.includes('.')) {
      throw this.error(line, 'name= takes a plain name for this drawing, like name=mila; the lines below then read its values and anchors, like mila.cx or mila.hand.x');
    }
    this.checkName(node.name, line, 'drawing');
    const other = this.globalNames.get(node.name);
    if (other) throw this.error(line, `'${node.name}' is already the name of ${other}; pick another name for this drawing`);
    return node.name;
  }

  // The values of a named drawing, for the lines below it: mila.cx, mila.hand, mila.hand.x, mila.hand.angle
  nameInstance(name, d, args, tid, sc, ind, line) {
    const values = [];
    d.params.forEach((q, i) => { sc.vars.set(`${name}.${q.name}`, { c: args[i], t: q.t }); values.push(q.name); });
    if (d.anchors.length) {
      const pname = this.anchorFn(d, line);
      this.noteUse(pname);
      this.out.push(`${ind}${pname}(${args.join(', ')});`);
      for (const a of d.anchors) {
        const g = `i_${++this.uid}`;
        this.out.push(`${ind}vec3 ${g} = AN_${glslName(d.name)}_${glslName(a)};`);
        if (tid !== null) {
          this.out.push(`${ind}${g}.xy = fwd(${g}.xy, tc_${tid}, ts_${tid}, tf_${tid}, ta_${tid}, td_${tid}); ` +
            `${g}.z = (tf_${tid} < 0.0 ? 180.0 - ${g}.z : ${g}.z) + ta_${tid} + (ts_${tid} < 0.0 ? 180.0 : 0.0);`);
        }
        const point = { t: 'point', x: `${g}.x`, y: `${g}.y`, angle: `${g}.z` };
        sc.vars.set(`${name}.${a}`, point);
        sc.vars.set(`${name}.${a}.x`, { c: point.x, t: 'num' });
        sc.vars.set(`${name}.${a}.y`, { c: point.y, t: 'num' });
        sc.vars.set(`${name}.${a}.angle`, { c: point.angle, t: 'num' });
        values.push(a, `${a}.x`, `${a}.y`, `${a}.angle`);
      }
    }
    sc.vars.set(name, { t: 'instance', values, c: null });
  }

  // attach=mila.hand: the point's x and y become the values named in keys (cx, cy, or x, y for text).
  attachTo(attrs, keys, sc, line) {
    const node = attrs.attach;
    const E = (m) => this.error(line, m);
    const point = node.t === 'var' ? sc.get(node.name) : null;
    if (!point || point.t !== 'point') {
      throw E(`attach= takes a point of a named drawing, like attach=mila.hand (draw it with name=mila; its define has: anchor hand x=... y=...)`);
    }
    for (const k of keys) if (attrs[k]) throw E(`attach= sets ${keys.join(' and ')}; leave ${k} out`);
    const out = Object.assign({}, attrs);
    delete out.attach;
    out[keys[0]] = { t: 'var', name: node.name + '.x' };
    out[keys[1]] = { t: 'var', name: node.name + '.y' };
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
        this.anchorStmts(d.node.body, body, '  ', [], d);
      });
    } catch (e) {
      // the same lines were compiled with the define, which reported the problem there
      if (!e.xyt || !this.errors.length) throw e;
    }
    const b = this.lastBody;
    const ps = d.params.map((q) => `${glslType(q.t)} a_${glslName(q.name)}`).join(', ');
    this.addFunc(pname, `void ${pname}(${ps}) {\n${b.out.join('\n')}\n}`, b.deps);
    d.pfn = pname;
    d.pwork = b.work;
    return pname;
  }

  anchorStmts(list, sc, ind, xf, d, outerCam = null) {
    let cur = xf.slice(), cam = null;
    const o = this.out;
    for (const s of list) {
      switch (s.k) {
        case 'let': this.stmt(s, sc, ind, {}); break;
        case 'group': {
          const attrs = Object.assign({}, s.attrs);
          const depth = attrs.depth;
          delete attrs.depth;
          const id = ++this.uid;
          o.push(`${ind}{ ${this.save(id)}`);
          let inner = cur;
          const c = cam || outerCam;
          if (depth && c) {
            // as drawn: the camera's transform divided by the depth, in place of the camera's own
            const dv = this.ex(depth, sc, s.line), j = ++this.uid;
            o.push(`${ind}  PP = sp_${c.save}; PX = spx_${c.save};`,
              `${ind}  float dk_${j} = 1.0 / max(${dv.c}, 0.01);`,
              `${ind}  vec2 tc_${j} = tc_${c.tid}; float ts_${j} = sign(ts_${c.tid}) * pow(abs(ts_${c.tid}), dk_${j}); float tf_${j} = tf_${c.tid}; float ta_${j} = ta_${c.tid}; vec2 td_${j} = td_${c.tid} * dk_${j};`,
              ...this.applyVars(j, ind + '  '));
            inner = cur.filter((x) => x !== c.tid).concat([j]);
          }
          if (Object.keys(attrs).length || !depth) {
            const tid = ++this.uid;
            o.push(...this.applyTransform(this.transformValues(attrs, sc, s.line, 'group'), ind + '  ', tid));
            inner = inner.concat([tid]);
          }
          this.anchorStmts(s.body, new Scope(sc), ind + '  ', inner, d, depth ? null : c);
          o.push(`${ind}  ${this.restore(id)} }`);
          break;
        }
        case 'camera': {
          const tid = ++this.uid;
          if (cam) o.push(`${ind}${this.restore(cam.save)}`);
          else { cam = { save: ++this.uid }; o.push(`${ind}${this.save(cam.save)}`); }
          o.push(...this.applyTransform(this.transformValues(s.attrs, sc, s.line, 'camera'), ind, tid));
          cur = cur.filter((x) => x !== cam.tid).concat([tid]);
          cam.tid = tid;
          break;
        }
        case 'anchor': {
          const num = this.anchorValues(s, sc);
          const lines = [`${ind}{ vec2 ap = vec2(${num('x')}, ${num('y')}); float aa = ${num('angle')};`];
          for (const x of cur.slice().reverse()) {
            lines.push(`${ind}  ap = fwd(ap, tc_${x}, ts_${x}, tf_${x}, ta_${x}, td_${x}); aa = (tf_${x} < 0.0 ? 180.0 - aa : aa) + ta_${x} + (ts_${x} < 0.0 ? 180.0 : 0.0);`);
          }
          lines.push(`${ind}  AN_${glslName(d.name)}_${glslName(s.name)} = vec3(ap, aa); }`);
          o.push(...lines);
          break;
        }
        case 'call': {
          if (!s.attrs.name) break;
          // a named drawing inside: its anchors may place this one's
          const sub = this.defs.get(s.name);
          if (!sub) break;
          const instance = this.instanceName(s.attrs.name, s.line);
          const attrs = own(s.attrs, 'attach') && !sub.params.some((q) => q.name === 'attach') ? this.attachTo(s.attrs, ['cx', 'cy'], sc, s.line) : s.attrs;
          const id = ++this.uid;
          const args = sub.params.map((q, i) => {
            const a = attrs[q.name] ? (q.t === 'col' ? asCol(this.ex(attrs[q.name], sc, s.line)) : this.ex(attrs[q.name], sc, s.line).c) : q.def;
            const g = `n_${id}_${i}`;
            o.push(`${ind}${glslType(q.t)} ${g} = ${a};`);
            return g;
          });
          const moves = {};
          for (const k of CALL_TRANSFORM) if (s.attrs[k] && !sub.params.some((q) => q.name === k)) moves[k] = s.attrs[k];
          let tid = null;
          if (Object.keys(moves).length) {
            const names = sub.params.map((q) => q.name);
            const at = (n) => { const i = names.indexOf(n); return i >= 0 && sub.params[i].t === 'num' ? `(${args[i]})` : null; };
            tid = ++this.uid;
            // only its transform values are needed here, not the sampling point
            const t = this.transformValues(moves, sc, s.line, s.name, { cx: at('cx'), cy: at('cy') });
            o.push(`${ind}vec2 tc_${tid} = vec2(${t.cx}, ${t.cy}); float ts_${tid} = ${t.scale}; float tf_${tid} = ${t.flip}; float ta_${tid} = ${t.angle}; vec2 td_${tid} = vec2(${t.dx}, ${t.dy});`);
          }
          this.nameInstance(instance, sub, args, tid, sc, ind, s.line);
          break;
        }
        default: break;
      }
    }
    if (cam) o.push(`${ind}${this.restore(cam.save)}`);
  }

  // ---------- sim: values worked out step by step before the first frame ----------
  sim(s) {
    this.checkGlobal(s.name, s.line, 'sim');
    const scope = new Scope(this.root);
    scope.vars.set('dt', { c: null, t: 'num', cpu: (F) => F.dt });
    const states = new Map(), inits = [];
    let work = 0, initWork = 0;
    const compileList = (list, sc, top = false) => {
      const out = [];
      for (const st of list) {
        try {
          const build = (node) => this.cpuExpr(node, sc, st.line, `sim ${s.name}`);
          switch (st.k) {
            case 'state': {
              this.checkSimName(st.name, st.line, 'state');
              if (states.has(st.name)) throw this.error(st.line, `state '${st.name}' is declared twice`);
              const slot = this.slot(), init = build(st.expr);
              initWork += this.cpuWork(st.expr);
              states.set(st.name, slot);
              sc.vars.set(st.name, { c: null, t: 'num', cpu: (F) => F.v[slot] });
              inits.push((F) => { F.v[slot] = init(F); });
              break;
            }
            case 'let': {
              this.checkSimName(st.name, st.line, 'value');
              const slot = this.slot(), f = build(st.expr);
              sc.vars.set(st.name, { c: null, t: 'num', cpu: (F) => F.v[slot] });
              out.push((F) => { F.v[slot] = f(F); });
              if (top) inits.push((F) => { F.v[slot] = f(F); }); // for the starting values below it
              work += this.cpuWork(st.expr);
              break;
            }
            case 'set': {
              const slot = states.get(st.name);
              if (slot === undefined) {
                throw this.error(st.line, `'${st.name}' is not a state of sim ${s.name}; declare it above with: state ${st.name} = 0` + suggest(st.name, [...states.keys()]));
              }
              const f = build(st.expr);
              const op = {
                '=': (F) => { F.v[slot] = f(F); }, '+': (F) => { F.v[slot] += f(F); }, '-': (F) => { F.v[slot] -= f(F); },
                '*': (F) => { F.v[slot] *= f(F); }, '/': (F) => { const b = f(F); F.v[slot] = b === 0 ? 0 : F.v[slot] / b; },
              }[st.op];
              out.push(op);
              work += this.cpuWork(st.expr);
              break;
            }
            case 'if': {
              const cond = build(st.cond);
              const a = compileList(st.then, new Scope(sc)), b = st.other ? compileList(st.other, new Scope(sc)) : [];
              out.push((F) => { const list2 = cond(F) !== 0 ? a : b; for (let i = 0; i < list2.length; i++) list2[i](F); });
              work += this.cpuWork(st.cond);
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
    try { body = compileList(s.body, scope, true); } finally { this.inSim = null; }
    if (!states.size && this.errors.length === errors) throw this.error(s.line, `sim ${s.name} has no state; give it one, like: state y = 0.2`);
    if (initWork > LIMITS.simWork / 100) throw this.error(s.line, `the starting values of sim ${s.name} would take too long to work out`);
    this.steppers.push({
      init: (F) => { for (const f of inits) f(F); },
      step: (F) => { for (let i = 0; i < body.length; i++) body[i](F); },
      work: work + 1,
    });
    this.simSteps.push(s.step || SIM_STEP);
    // its states, for the shader and for sims and smooth() below
    for (const [name, slot] of states) {
      const c = this.expose({ slot, name: `${s.name}.${name}`, line: s.line });
      this.root.vars.set(`${s.name}.${name}`, { c, t: 'num', cpu: (F) => F.v[slot] });
    }
    this.root.vars.set(s.name, { t: 'sim', values: [...states.keys()], c: null });
  }

  // The values of a group, camera or define call transform as GLSL, with defaults filled in.
  transformValues(attrs, sc, line, what, pivot = {}) {
    const E = (m) => this.error(line, m);
    const t = {};
    for (const raw of Object.keys(attrs)) {
      const name = own(TRANSFORM, raw) ? raw : own(TRANSFORM_ALIASES, raw) ? TRANSFORM_ALIASES[raw] : null;
      if (!name) {
        const names = Object.keys(TRANSFORM).map((k) => (k === 'scale' && what === 'camera' ? 'zoom' : k)).concat(what === 'group' ? ['depth'] : []);
        throw E(`${what} has no '${raw}'.` + suggest(raw, names) + ` It takes: ${names.join(', ')}`);
      }
      if (t[name]) throw E(`'${name}' is given twice`);
      const r = this.ex(attrs[raw], sc, line);
      if (r.t === 'col') throw E(`'${raw}' must be a number, not a color`);
      t[name] = `(${r.c})`;
    }
    const value = (k) => t[k] || pivot[k] || (k === 'cx' ? '(ASPECT*0.5)' : fmt(TRANSFORM[k]));
    return Object.fromEntries(Object.keys(TRANSFORM).map((k) => [k, value(k)]));
  }

  // Moves the sampling point so that whatever is drawn next appears turned by angle (clockwise),
  // scaled and mirrored around (cx, cy), then moved by (dx, dy). PX scales too, so edges stay
  // one pixel wide at any zoom. The values stay in variables named by id (anchors and depth use them).
  applyTransform(t, ind, id) {
    const lines = [`${ind}vec2 tc_${id} = vec2(${t.cx}, ${t.cy}); float ts_${id} = ${t.scale}; float tf_${id} = ${t.flip}; float ta_${id} = ${t.angle}; vec2 td_${id} = vec2(${t.dx}, ${t.dy});`];
    if (t.shake !== '0.0') {
      // a shaking camera: smooth random movement and a little turn, as large as shake
      lines.push(`${ind}{ float sk = ${t.shake}; td_${id} += sk * 2.0 * vec2(vn2(vec2(T * 19.0, 3.1)) - 0.5, vn2(vec2(T * 19.0, 9.7)) - 0.5); ta_${id} += sk * 60.0 * (vn2(vec2(T * 15.0, 5.3)) - 0.5); }`);
    }
    return lines.concat(this.applyVars(id, ind));
  }

  applyVars(id, ind) {
    return [
      `${ind}ts_${id} = abs(ts_${id}) < 1e-6 ? 1e-6 : ts_${id}; tf_${id} = abs(tf_${id}) < 1e-4 ? 1e-4 : tf_${id};`,
      `${ind}PP = rot(PP - tc_${id} - td_${id}, ta_${id}) / ts_${id}; PP.x /= tf_${id}; PP += tc_${id}; PX /= abs(ts_${id}); X = PP.x; Y = PP.y;`,
    ];
  }

  save(id) { return `vec2 sp_${id} = PP; float spx_${id} = PX;`; }
  restore(id) { return `PP = sp_${id}; PX = spx_${id}; X = PP.x; Y = PP.y;`; }

  define(s) {
    const E = (m) => this.error(s.line, m);
    const params = [];
    for (const pn of Object.keys(s.params)) {
      this.checkName(pn, s.line, 'value');
      const r = this.ex(s.params[pn], this.root, s.line);
      params.push({ name: pn, t: r.t, def: r.c });
    }
    const fname = `f_${glslName(s.name)}`;
    let cost;
    this.inBody({ inDefine: s.name, inFn: null }, () => {
      const body = new Scope(this.root);
      for (const q of params) body.vars.set(q.name, { c: `a_${glslName(q.name)}`, t: q.t });
      cost = this.stmts(s.body, body, '  ');
    });
    const b = this.lastBody;
    this.addFunc(fname, `vec3 ${fname}(vec3 col${params.map((q) => `, ${glslType(q.t)} a_${glslName(q.name)}`).join('')}) {\n${b.out.join('\n')}\n  return col;\n}`, b.deps);
    this.defs.set(s.name, { name: s.name, fname, params, cost, anchors: s.anchors || [], bounded: !!s.bounded, node: s, pfn: null, pwork: 0 });
    if (!s.body.length) throw E(`define ${s.name} is empty; put shapes between it and 'end'`);
    return 0;
  }

  fill(s, sc, ind) {
    const E = (m) => this.error(s.line, m);
    for (const a of Object.keys(s.attrs)) {
      if (a !== 'alpha' && a !== 'color' && a !== 'opacity') throw E(`fill has no '${a}'.` + suggest(a, ['alpha', 'color']) + ' It takes: color, alpha');
    }
    if (!s.color) throw E('fill needs a color, like: fill #102030');
    if (!this.inDefine) this.draws++;
    const color = asCol(this.ex(s.color, sc, s.line));
    const alphaExpr = s.attrs.alpha || s.attrs.opacity;
    if (alphaExpr) {
      const a = this.ex(alphaExpr, sc, s.line);
      if (a.t === 'col') throw E("'alpha' must be a number, not a color");
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
      if (!own(allowed, raw)) throw this.error(s.line, `${what} has no '${raw}'.` + suggest(raw, Object.keys(allowed)) + ` It takes: ${Object.keys(allowed).join(', ')}`);
      v[raw] = this.ex(s.attrs[raw], sc, s.line);
      if (v[raw].t === 'col') throw this.error(s.line, `'${raw}' must be a number, not a color`);
    }
    return { v, num: (k) => (v[k] ? `(${v[k].c})` : fmt(allowed[k])) };
  }

  // A shape line's values after aliases, checked for names, repeats and types.
  shapeValues(s, sc, options, what) {
    const E = (m) => this.error(s.line, m);
    const allowed = Object.assign({}, s.def ? s.def.values : SHAPES[s.type], options);
    const aliases = Object.assign({}, ALIASES._all, s.def ? s.def.aliases : ALIASES[s.type]);
    const named = (s.def && s.def.names) || {};
    const fixedNames = (s.def && s.def.fixed) || {};
    let attrs = s.attrs;
    if (own(attrs, 'attach')) {
      // attach=mila.hand places the shape by its center (or x, y for text)
      const keys = own(allowed, 'cx') && own(allowed, 'cy') && !['curve'].includes(s.type) ? ['cx', 'cy'] : own(allowed, 'x') && own(allowed, 'y') ? ['x', 'y'] : null;
      if (!keys) throw E(`attach places a shape by its center, and ${s.type} has none; give its points instead, like x1=mila.hand.x`);
      const given = Object.keys(attrs).filter((k) => k !== 'attach').map((k) => (own(allowed, k) ? k : aliases[k] || k));
      for (const k of keys) if (given.includes(k)) throw E(`attach= sets ${keys.join(' and ')}; leave ${k} out`);
      const point = attrs.attach.t === 'var' ? sc.get(attrs.attach.name) : null;
      if (!point || point.t !== 'point') throw E('attach= takes a point of a named drawing, like attach=mila.hand (draw it with name=mila; its define has: anchor hand x=... y=...)');
      attrs = Object.assign({}, attrs);
      delete attrs.attach;
      attrs[keys[0]] = { t: 'var', name: s.attrs.attach.name + '.x' };
      attrs[keys[1]] = { t: 'var', name: s.attrs.attach.name + '.y' };
    }
    const v = {}, fixed = {};
    for (const raw of Object.keys(attrs)) {
      // a plugin value fixed when compiling, given as a name: font=cyrillic
      if (own(fixedNames, raw)) {
        const node = attrs[raw], choices = fixedNames[raw]();
        if (node.t !== 'var' || !choices.includes(node.name)) {
          throw E(`'${raw}' takes one of: ${choices.join(', ')}.` + (node.t === 'var' ? suggest(node.name, choices) : ''));
        }
        fixed[raw] = node.name;
        continue;
      }
      const name = own(allowed, raw) ? raw : aliases[raw];
      if (!name || !own(allowed, name)) {
        const meant = typeof name === 'string' ? name : raw;
        const hint = options === CLIP_OPTIONS && (meant === 'color' || meant === 'alpha') ? ' A clip shape is not drawn, so it takes no color or alpha.' : '';
        const names = Object.keys(allowed).concat(Object.keys(fixedNames));
        throw E(`${what} has no '${raw}'.` + suggest(raw, names) + hint + ` It takes: ${names.join(', ')}`);
      }
      if (v[name]) throw E(`'${name}' is given twice`);
      let node = attrs[raw];
      // a plugin value may take names for numbers, like align=center
      if (own(named, name) && node.t === 'var' && !sc.get(node.name)) {
        if (!own(named[name], node.name)) {
          const words = Object.keys(named[name]);
          throw E(`'${raw}' takes a number or one of: ${words.join(', ')}.` + suggest(node.name, words));
        }
        node = { t: 'num', v: named[name][node.name] };
      }
      v[name] = this.ex(node, sc, s.line);
      if (name !== 'color' && v[name].t === 'col') throw E(`'${raw}' must be a number, not a color`);
    }
    const num = (k) => (v[k] ? `(${v[k].c})` : fmt(allowed[k]));
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
    if (s.def) d = s.def.distance(s.str, num, (name, code) => { if (!this.helpers.has(name)) this.helpers.set(name, code); }, fixed);
    switch (type) {
      case 'circle': d = `length(${at('cx', 'cy')}) - ${num('r')}`; break;
      case 'ring': d = `abs(length(${at('cx', 'cy')}) - ${num('r')}) - ${num('width')}*0.5`; break;
      case 'ellipse': d = `sdEll(${at('cx', 'cy')}, vec2(${num('rx')},${num('ry')}), ${num('angle')})`; break;
      case 'rect': d = `sdBox(${at('cx', 'cy')}, vec2(${num('w')},${num('h')})*0.5, ${num('radius')}, ${num('angle')})`; break;
      case 'line': d = `sdSeg(PP, vec2(${num('x1')},${num('y1')}), vec2(${num('x2')},${num('y2')})) - ${num('width')}*0.5`; break;
      case 'tri': d = `sdTri(PP, vec2(${num('x1')},${num('y1')}), vec2(${num('x2')},${num('y2')}), vec2(${num('x3')},${num('y3')}))`; break;
      case 'arc': d = `sdArc(${at('cx', 'cy')}, ${num('r')}, ${num('width')}, ${num('start')}, ${num('end')})`; break;
      case 'star': d = `sdStar(${at('cx', 'cy')}, ${num('r')}, ${num('inner')}, ${num('points')}, ${num('angle')})`; break;
      case 'curve': d = `sdBez(PP, vec2(${num('x1')},${num('y1')}), vec2(${num('cx')},${num('cy')}), vec2(${num('x2')},${num('y2')})) - ${num('width')}*0.5`; break;
    }
    // How thick the shape is: anything thinner than a pixel fades in proportion,
    // so shrinking a shape to zero (a blink, a vanishing star) leaves no hairline behind.
    const thickness = v.stroke ? `abs(${num('stroke')})` : s.def ? (s.def.thickness ? s.def.thickness(s.str, num) : null) : {
      circle: `2.0*abs(${num('r')})`, ellipse: `2.0*min(abs(${num('rx')}),abs(${num('ry')}))`,
      rect: `min(abs(${num('w')}),abs(${num('h')}))`, line: `abs(${num('width')})`, ring: `abs(${num('width')})`,
      arc: `abs(${num('width')})`, star: `2.0*abs(${num('r')})*clamp(${num('inner')},0.05,1.0)`, tri: null, curve: `abs(${num('width')})`,
    }[type];
    const lines = [`${ind}{ float d = ${d};`];
    if (v.stroke) lines.push(`${ind}  d = abs(d) - ${num('stroke')}*0.5;`);
    lines.push(`${ind}  float w = max(${num('blur')}, PX);`);
    lines.push(`${ind}  float cv = (1.0 - ssf(-w*0.5, w*0.5, d))${thickness ? ` * clamp(${thickness}/PX, 0.0, 1.0)` : ''}${v.alpha ? ` * clamp(${v.alpha.c},0.0,1.0)` : ''};`);
    return lines;
  }

  shape(s, sc, ind) {
    const { v, num, fixed } = this.shapeValues(s, sc, COMMON, s.type);
    if (!this.inDefine) this.draws++;
    const color = v.color ? asCol(v.color) : 'vec3(1.0)';
    this.out.push(...this.coverage(s, v, num, ind, fixed), `${ind}  if (cv > 0.0) col = mix(col, ${color}, cv); }`);
    return s.def && s.def.cost ? s.def.cost(s.str, fixed) : 1;
  }
}

// The functions some code needs: the ones it calls, and the ones those call.
function closure(funcs, roots) {
  const byName = new Map(funcs.map((f) => [f.name, f]));
  const need = new Set(), todo = [...roots];
  while (todo.length) {
    const n = todo.pop();
    if (need.has(n) || !byName.has(n)) continue;
    need.add(n);
    todo.push(...byName.get(n).deps);
  }
  return funcs.filter((f) => need.has(f.name));
}

/**
 * Compile XYT source into a GLSL fragment shader.
 * Never throws for problems in the source: they come back in `errors`, each with a line number.
 * options.split: true to always give one shader per stretch of time between scene changes (parts),
 * false never, 'auto' (default) when the program is large.
 */
export function compile(source, options = {}) {
  const program = parse(source);
  const c = new Compiler(program);
  c.errors.push(...program.errors);

  const root = new Scope(null);
  c.root = root;
  for (const inp of program.inputs) {
    try {
      c.checkGlobal(inp.name, inp.line, 'input');
      const name = inp.name;
      root.vars.set(name, {
        c: `u_in_${glslName(name)}`, t: inp.kind,
        cpu: inp.kind === 'num' ? (F) => { const v = F.inputs[name]; return typeof v === 'number' ? v : inp.value; } : null,
      });
      if (inp.kind === 'num') root.vars.get(name).usesInput = true;
    } catch (e) { c.errors.push(e); }
  }
  for (const q of program.cues) {
    try {
      c.checkGlobal(q.name, q.line, 'cue');
      const v = q.value;
      root.vars.set(q.name, { c: fmt(v), t: 'num', cpu: () => v });
    } catch (e) { c.errors.push(e); }
  }
  for (const tr of program.tracks) {
    try {
      c.checkGlobal(tr.name, tr.line, 'track');
      const track = { values: Float64Array.from(tr.values), step: tr.step };
      const g = c.expose({ track, name: tr.name, line: tr.line });
      root.vars.set(tr.name, { c: g, t: 'num', cpu: (F) => sampleTrack(track.values, track.step, F.t) });
    } catch (e) { c.errors.push(e); }
  }
  // a CPU closure that reads an input makes the per-frame values depend on inputs
  for (const v of root.vars.values()) {
    if (v.usesInput && v.cpu) { const f = v.cpu; v.cpu = (F) => { c.usesInputs = true; return f(F); }; }
  }
  const main = new Scope(root);
  let cost = 0;
  const topDeps = new Set();
  c.deps = topDeps;
  if (!program.errors.length) cost = c.stmts(program.body, main, '  ');

  const errors = c.errors.sort((a, b) => a.line - b.line).map((e) => ({ line: e.line, message: e.message }));
  if (!errors.length && c.draws === 0) {
    errors.push({ line: 1, message: 'nothing to draw yet: add a fill or a shape' });
  }
  // Drawings with bounds count once, at the heaviest: a pixel is usually inside one or two of them.
  const worst = Math.round(cost + c.boundedExtra);
  cost += c.bounded;
  // Which lines the cost comes from, heaviest first: each line's cost per pixel while it is drawn.
  const costs = [...c.lineCost].map(([line, k]) => ({ line, cost: Math.round(k) })).filter((x) => x.cost > 0)
    .sort((a, b) => b.cost - a.cost || a.line - b.line);
  const heaviest = costs.slice(0, 3).map((x) => `line ${x.line} (${x.cost})`).join(', ');
  const warnings = c.warnings.sort((a, b) => a.line - b.line);
  if (cost > LIMITS.warnCost) {
    warnings.push({ line: 0, message: `every pixel costs about ${Math.round(cost)} shapes (noise and fbm count as several); this may be slow on phones. Heaviest: ${heaviest}` });
  }
  if (cost > LIMITS.cost) {
    errors.push({ line: 0, message: `every pixel costs about ${Math.round(cost)} shapes, over the limit of ${LIMITS.cost}; use smaller repeat counts or less noise and fbm inside repeat. Heaviest: ${heaviest}` });
  } else if (worst > LIMITS.cost) {
    // bounds make drawing faster, but a program could put every bounded drawing on the same pixel
    errors.push({ line: 0, message: `if all the drawings with bounds covered the same pixel, it would cost about ${worst} shapes, over the limit of ${LIMITS.cost}; draw fewer of them or make them simpler. Heaviest: ${heaviest}` });
  }

  // per-frame values: the simulation has to stay affordable before the first frame
  let frames = null;
  if (c.exposed.length) {
    // the smallest step a sim asks for; smooth() needs at least the default
    let step = c.simSteps.length ? Math.min(...c.simSteps) : SIM_STEP;
    if (c.hasSmooth) step = Math.min(step, SIM_STEP);
    const work = c.steppers.reduce((s, x) => s + x.work, 0) * program.duration / step;
    if (work > LIMITS.simWork) {
      errors.push({ line: 0, message: `the sims and smooth() values would take too long to work out (about ${Math.round(work / 1e6)} million operations); use a larger sim step, simpler formulas, fewer of them or a shorter duration` });
    }
    frames = new FrameValues({
      duration: program.duration, step, slots: c.slots, exposed: c.exposed, steppers: c.steppers,
      usesInputs: () => c.usesInputs,
    });
    if (errors.length === 0) {
      // run once with the starting inputs: finds out whether inputs matter, and catches slow programs early
      try { frames.run(Object.fromEntries(program.inputs.map((i) => [i.name, i.value]))); } catch (e) {
        errors.push({ line: 0, message: `the sims could not be worked out: ${e.message}` });
      }
    }
  }

  const bps = program.bpm / 60;
  const uniforms = program.inputs.map((i) => `uniform ${i.kind === 'col' ? 'vec3' : 'float'} u_in_${glslName(i.name)};`)
    .concat(c.exposed.length ? [`uniform vec4 u_fv[${Math.ceil(c.exposed.length / 4)}];`] : []).join('\n');
  const assemble = (funcs, lines) => `${PRELUDE}${uniforms}\n${c.globals.join('\n')}\n${[...c.helpers.values()].join('\n')}\n${funcs.map((f) => f.code).join('\n')}
void main(){
  ASPECT = u_res.x / u_res.y;
  X = gl_FragCoord.x / u_res.y; Y = 1.0 - gl_FragCoord.y / u_res.y;
  T = u_t; D = u_dur; P = T / D; PX = 1.0 / u_res.y; PP = vec2(X, Y);
  BEAT = (T - ${fmt(program.offset)}) * ${fmt(bps)}; PULSE = BEAT < 0.0 ? 0.0 : exp(-fract(BEAT) * 5.0);
  MX = u_mouse.x; MY = u_mouse.y;
  vec3 col = vec3(0.0);
${lines.join('\n')}
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
  const glsl = assemble(c.funcs, c.out);

  // One shader per stretch of time with the same scenes playing: each holds only what plays then,
  // so long films compile and draw like short ones.
  let parts = null;
  const split = options.split === undefined ? 'auto' : options.split;
  const scenes = c.sceneParts;
  if (errors.length === 0 && scenes.length && (split === true || (split === 'auto' && scenes.length >= 2 && glsl.length > 60000))) {
    const D = program.duration;
    const cuts = [...new Set([0, D, ...scenes.flatMap((s) => [s.start, s.end])])].filter((x) => x >= 0 && x <= D).sort((a, b) => a - b);
    parts = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (!(b > a)) continue;
      const active = scenes.filter((s) => s.start < b && s.end > a);
      const last = parts[parts.length - 1];
      if (last && last.active.length === active.length && last.active.every((s, k) => s === active[k])) { last.end = b; continue; }
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
    scenes: program.body.filter((b) => b.k === 'scene').map(({ start, end, fadein, fadeout }) => ({ start, end, fadein, fadeout })),
    cues: program.cues.map(({ name, value }) => ({ name, time: value })),
    defines: [...c.defs.keys()],
    fns: [...c.fns.keys()],
    sims: program.body.filter((b) => b.k === 'sim').map((b) => b.name),
    plugins: program.uses.map((p) => p.name),
    cost: Math.round(cost),
    worstCost: Math.max(worst, Math.round(cost)),
    costs,
  };
}
