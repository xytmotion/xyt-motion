// `xyt cues`: measures a song so a program can follow it. Tempo and the first beat (for bpm and
// offset), the strongest hits and where the music changes (as cue lines), and how loud it is over
// time (as a track). Plain signal processing, no dependencies; ffmpeg decodes the file.

// In-place radix-2 FFT of re/im (length a power of two).
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
function movingAverage(a, half) {
  const out = new Float64Array(a.length);
  let s = 0, lo = 0, hi = -1;
  for (let i = 0; i < a.length; i++) {
    while (hi < Math.min(a.length - 1, i + half)) s += a[++hi];
    while (lo < i - half) s -= a[lo++];
    out[i] = s / (hi - lo + 1);
  }
  return out;
}
function percentile(a, p) {
  const s = Float64Array.from(a).sort();
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0;
}
// linear interpolation into a, at a fractional index
const at = (a, x) => { const i = Math.floor(x); if (i < 0 || i + 1 >= a.length) return 0; return a[i] + (a[i + 1] - a[i]) * (x - i); };

/**
 * samples: mono Float32Array at rate sr. Returns { bpm, offset, confidence, duration, hits: [{time, strength}],
 * parts: [time], loudness: { step, values } }.
 */
export function analyse(samples, sr, { hits = 16, step = 0.05 } = {}) {
  const N = 1024, H = 256, frameRate = sr / H;
  const frames = Math.max(0, Math.floor((samples.length - N) / H) + 1);
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float64Array(N / 2), cur = new Float64Array(N / 2);
  // onset strength: how much the spectrum grows from one frame to the next (spectral flux)
  const flux = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = samples[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let s = 0;
    for (let k = 1; k < N / 2; k++) {
      cur[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      const d = cur[k] - prev[k];
      if (d > 0) s += d;
    }
    flux[f] = f ? s : 0;
    [prev, cur] = [cur, prev];
  }
  // minus its local average, so steady loud passages don't look like onsets
  const local = movingAverage(flux, Math.round(frameRate * 0.25));
  const onset = flux.map((v, i) => Math.max(0, v - local[i]));

  // tempo and first beat: the comb of evenly spaced beats that lands on the most onset. Every tempo
  // from 60 to 200 is tried, preferring those near 120 like listeners do, then the best is refined.
  const comb = (p, phaseStep) => {
    let best = -Infinity, bestPhase = 0;
    for (let ph = 0; ph < p; ph += phaseStep) {
      let s = 0, n = 0;
      for (let x = ph; x < onset.length; x += p) { s += at(onset, x); n++; }
      if (n && s / n > best) { best = s / n; bestPhase = ph; }
    }
    return { score: best, phase: bestPhase };
  };
  const scores = [];
  let coarse = { weighted: -Infinity, bpm: 120 };
  for (let b = 60; b <= 200; b += 0.5) {
    const { score } = comb(60 * frameRate / b, 1);
    scores.push(score);
    const weighted = score * Math.exp(-0.5 * (Math.log2(b / 120) / 0.9) ** 2);
    if (weighted > coarse.weighted) coarse = { weighted, bpm: b };
  }
  let period = 60 * frameRate / coarse.bpm, phase = 0, bestScore = -Infinity;
  for (let p = period * 0.99; p <= period * 1.01; p += 0.01) {
    const { score, phase: ph } = comb(p, 0.5);
    if (score > bestScore) { bestScore = score; period = p; phase = ph; }
  }
  // how much the best comb stands out: near 1 means the music has no steady beat
  const confidence = bestScore / (mean(scores) || 1);
  const bpm = 60 * frameRate / period;
  const offset = phase / frameRate + N / 2 / sr; // frames are measured at their middle

  // hits: the strongest onset peaks, at least 0.35 s apart
  const smoothOnset = movingAverage(onset, 1);
  const baseline = movingAverage(smoothOnset, Math.round(frameRate));
  const peaks = [];
  const reach = Math.round(frameRate * 0.1);
  for (let i = 1; i < smoothOnset.length - 1; i++) {
    let isMax = true;
    for (let j = Math.max(0, i - reach); j <= Math.min(smoothOnset.length - 1, i + reach) && isMax; j++) if (smoothOnset[j] > smoothOnset[i]) isMax = false;
    if (isMax && smoothOnset[i] > baseline[i] * 1.5) peaks.push({ i, s: smoothOnset[i] - baseline[i] });
  }
  peaks.sort((a, b) => b.s - a.s);
  const chosen = [];
  for (const p of peaks) {
    if (chosen.length >= hits) break;
    if (chosen.every((q) => Math.abs(q.i - p.i) > frameRate * 0.35)) chosen.push(p);
  }
  const top = chosen.length ? chosen[0].s : 1;
  const hitList = chosen.sort((a, b) => a.i - b.i).map((p) => ({ time: (p.i * H + N / 2) / sr, strength: p.s / top }));

  // loudness over time, 0 to 1
  const hop = Math.max(1, Math.round(step * sr));
  const rms = [];
  for (let o = 0; o < samples.length; o += hop) {
    let s = 0;
    const end = Math.min(samples.length, o + hop);
    for (let i = o; i < end; i++) s += samples[i] * samples[i];
    rms.push(Math.sqrt(s / Math.max(1, end - o)));
  }
  const top98 = percentile(rms, 0.98) || 1;
  const loud = movingAverage(rms.map((v) => Math.min(1, v / top98)), 1);

  // parts: where the loudness of several seconds changes the most, at least 8 s apart
  const span = Math.max(1, Math.round(4 / step));
  const avg = movingAverage(loud, Math.round(1 / step));
  const novelty = loud.map((_, i) => {
    if (i < span || i + span >= loud.length) return 0;
    let a = 0, b = 0;
    for (let k = 1; k <= span; k++) { a += avg[i - k]; b += avg[i + k]; }
    return Math.abs(b - a) / span;
  });
  const level = mean(loud) || 1;
  const parts = [];
  const order = Array.from(novelty, (v, i) => [v, i]).filter(([v]) => v > level * 0.25).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (parts.every((j) => Math.abs(j - i) * step > 8)) parts.push(i);
  }
  return {
    bpm, offset, confidence, duration: samples.length / sr,
    hits: hitList,
    parts: parts.sort((a, b) => a - b).map((i) => i * step),
    loudness: { step, values: loud },
  };
}

const r = (v, d) => +v.toFixed(d);

/** The analysis as XYT lines to paste at the top of a program. */
export function cueLines(a, { file = 'the song', name = '' } = {}) {
  const prefix = name ? `${name}_` : '';
  const track = name || 'loudness';
  const lines = [
    `// ${file}, measured by xyt cues: tempo and first beat, where the music changes, the strongest hits, and its loudness`,
    `// (4 beats per bar is assumed; set bar= if the song counts differently)`,
  ];
  if (a.confidence < 1.6) lines.push(`// the tempo is uncertain: this music doesn't keep a steady beat, so follow the cues rather than beat and pulse`);
  if (!name) lines.push(`bpm ${r(a.bpm, 2)} offset=${r(a.offset, 3)}`, `duration ${r(a.duration, 2)}`);
  a.parts.forEach((t, i) => lines.push(`cue ${prefix}part${i + 2} ${r(t, 2)}`));
  a.hits.forEach((h, i) => lines.push(`cue ${prefix}hit${i + 1} ${r(h.time, 3)}`.padEnd(24) + `// strength ${r(h.strength, 2)}`));
  lines.push(`track ${track} step=${a.loudness.step} ${Array.from(a.loudness.values, (v) => r(v, 2)).join(' ')}`);
  return lines.join('\n') + '\n';
}
