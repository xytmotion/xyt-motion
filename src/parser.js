// Source text -> syntax tree. One statement per line; blocks close with `end`.
import { XytError, suggest, parseHex } from './util.js';
import { SHAPES, SHAPE_ALIASES, COMMANDS, NAMED_COLORS, BUILTINS, ASPECT_NAMES, LANGUAGE_VERSION, LIMITS } from './language.js';

// ---------- lexer ----------
function lexLine(src, line) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') break;
    if (c === '#') {
      // '#abc' / '#aabbcc' is a color unless it starts the line; anything else is a comment.
      const m = /^#([0-9a-fA-F]+)(?![0-9a-zA-Z_])/.exec(src.slice(i));
      if (m && toks.length > 0) {
        const h = m[1];
        if (h.length === 3 || h.length === 6) { toks.push({ k: 'col', v: h }); i += m[0].length; continue; }
        if (h.length === 4 || h.length === 8) {
          // #rgba / #rrggbbaa: common in CSS and in model output
          const n = h.length / 4, alpha = parseInt(h.slice(3 * n), 16) / (n === 1 ? 15 : 255);
          throw new XytError(line, `'#${h}' has a transparency part, but colors are #rgb or #rrggbb; write #${h.slice(0, 3 * n)} and alpha=${+alpha.toFixed(2)} instead`);
        }
      }
      break;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(src.slice(i));
      if (!m) throw new XytError(line, `unexpected '${c}'`);
      toks.push({ k: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (m[0].length > LIMITS.nameLength) throw new XytError(line, `the name '${m[0].slice(0, 16)}...' is too long; names can be up to ${LIMITS.nameLength} characters`);
      toks.push({ k: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['>=', '<=', '==', '!=', '&&', '||'].includes(two)) { toks.push({ k: 'op', v: two }); i += 2; continue; }
    if ('+-*/%^(),=<>:'.includes(c)) { toks.push({ k: 'op', v: c }); i++; continue; }
    throw new XytError(line, `unexpected character '${c}'`);
  }
  return toks;
}

const tokStr = (k) => (k.k === 'col' ? '#' + k.v : String(k.v));

// ---------- expressions (precedence climbing) ----------
const BINARY = { '||': 1, '&&': 2, '<': 3, '>': 3, '<=': 3, '>=': 3, '==': 3, '!=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5, '^': 7 };
const UNARY_PREC = 6; // -x^2 is -(x^2), -a*b is (-a)*b

class Cursor {
  constructor(toks, line) { this.t = toks; this.i = 0; this.line = line; }
  peek(o = 0) { return this.t[this.i + o]; }
  next() { return this.t[this.i++]; }
  atEnd() { return this.i >= this.t.length; }
  isOp(v, o = 0) { const k = this.peek(o); return !!k && k.k === 'op' && k.v === v; }
  expect(v) {
    if (!this.isOp(v)) {
      const k = this.peek();
      throw new XytError(this.line, `expected '${v}'` + (k ? ` but found '${tokStr(k)}'` : ' before the end of the line'));
    }
    this.i++;
  }
  isNamedValue() { const k = this.peek(); return !!k && k.k === 'id' && this.isOp('=', 1); }
}

function parseExpr(c, minPrec = 0) {
  let left = parseUnary(c);
  for (;;) {
    const k = c.peek();
    if (!k || k.k !== 'op' || !(k.v in BINARY)) break;
    const prec = BINARY[k.v];
    if (prec < minPrec) break;
    c.next();
    const right = parseExpr(c, k.v === '^' ? prec : prec + 1); // ^ is right-associative
    left = { t: 'bin', op: k.v, a: left, b: right };
  }
  return left;
}

function parseUnary(c) {
  if (c.isOp('-')) { c.next(); return { t: 'neg', a: parseExpr(c, UNARY_PREC) }; }
  if (c.isOp('+')) { c.next(); return parseExpr(c, UNARY_PREC); }
  return parsePrimary(c);
}

function parsePrimary(c) {
  const k = c.next();
  if (!k) throw new XytError(c.line, 'expected a value before the end of the line');
  if (k.k === 'num') return { t: 'num', v: k.v };
  if (k.k === 'col') return { t: 'hex', v: k.v };
  if (k.k === 'id') {
    if (c.isOp('(')) {
      c.next();
      const args = [];
      if (!c.isOp(')')) {
        for (;;) {
          args.push(parseExpr(c, 0));
          if (c.isOp(',')) { c.next(); continue; }
          break;
        }
      }
      c.expect(')');
      return { t: 'call', fn: k.v, args };
    }
    return { t: 'var', name: k.v };
  }
  if (k.k === 'op' && k.v === '(') {
    const e = parseExpr(c, 0);
    c.expect(')');
    return e;
  }
  throw new XytError(c.line, `expected a value but found '${tokStr(k)}'`);
}

/** name=value pairs until the end of the line. */
function parseNamed(c, what) {
  const attrs = {};
  while (!c.atEnd()) {
    if (!c.isNamedValue()) {
      throw new XytError(c.line, `${what} takes named values like ${what === 'fill' ? 'alpha=0.5' : 'color=red'}; found '${tokStr(c.peek())}'`);
    }
    const name = c.next().v;
    c.next(); // '='
    if (attrs[name]) throw new XytError(c.line, `'${name}' is given twice`);
    attrs[name] = parseExpr(c, 0);
  }
  return attrs;
}

/** A plain number, optionally negative (for header settings). */
function constNumber(c, what) {
  let sign = 1;
  if (c.isOp('-')) { c.next(); sign = -1; }
  const k = c.next();
  if (!k || k.k !== 'num') throw new XytError(c.line, `${what} needs a plain number`);
  return sign * k.v;
}

/** A constant used as an input default: number, #hex or a color name. */
function constValue(c, line, name) {
  if (c.isOp('-')) { c.next(); const k = c.next(); if (k && k.k === 'num') return { kind: 'num', value: -k.v }; }
  else {
    const k = c.next();
    if (k && k.k === 'num') return { kind: 'num', value: k.v };
    if (k && k.k === 'col') return { kind: 'col', value: parseHex(k.v) };
    if (k && k.k === 'id' && NAMED_COLORS[k.v]) return { kind: 'col', value: parseHex(NAMED_COLORS[k.v]) };
  }
  throw new XytError(line, `input ${name} needs a starting value that is a plain number or color, like: input ${name} = 0.5`);
}

// ---------- statements ----------
export function parse(src) {
  const lines = String(src).split('\n');
  const root = { k: 'root', body: [] };
  const stack = [root];
  const program = {
    version: null, aspect: 1, aspectLabel: '1:1', duration: null, bpm: 120, offset: 0,
    inputs: [], body: root.body, errors: [], defines: new Set(),
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
      if (head.k !== 'id') throw new XytError(line, 'each line starts with a command like fill, circle, rect, let or repeat');
      const c = new Cursor(toks, line);
      c.i = 1;
      const cmd = head.v;
      const body = stack[stack.length - 1].body;
      const done = (what) => { if (!c.atEnd()) throw new XytError(line, `unexpected '${tokStr(c.peek())}' after ${what}`); };

      switch (cmd) {
        case 'xyt': {
          // The language version the program was written for, so later versions can keep its meaning.
          topLevelOnly(cmd, line);
          const m = /^\s*xyt\s+(\d+)\.(\d+)\s*(\/\/.*)?$/.exec(lines[li]);
          if (!m) throw new XytError(line, `xyt needs the language version the program is written for, like: xyt ${LANGUAGE_VERSION}`);
          const [major, minor] = LANGUAGE_VERSION.split('.').map(Number);
          if (+m[1] > major || (+m[1] === major && +m[2] > minor)) {
            throw new XytError(line, `this program is written for XYT ${m[1]}.${m[2]}, newer than this library (XYT ${LANGUAGE_VERSION}); update xyt-motion`);
          }
          program.version = `${m[1]}.${m[2]}`;
          break;
        }
        case 'canvas': {
          topLevelOnly(cmd, line);
          let aspect, label;
          const k = c.peek();
          if (k && k.k === 'id' && ASPECT_NAMES[k.v]) { c.next(); aspect = ASPECT_NAMES[k.v]; label = k.v; }
          else {
            const a = constNumber(c, 'canvas');
            if (c.isOp(':')) { c.next(); const b = constNumber(c, 'canvas'); aspect = a / b; label = `${a}:${b}`; }
            else if (!c.atEnd()) { const b = constNumber(c, 'canvas'); aspect = a / b; label = `${a}x${b}`; }
            else { aspect = a; label = String(a); }
          }
          done('the canvas shape');
          if (!(aspect >= 0.2 && aspect <= 5)) throw new XytError(line, 'canvas shape must be between 1:5 and 5:1, like: canvas 16:9');
          program.aspect = aspect;
          program.aspectLabel = label;
          break;
        }
        case 'duration': {
          topLevelOnly(cmd, line);
          const v = constNumber(c, 'duration');
          if (v <= 0) throw new XytError(line, 'duration needs a positive number of seconds, like: duration 4');
          done('the duration');
          program.duration = Math.min(v, 3600);
          break;
        }
        case 'bpm': {
          topLevelOnly(cmd, line);
          const v = constNumber(c, 'bpm');
          if (v <= 0 || v > 600) throw new XytError(line, 'bpm needs a tempo between 1 and 600, like: bpm 120');
          program.bpm = v;
          const opts = parseNamed(c, 'bpm');
          for (const n of Object.keys(opts)) {
            if (n !== 'offset') throw new XytError(line, `bpm has no '${n}'. It takes: offset (seconds before the first beat)`);
            if (opts.offset.t !== 'num' && !(opts.offset.t === 'neg' && opts.offset.a.t === 'num'))
              throw new XytError(line, 'bpm offset needs a plain number of seconds');
            program.offset = opts.offset.t === 'num' ? opts.offset.v : -opts.offset.a.v;
          }
          break;
        }
        case 'input': {
          topLevelOnly(cmd, line);
          const n = c.next();
          if (!n || n.k !== 'id') throw new XytError(line, 'input needs a name and a starting value: input speed = 1');
          c.expect('=');
          const v = constValue(c, line, n.v);
          const input = { name: n.v, kind: v.kind, value: v.value, min: null, max: null, line };
          const opts = parseNamed(c, 'input');
          for (const o of Object.keys(opts)) {
            if (o !== 'min' && o !== 'max') throw new XytError(line, `input has no '${o}'. It takes: min, max`);
            const e = opts[o];
            const val = e.t === 'num' ? e.v : e.t === 'neg' && e.a.t === 'num' ? -e.a.v : null;
            if (val === null) throw new XytError(line, `input ${o} needs a plain number`);
            input[o] = val;
          }
          if (program.inputs.some((x) => x.name === n.v)) throw new XytError(line, `input '${n.v}' is declared twice`);
          program.inputs.push(input);
          break;
        }
        case 'let': {
          const n = c.next();
          if (!n || n.k !== 'id') throw new XytError(line, 'let needs a name: let speed = 2');
          c.expect('=');
          const expr = parseExpr(c, 0);
          done('the value');
          body.push({ k: 'let', name: n.v, expr, line });
          break;
        }
        case 'repeat': {
          const n = c.next(), cnt = c.next();
          if (!n || n.k !== 'id' || !cnt || cnt.k !== 'num' || cnt.v < 1 || cnt.v !== Math.floor(cnt.v))
            throw new XytError(line, 'repeat needs a name and a whole count: repeat i 12');
          done('the count');
          const blk = { k: 'repeat', name: n.v, count: cnt.v, body: [], line };
          body.push(blk);
          stack.push(blk);
          break;
        }
        case 'scene': {
          if (stack.length > 1) throw new XytError(line, `a scene can't go inside a ${stack[stack.length - 1].k}; close it with 'end' first`);
          const a = constNumber(c, 'scene'), b = constNumber(c, 'scene');
          if (!(b > a)) throw new XytError(line, 'scene needs a start and an end time in seconds, end after start: scene 6 12');
          const opts = parseNamed(c, 'scene');
          const blk = { k: 'scene', start: a, end: b, fadein: 0, fadeout: 0, body: [], line };
          for (const o of Object.keys(opts)) {
            if (!['fade', 'fadein', 'fadeout'].includes(o)) throw new XytError(line, `scene has no '${o}'.` + suggest(o, ['fade', 'fadein', 'fadeout']) + ' It takes: fade, fadein, fadeout');
            if (opts[o].t !== 'num') throw new XytError(line, `scene ${o} needs a plain number of seconds`);
          }
          if (opts.fade) blk.fadein = blk.fadeout = opts.fade.v;
          if (opts.fadein) blk.fadein = opts.fadein.v;
          if (opts.fadeout) blk.fadeout = opts.fadeout.v;
          body.push(blk);
          stack.push(blk);
          break;
        }
        case 'define': {
          topLevelOnly(cmd, line);
          const n = c.next();
          if (!n || n.k !== 'id') throw new XytError(line, 'define needs a name and its values: define bird cx=0.5 cy=0.5 s=1');
          if (COMMANDS.includes(n.v) || SHAPES[n.v] || SHAPE_ALIASES[n.v] || BUILTINS[n.v] || NAMED_COLORS[n.v] || n.v === 'background' || n.v === 'bg')
            throw new XytError(line, `'${n.v}' is a built-in name; pick another name`);
          if (program.defines.has(n.v)) throw new XytError(line, `'${n.v}' is defined twice`);
          const params = parseNamed(c, 'define');
          const blk = { k: 'define', name: n.v, params, body: [], line };
          program.defines.add(n.v);
          body.push(blk);
          stack.push(blk);
          break;
        }
        case 'end': {
          if (stack.length === 1) throw new XytError(line, "'end' without a matching repeat, scene or define");
          done("'end'");
          stack.pop();
          break;
        }
        case 'fill': case 'background': case 'bg': {
          let color = null;
          if (!c.atEnd() && !c.isNamedValue()) color = parseExpr(c, 0);
          const attrs = parseNamed(c, 'fill');
          if (color && attrs.color) throw new XytError(line, 'fill got two colors');
          body.push({ k: 'fill', color: color || attrs.color || null, attrs, line });
          break;
        }
        default: {
          if (SHAPES[cmd] || SHAPE_ALIASES[cmd]) {
            const type = SHAPES[cmd] ? cmd : SHAPE_ALIASES[cmd];
            body.push({ k: 'shape', type, attrs: parseNamed(c, type), line });
          } else if (program.defines.has(cmd)) {
            body.push({ k: 'call', name: cmd, attrs: parseNamed(c, cmd), line });
          } else {
            const definedLater = lines.slice(li + 1).some((l) => new RegExp(`^\\s*define\\s+${cmd}\\b`).test(l));
            if (definedLater) throw new XytError(line, `'${cmd}' is defined further down; move its define block above this line`);
            const known = COMMANDS.concat(Object.keys(SHAPES), [...program.defines]);
            throw new XytError(line, `unknown command '${cmd}'.` + suggest(cmd, known) +
              ` Commands: ${COMMANDS.join(', ')}; shapes: ${Object.keys(SHAPES).join(', ')}` +
              (program.defines.size ? `; defined: ${[...program.defines].join(', ')}` : ''));
          }
        }
      }
    } catch (e) {
      if (e.xyt) program.errors.push(e); else throw e;
    }
  }
  if (stack.length > 1) {
    const b = stack[stack.length - 1];
    program.errors.push(new XytError(b.line, `this ${b.k} has no matching 'end'`));
  }
  if (program.duration === null) {
    const ends = root.body.filter((b) => b.k === 'scene').map((b) => b.end);
    program.duration = ends.length ? Math.max(...ends) : 4;
  }
  return program;
}
