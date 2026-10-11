// The vocabulary of XYT. Everything a program can name lives here.

/** Shapes and their parameters with defaults (all in canvas units). */
export const SHAPES = {
  circle: { cx: 0.5, cy: 0.5, r: 0.1 },
  ellipse: { cx: 0.5, cy: 0.5, rx: 0.15, ry: 0.1, angle: 0 },
  rect: { cx: 0.5, cy: 0.5, w: 0.3, h: 0.2, radius: 0, angle: 0 },
  line: { x1: 0.2, y1: 0.5, x2: 0.8, y2: 0.5, width: 0.01 },
  tri: { x1: 0.5, y1: 0.2, x2: 0.8, y2: 0.8, x3: 0.2, y3: 0.8 },
  ring: { cx: 0.5, cy: 0.5, r: 0.2, width: 0.02 },
  arc: { cx: 0.5, cy: 0.5, r: 0.2, width: 0.02, start: 180, end: 360 },
  star: { cx: 0.5, cy: 0.5, r: 0.1, inner: 0.45, points: 5, angle: 0 },
};

/** Options every shape accepts. color defaults to white. */
export const COMMON = { color: null, alpha: 1, blur: 0, stroke: 0 };

/** Forgiving alternative names. LLMs and people reach for these. */
export const ALIASES = {
  _all: { opacity: 'alpha', fill: 'color', colour: 'color', softness: 'blur', feather: 'blur', outline: 'stroke' },
  circle: { radius: 'r', x: 'cx', y: 'cy' },
  ring: { radius: 'r', x: 'cx', y: 'cy', thickness: 'width' },
  ellipse: { x: 'cx', y: 'cy', rotation: 'angle', rotate: 'angle' },
  rect: { x: 'cx', y: 'cy', width: 'w', height: 'h', rotation: 'angle', rotate: 'angle', corner: 'radius' },
  line: { thickness: 'width' },
  tri: {},
  arc: { radius: 'r', x: 'cx', y: 'cy', thickness: 'width', from: 'start', to: 'end' },
  star: { radius: 'r', x: 'cx', y: 'cy', rotation: 'angle', rotate: 'angle', n: 'points' },
};

export const SHAPE_ALIASES = {
  rectangle: 'rect', square: 'rect', box: 'rect', triangle: 'tri', oval: 'ellipse', segment: 'line', circ: 'circle',
};

export const NAMED_COLORS = {
  white: '#ffffff', black: '#000000', red: '#e5322d', green: '#2fa84f', blue: '#2f6fe4',
  yellow: '#ffd23f', orange: '#ff8a1f', purple: '#8a4fd8', pink: '#ff7ab6', cyan: '#2fd3e6',
  magenta: '#e03fd0', gray: '#808080', grey: '#808080', navy: '#14215e', teal: '#178f8a',
  brown: '#7a4a26', gold: '#e8b923', sky: '#8ec9ff',
};

/** Built-in values and the GLSL globals they map to. */
export const BUILTINS = {
  x: 'X', y: 'Y', t: 'T', p: 'P', dur: 'D', aspect: 'ASPECT',
  beat: 'BEAT', pulse: 'PULSE', mx: 'MX', my: 'MY',
  pi: '3.14159265', tau: '6.28318531',
};

/** Values that only exist inside a scene block. */
export const SCENE_VALUES = ['st', 'sp'];

export const COMMANDS = ['xyt', 'canvas', 'duration', 'bpm', 'input', 'let', 'fill', 'repeat', 'scene', 'define', 'end'];

/** The language version this library speaks. Programs may declare theirs with `xyt 0.2`. */
export const LANGUAGE_VERSION = '0.2';

export const ASPECT_NAMES = { square: 1, wide: 16 / 9, landscape: 16 / 9, tall: 9 / 16, portrait: 9 / 16, cinema: 2.39 };

/**
 * Hard limits that keep shaders compilable on phones. cost counts shapes per pixel; a program
 * far past the limit can stall the GPU long enough for the browser to drop the context.
 */
export const LIMITS = { repeat: 500, cost: 2000, warnCost: 400, nameLength: 64 };

/** Functions that cost about as much as several shapes, keyed by name and argument count. */
export const FUNCTION_COST = { noise: [2, 2, 4], fbm: [10, 10, 20] };
