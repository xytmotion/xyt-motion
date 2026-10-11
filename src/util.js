// Shared helpers for the XYT compiler.

/** An error tied to a source line. All user-facing compile errors use this type. */
export class XytError extends Error {
  constructor(line, message) {
    super(message);
    this.line = line;
    this.xyt = true;
  }
}

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

/** " Did you mean 'x'?" when a close option exists, else "". */
export function suggest(word, options) {
  let best = null, bestDist = Infinity;
  for (const o of options) {
    const dist = levenshtein(word.toLowerCase(), o.toLowerCase());
    if (dist < bestDist) { bestDist = dist; best = o; }
  }
  const limit = Math.max(1, Math.floor(word.length / 3)) + 1;
  return best && bestDist <= limit && bestDist < word.length ? ` Did you mean '${best}'?` : '';
}

/**
 * A program's name as a GLSL identifier part. GLSL reserves identifiers containing '__', which
 * prefixes like 'v_' would create from names like '_orb', 'a_' or 'a__b', so '_' is spelled 'Z1'
 * (and 'Z' as 'Z0', so different names never collide).
 */
export function glslName(name) {
  return name.replace(/Z/g, 'Z0').replace(/_/g, 'Z1');
}

/** Format a JS number as a GLSL float literal. */
export function fmt(v) {
  if (!Number.isFinite(v)) return '0.0';
  let s = String(+v.toPrecision(8));
  if (!/[.e]/.test(s)) s += '.0';
  return s;
}

/** '#abc' / 'abc' / '#aabbcc' -> [r, g, b] in 0..1, or null. */
export function parseHex(h) {
  h = String(h).replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function vec3(rgb) {
  return `vec3(${rgb.map((v) => fmt(+v.toFixed(4))).join(',')})`;
}
