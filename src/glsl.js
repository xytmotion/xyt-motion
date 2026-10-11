// GLSL ES 1.00 code shared by every compiled program (WebGL 1, so it runs nearly everywhere).
// Shapes are signed distance functions, mostly after Inigo Quilez's 2D catalogue.

export const PRELUDE = `#ifdef GL_FRAGMENT_PRECISION_HIGH
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
