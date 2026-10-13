// Values that are the same for every pixel of a frame and need memory or data: sim states, smooth()
// and tracks. They are worked out on the CPU, step by step over the whole duration, before the first
// frame; each frame then reads them at its time and hands them to the shader as uniforms. The program
// stays a pure function of time: the same time always gives the same values.
import { sampleTrack } from './cpu.js';

/** About how often the values are kept, in seconds. Frames in between are interpolated. */
export const RECORD = 1 / 120;

export class FrameValues {
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
  get usesInputs() { return this.spec.usesInputs(); }

  /** Simulates the whole duration with these input values. Returns a sampler with at(t). */
  run(inputs = {}) {
    const key = this.last && this.usesInputs ? JSON.stringify(inputs) : '';
    if (this.last && this.last.key === key) return this.last.sampler;
    const sampler = this.simulate(inputs);
    this.last = { key: this.usesInputs ? JSON.stringify(inputs) : '', sampler };
    return sampler;
  }

  simulate(inputs) {
    const { duration, steppers, exposed } = this.spec;
    // steps of exactly the sims' step, kept every few steps (about RECORD apart, or every step when steps are longer)
    const dt = this.spec.step;
    const per = Math.max(1, Math.round(RECORD / dt));
    const every = dt * per;
    const records = Math.floor(duration / every) + 2;
    const slots = exposed.map((e) => (e.track ? -1 : e.slot));
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
      F.t = r * every; // no drift from adding dt thousands of times
      keep(r);
    }
    // padded to whole vec4s, the way the shader declares them
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
      },
    };
  }
}
