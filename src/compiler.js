// Syntax tree -> type-checked GLSL. Every value is either a number ('num') or a color ('col').
import { XytError, suggest, fmt, parseHex, vec3, glslName } from './util.js';
import {
  SHAPES, COMMON, ALIASES, NAMED_COLORS, BUILTINS, SCENE_VALUES, COMMANDS, LIMITS, FUNCTION_COST,
  TRANSFORM, TRANSFORM_ALIASES, CLIP_OPTIONS,
} from './language.js';
import { PRELUDE } from './glsl.js';
import { parse } from './parser.js';

const UNARY = ['sin', 'cos', 'tan', 'asin', 'acos', 'abs', 'floor', 'ceil', 'fract', 'exp', 'sign'];
export const FUNCTIONS = UNARY.concat(['sqrt', 'log', 'round', 'atan', 'atan2', 'pow', 'min', 'max', 'mod', 'clamp',
  'saturate', 'mix', 'lerp', 'smoothstep', 'step', 'dist', 'rgb', 'gray', 'hsl', 'noise', 'fbm', 'hash',
  'ease', 'easein', 'easeout', 'backout', 'bounce', 'pingpong', 'keys', 'spring', 'hits']);

const asCol = (r) => (r.t === 'col' ? r.c : `vec3(${r.c})`);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// Statements that hold other statements; they count the cost of their contents themselves.
const BLOCKS = ['repeat', 'scene', 'define', 'group', 'clip'];
// Transform values a define call takes on top of the define's own values.
const CALL_TRANSFORM = ['angle', 'scale', 'flip', 'dx', 'dy'];

class Scope {
  constructor(parent = null, context = null) { this.vars = new Map(); this.parent = parent; this.context = context || (parent && parent.context); }
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

class Compiler {
  constructor(program) {
    this.program = program;
    this.uid = 0;
    this.out = [];
    this.funcs = [];
    this.helpers = new Map(); // GLSL functions plugins add, by name, each emitted once
    this.defs = new Map();
    this.errors = [];
    this.inDefine = null;
    this.draws = 0; // drawing statements outside defines, plus define uses
    this.work = 0; // running total of expensive function calls, in shapes (see FUNCTION_COST)
    this.mult = 1; // how many times the current line runs per pixel: the product of enclosing repeat counts
    this.lineCost = new Map(); // source line -> cost per pixel while it is drawn (outside defines)
    this.warnings = [];
  }

  record(line, k) {
    if (!this.inDefine && k > 0) this.lineCost.set(line, (this.lineCost.get(line) || 0) + k * this.mult);
  }

  error(line, msg) { return new XytError(line, msg); }

  checkName(name, line, what) {
    const why = reservedReason(name, this.program.defines, this.program.uses);
    if (why) throw this.error(line, `'${name}' is ${why}; pick another name for this ${what}`);
  }

  // ---------- expressions ----------
  ex(n, sc, line) {
    const E = (m) => this.error(line, m);
    switch (n.t) {
      case 'num': return { c: fmt(n.v), t: 'num' };
      case 'hex': return { c: vec3(parseHex(n.v)), t: 'col' };
      case 'var': {
        const v = sc.get(n.name);
        if (v) return v;
        if (BUILTINS[n.name]) return { c: BUILTINS[n.name], t: 'num' };
        if (NAMED_COLORS[n.name]) return { c: vec3(parseHex(NAMED_COLORS[n.name])), t: 'col' };
        if (FUNCTIONS.includes(n.name)) throw E(`${n.name} is a function: write ${n.name}(...)`);
        if (SCENE_VALUES.includes(n.name)) {
          throw E(this.inDefine ? `'${n.name}' is not available inside define ${this.inDefine}; pass it in as a value`
            : `'${n.name}' only exists inside a scene block`);
        }
        const known = sc.names().concat(Object.keys(BUILTINS), Object.keys(NAMED_COLORS));
        const hint = this.inDefine ? ` Inside define ${this.inDefine}, only its own values, inputs and built-ins exist; pass other values in.` : ' Define it first with let.';
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
    if (!FUNCTIONS.includes(fn)) {
      if (this.program.defines.has(fn)) throw E(`${fn} is a define: draw it on its own line, like: ${fn} cx=0.5`);
      throw E(`unknown function '${fn}'.` + suggest(fn, FUNCTIONS));
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

  // ---------- statements; each returns its cost (shape evaluations per pixel) ----------
  stmts(list, sc, ind) {
    let cost = 0, sceneMax = 0;
    const block = { camera: 0 }; // a camera lasts until the end of its block
    for (const s of list) {
      try {
        const work = this.work;
        let k = this.stmt(s, sc, ind, block);
        // Blocks count their own contents; single lines add the noise and fbm they call.
        if (!BLOCKS.includes(s.k)) {
          k += this.work - work;
          this.record(s.line, k);
        }
        if (s.k === 'scene') sceneMax = Math.max(sceneMax, k); else cost += k;
      } catch (e) {
        if (!e.xyt) throw e;
        this.errors.push(e);
        if (s.k === 'let' && !sc.vars.has(s.name)) sc.vars.set(s.name, { c: '0.0', t: 'num' }); // avoid cascades
      }
      if (this.errors.length > 20) break;
    }
    if (block.camera) this.out.push(`${ind}${this.restore(block.camera)}`);
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
        o.push(`${ind}${r.t === 'col' ? 'vec3' : 'float'} ${g} = ${r.c};`);
        sc.vars.set(s.name, { c: g, t: r.t });
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
        o.push(`${ind}if (T >= ${a} && T < ${b}) { vec3 sv_${id} = col;`);
        o.push(`${ind}  float v_st_${id} = T - ${a}; float v_sp_${id} = v_st_${id} / ${fmt(s.end - s.start)}; float v_sb_${id} = v_st_${id} * ${fmt(this.program.bpm / 60)};`);
        const inner = new Scope(sc);
        inner.vars.set('st', { c: `v_st_${id}`, t: 'num' });
        inner.vars.set('sp', { c: `v_sp_${id}`, t: 'num' });
        inner.vars.set('sb', { c: `v_sb_${id}`, t: 'num' });
        const cost = this.stmts(s.body, inner, ind + '  ');
        let fade = '';
        if (s.fadein > 0) fade += ` * clamp(v_st_${id} / ${fmt(s.fadein)}, 0.0, 1.0)`;
        if (s.fadeout > 0) fade += ` * clamp((${b} - T) / ${fmt(s.fadeout)}, 0.0, 1.0)`;
        if (fade) o.push(`${ind}  col = mix(sv_${id}, col, 1.0${fade});`);
        o.push(`${ind}}`);
        return cost;
      }
      case 'define': return this.define(s, sc);
      case 'group': {
        const work = this.work;
        const t = this.transformValues(s.attrs, sc, s.line, 'group');
        const own = this.work - work;
        this.record(s.line, own);
        if (!s.body.length) throw E("this group is empty; put shapes between it and 'end'");
        const id = ++this.uid;
        o.push(`${ind}{ ${this.save(id)}`, ...this.applyTransform(t, ind + '  '));
        const cost = this.stmts(s.body, new Scope(sc), ind + '  ');
        o.push(`${ind}  ${this.restore(id)} }`);
        return own + cost;
      }
      case 'camera': {
        const t = this.transformValues(s.attrs, sc, s.line, 'camera');
        // A later camera in the same block replaces the earlier one.
        if (block.camera) o.push(`${ind}${this.restore(block.camera)}`);
        else { block.camera = ++this.uid; o.push(`${ind}${this.save(block.camera)}`); }
        o.push(...this.applyTransform(t, ind));
        return 0;
      }
      case 'clip': {
        const work = this.work;
        const { v, num, fixed } = this.shapeValues(s, sc, CLIP_OPTIONS, `clip ${s.type}`);
        const own = (s.def && s.def.cost ? s.def.cost(s.str, fixed) : 1) + this.work - work;
        this.record(s.line, own);
        if (!s.body.length) throw E(`this clip ${s.type} is empty; put shapes between it and 'end'`);
        // The contents blend over what was there before by the shape's coverage, the way scene
        // fades do, and pixels outside the shape skip the contents entirely.
        const id = ++this.uid;
        o.push(`${ind}{ vec3 cs_${id} = col; float cc_${id};`, ...this.coverage(s, v, num, ind + '  ', fixed));
        o.push(`${ind}    cc_${id} = ${v.invert ? `mix(cv, 1.0 - cv, clamp(${num('invert')}, 0.0, 1.0))` : 'cv'}; }`);
        o.push(`${ind}  if (cc_${id} > 0.0) {`);
        const cost = this.stmts(s.body, new Scope(sc), ind + '    ');
        o.push(`${ind}    col = mix(cs_${id}, col, cc_${id});`, `${ind}  } }`);
        return own + cost;
      }
      case 'call': {
        if (s.name === this.inDefine) throw E(`'${s.name}' can't be used inside its own define`);
        const d = this.defs.get(s.name);
        if (!d) throw E(`'${s.name}' can't be drawn because its define has a problem`);
        const names = d.params.map((q) => q.name);
        const moves = {};
        for (const a of Object.keys(s.attrs)) {
          if (names.includes(a)) continue;
          if (CALL_TRANSFORM.includes(a)) { moves[a] = s.attrs[a]; continue; }
          throw E(`${s.name} has no '${a}'.` + suggest(a, names.concat(CALL_TRANSFORM)) +
            ` It takes: ${names.join(', ')}, and ${CALL_TRANSFORM.join(', ')} to turn, scale, mirror or move it`);
        }
        const args = d.params.map((q) => {
          if (!s.attrs[q.name]) return q.def;
          const r = this.ex(s.attrs[q.name], sc, s.line);
          if (q.t === 'num' && r.t === 'col') throw E(`'${q.name}' must be a number, not a color`);
          return q.t === 'col' ? asCol(r) : r.c;
        });
        const call = `col = ${d.fname}(col${args.map((a) => ', ' + a).join('')});`;
        if (Object.keys(moves).length) {
          // A drawing with cx and cy turns and scales around them; others around the canvas center.
          const at = (n) => { const i = names.indexOf(n); return i >= 0 && d.params[i].t === 'num' ? `(${args[i]})` : null; };
          const t = this.transformValues(moves, sc, s.line, s.name, { cx: at('cx'), cy: at('cy') });
          const id = ++this.uid;
          o.push(`${ind}{ ${this.save(id)}`, ...this.applyTransform(t, ind + '  '), `${ind}  ${call}`, `${ind}  ${this.restore(id)} }`);
        } else o.push(`${ind}${call}`);
        this.draws++;
        if (!this.inDefine && this.mult > 1 && d.cost * this.mult >= LIMITS.warnLine) {
          this.warnings.push({ line: s.line, message: `${s.name} costs about ${d.cost} shapes and repeat draws it ${this.mult} times, so this line alone costs about ${d.cost * this.mult} per pixel` });
        }
        return d.cost;
      }
      case 'fill': return this.fill(s, sc, ind);
      case 'shape': return this.shape(s, sc, ind);
    }
    throw E('this line could not be understood');
  }

  // The values of a group, camera or define call transform as GLSL, with defaults filled in.
  transformValues(attrs, sc, line, what, pivot = {}) {
    const E = (m) => this.error(line, m);
    const t = {};
    for (const raw of Object.keys(attrs)) {
      const name = own(TRANSFORM, raw) ? raw : own(TRANSFORM_ALIASES, raw) ? TRANSFORM_ALIASES[raw] : null;
      if (!name) {
        const names = Object.keys(TRANSFORM).map((k) => (k === 'scale' && what === 'camera' ? 'zoom' : k));
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
  // one pixel wide at any zoom.
  applyTransform(t, ind) {
    return [
      `${ind}{ vec2 c = vec2(${t.cx}, ${t.cy}); float s = ${t.scale}; float f = ${t.flip};`,
      `${ind}  s = abs(s) < 1e-6 ? 1e-6 : s; f = abs(f) < 1e-4 ? 1e-4 : f;`,
      `${ind}  PP = rot(PP - c - vec2(${t.dx}, ${t.dy}), ${t.angle}) / s; PP.x /= f; PP += c;`,
      `${ind}  PX /= abs(s); X = PP.x; Y = PP.y; }`,
    ];
  }

  save(id) { return `vec2 sp_${id} = PP; float spx_${id} = PX;`; }
  restore(id) { return `PP = sp_${id}; PX = spx_${id}; X = PP.x; Y = PP.y;`; }

  define(s, sc) {
    const E = (m) => this.error(s.line, m);
    const params = [];
    for (const pn of Object.keys(s.params)) {
      this.checkName(pn, s.line, 'value');
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
    try { cost = this.stmts(s.body, body, '  '); } finally { this.inDefine = null; }
    const code = this.out;
    this.out = saved;
    this.funcs.push(`vec3 ${fname}(vec3 col${params.map((q) => `, ${q.t === 'col' ? 'vec3' : 'float'} a_${glslName(q.name)}`).join('')}) {\n${code.join('\n')}\n  return col;\n}`);
    this.defs.set(s.name, { fname, params, cost });
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

  // A shape line's values after aliases, checked for names, repeats and types.
  shapeValues(s, sc, options, what) {
    const E = (m) => this.error(s.line, m);
    const allowed = Object.assign({}, s.def ? s.def.values : SHAPES[s.type], options);
    const aliases = Object.assign({}, ALIASES._all, s.def ? s.def.aliases : ALIASES[s.type]);
    const named = (s.def && s.def.names) || {};
    const fixedNames = (s.def && s.def.fixed) || {};
    const v = {}, fixed = {};
    for (const raw of Object.keys(s.attrs)) {
      // a plugin value fixed when compiling, given as a name: font=cyrillic
      if (own(fixedNames, raw)) {
        const node = s.attrs[raw], choices = fixedNames[raw]();
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
      let node = s.attrs[raw];
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

/**
 * Compile XYT source into a GLSL fragment shader.
 * Never throws for problems in the source: they come back in `errors`, each with a line number.
 */
export function compile(source) {
  const program = parse(source);
  const c = new Compiler(program);
  c.errors.push(...program.errors);

  const root = new Scope(null);
  root.root = root;
  for (const inp of program.inputs) {
    try {
      c.checkName(inp.name, inp.line, 'input');
      root.vars.set(inp.name, { c: `u_in_${glslName(inp.name)}`, t: inp.kind });
    } catch (e) { c.errors.push(e); }
  }
  const main = new Scope(root);
  main.root = root;
  let cost = 0;
  if (!program.errors.length) cost = c.stmts(program.body, main, '  ');

  const errors = c.errors.sort((a, b) => a.line - b.line).map((e) => ({ line: e.line, message: e.message }));
  if (!errors.length && c.draws === 0) {
    errors.push({ line: 1, message: 'nothing to draw yet: add a fill or a shape' });
  }
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
  }

  const bps = program.bpm / 60;
  const uniforms = program.inputs.map((i) => `uniform ${i.kind === 'col' ? 'vec3' : 'float'} u_in_${glslName(i.name)};`).join('\n');
  const glsl = `${PRELUDE}${uniforms}\n${[...c.helpers.values()].join('\n')}\n${c.funcs.join('\n')}
void main(){
  ASPECT = u_res.x / u_res.y;
  X = gl_FragCoord.x / u_res.y; Y = 1.0 - gl_FragCoord.y / u_res.y;
  T = u_t; D = u_dur; P = T / D; PX = 1.0 / u_res.y; PP = vec2(X, Y);
  BEAT = (T - ${fmt(program.offset)}) * ${fmt(bps)}; PULSE = BEAT < 0.0 ? 0.0 : exp(-fract(BEAT) * 5.0);
  MX = u_mouse.x; MY = u_mouse.y;
  vec3 col = vec3(0.0);
${c.out.join('\n')}
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
    beatsPerBar: program.bar,
    inputs: program.inputs.map(({ name, kind, value, min, max }) => ({ name, kind, value, min, max })),
    scenes: program.body.filter((b) => b.k === 'scene').map(({ start, end, fadein, fadeout }) => ({ start, end, fadein, fadeout })),
    defines: [...c.defs.keys()],
    plugins: program.uses.map((p) => p.name),
    cost: Math.round(cost),
    costs,
  };
}
