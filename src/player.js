// Runs XYT programs on a <canvas> with WebGL 1.
import { compile } from './compiler.js';
import { parseHex, glslName } from './util.js';

const VERTEX = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
const hasRAF = typeof requestAnimationFrame === 'function';

function toInputValue(value, kind) {
  if (kind === 'col') {
    if (typeof value === 'string') return parseHex(value) || [1, 1, 1];
    if (Array.isArray(value) && value.length === 3) return value.map(Number);
    if (typeof value === 'number') return [value, value, value];
    return [1, 1, 1];
  }
  return Number(value) || 0;
}

export class Player {
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
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('Player needs a <canvas> element');
    this.canvas = canvas;
    this.options = Object.assign({
      autoplay: true, loop: true, clock: null, reducedMotion: 'still', still: false, poster: null, adaptive: true,
      pauseWhenHidden: true, pointer: true, maxPixelRatio: 2, maxPixels: 1920 * 1080 * 2, fitAspect: true,
      preserveDrawingBuffer: false, inputs: {}, split: 'auto',
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
    this._progs = []; // one compiled shader per part of the program (one part when it isn't split)
    this._fv = null; // the per-frame values (sims, smooth, tracks), worked out for the current inputs
    this._tick = this._tick.bind(this);

    this._initGL();
    this._observe();
    // Show a still frame instead of motion: asked for, or the viewer prefers reduced motion.
    // The frame is chosen when the first program loads, which may be later (<xyt-player src>).
    this._still = !!this.options.still || (this.options.reducedMotion === 'still' && typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches);
    for (const [k, v] of Object.entries(this.options.inputs || {})) this._inputs[k] = v;
    if (this.options.source != null) this.load(this.options.source);
    if (this.options.autoplay && !this._still) this.play();
    else this._requestDraw();
  }

  // ---------- public API ----------

  /** Compile and show a program. On errors the previous program keeps running. Returns the compile result. */
  load(source) {
    const result = compile(source, { split: this.options.split, maxCost: this.options.maxCost });
    if (!result.ok) { this._emit('error', result.errors); return result; }
    const gpuError = this._build(result);
    if (gpuError) {
      const errors = [{ line: 0, message: 'The GPU rejected the compiled shader: ' + gpuError }];
      this._emit('error', errors);
      return Object.assign({}, result, { ok: false, errors });
    }
    const previous = this._inputs;
    this._inputs = {};
    for (const inp of result.inputs) {
      this._inputs[inp.name] = previous[inp.name] !== undefined ? toInputValue(previous[inp.name], inp.kind) : inp.value;
    }
    const first = !this.result;
    this.result = result;
    this._fv = result.frames ? result.frames.run(this._inputs) : null;
    if (first && this._still && !this._playing) {
      this._time = Math.min(Math.max(0, this.options.poster ?? result.duration * 0.3), result.duration);
    } else if (this._time > result.duration) this._time %= result.duration;
    this._resetAdaptive();
    this._fpsT = 0;
    if (this.options.fitAspect) {
      if (!this.canvas.style.width) this.canvas.style.width = '100%';
      this.canvas.style.aspectRatio = String(result.aspect);
    }
    this._emit('load', result);
    this._requestDraw();
    return result;
  }

  play() {
    if (this._playing) return this;
    this._playing = true;
    this._last = 0;
    this._emit('play');
    this._requestDraw();
    return this;
  }

  pause() {
    if (!this._playing) return this;
    this._playing = false;
    this._emit('pause');
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
    // sims that read inputs are worked out again
    if (this.result && this.result.frames && this.result.frames.usesInputs) this._fv = this.result.frames.run(this._inputs);
    this._requestDraw();
    return this;
  }

  get(name) { return this._inputs[name]; }

  get time() { return this._time; }
  set time(v) { this.seek(v); }
  get duration() { return this.result ? this.result.duration : 0; }
  get playing() { return this._playing; }

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
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const ratio = Math.min(dpr, this.options.maxPixelRatio) * this._scale;
    let w = Math.max(1, Math.round(cssWidth * ratio));
    let h = Math.max(1, Math.round(w / aspect));
    const max = this.options.maxPixels;
    if (w * h > max) { const f = Math.sqrt(max / (w * h)); w = Math.round(w * f); h = Math.round(h * f); }
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  /** Listen to 'load', 'error', 'frame', 'play', 'pause', 'end'. Returns a function that stops listening. */
  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
    return () => { this._listeners[event] = (this._listeners[event] || []).filter((f) => f !== fn); };
  }

  destroy() {
    this.pause();
    if (this._raf && hasRAF) cancelAnimationFrame(this._raf);
    this._raf = 0;
    for (const off of this._cleanup) off();
    this._cleanup = [];
    // Free GPU objects but keep the context: the same canvas may get a new Player
    // (for example when <xyt-player> is moved in the page).
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
    const gl = this.canvas.getContext('webgl', attrs) || this.canvas.getContext('experimental-webgl', attrs);
    if (!gl) throw new Error('WebGL is not available in this browser, and XYT needs it to draw.');
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
      throw new Error(log || 'shader failed to compile');
    }
    return s;
  }

  // Checks a new program on the GPU by building the shader it needs now; a split program's other
  // parts are built when they are first needed. Returns an error message, or null.
  _build(result) {
    const old = this._progs;
    this._progs = (result.parts || [null]).map(() => null);
    const error = this._buildPart(this._partAt(result, this._time), result);
    if (error) { this._progs = old; return error; }
    const gl = this.gl;
    if (!gl.isContextLost()) for (const p of old) if (p) gl.deleteProgram(p.prog);
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
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p) || 'link failed');
      const u = (n) => gl.getUniformLocation(p, n);
      const loc = { a: gl.getAttribLocation(p, 'a'), res: u('u_res'), t: u('u_t'), dur: u('u_dur'), mouse: u('u_mouse'), fv: u('u_fv'), inputs: {} };
      for (const inp of result.inputs) loc.inputs[inp.name] = { loc: u('u_in_' + glslName(inp.name)), kind: inp.kind };
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
      if (error) { this._emit('error', [{ line: 0, message: 'The GPU rejected the compiled shader: ' + error }]); return; }
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
      if (kind === 'col') gl.uniform3f(loc, v[0], v[1], v[2]); else gl.uniform1f(loc, v);
    }
    if (this._fv && L.fv) gl.uniform4fv(L.fv, this._fv.at(t));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this._emit('frame', t);
  }

  _requestDraw() {
    if (!this._raf && hasRAF) this._raf = requestAnimationFrame(this._tick);
  }

  _tick(now) {
    this._raf = 0;
    if (!this.result) return;
    // After a long gap (hidden page, busy main thread) time moves on by at most 0.25 s,
    // and the gap doesn't count as slow frames.
    const gap = this._last ? now - this._last : Infinity;
    const dt = this._last ? Math.min(gap / 1000, 0.25) : 0;
    this._last = now;
    const D = this.result.duration;
    if (this._playing) {
      const clock = this.options.clock;
      let t = clock ? Number(clock()) || 0 : this._time + dt;
      if (t >= D) {
        if (this.options.loop) t %= D;
        else { t = D; this._playing = false; this._emit('end'); }
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
    if (restart || !this._fpsT) { this._fpsT = now; this._frames = 0; return; }
    this._frames++;
    if (now - this._fpsT < 1000) return;
    this.fps = Math.round(this._frames * 1000 / (now - this._fpsT));
    this._frames = 0;
    this._fpsT = now;
    if (this.options.adaptive) this._adapt(this.fps);
  }

  _resetAdaptive() {
    this._trial = null; // the level and fps before the last change, judged after one second
    this._cap = 0; // a frame rate that a lower resolution did not improve (a 30 fps screen or power mode)
    this._raiseAfter = 5; // fast seconds before trying a higher resolution again
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
    if (trial && this._level > trial.level && fps < trial.fps * 1.15) { this._cap = fps; this._setLevel(trial.level); return; }
    if (trial && this._level < trial.level && fps < 40 && fps < trial.fps * 0.85) { this._raiseAfter *= 2; this._setLevel(trial.level); return; }
    if (this._cap && fps > this._cap * 1.3) this._cap = 0; // the frame rate is no longer held down
    const slow = fps < 40 && !(this._cap && fps >= this._cap * 0.85);
    const fast = fps >= 50 || (this._cap > 0 && fps >= this._cap * 0.95);
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
    const add = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); this._cleanup.push(() => target.removeEventListener(ev, fn, opts)); };
    add(c, 'webglcontextlost', (e) => { e.preventDefault(); });
    add(c, 'webglcontextrestored', () => {
      this._initGL();
      if (this.result) this._progs = (this.result.parts || [null]).map(() => null); // built again as they are needed
      this._requestDraw();
    });
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => this._requestDraw());
      ro.observe(c);
      this._cleanup.push(() => ro.disconnect());
    }
    if (this.options.pauseWhenHidden && typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        const vis = entries[entries.length - 1].isIntersecting;
        if (vis === this._visible) return;
        this._visible = vis;
        if (vis) { this._last = 0; this._requestDraw(); }
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
      add(c, 'pointermove', move);
      add(c, 'pointerdown', move);
    }
  }
}
