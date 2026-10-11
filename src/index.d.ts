// Type declarations for xyt-motion. Copied to dist/ by scripts/build.mjs.

/** A color as an input value: '#rrggbb' / '#rgb', or [r, g, b] with 0 to 1 values. */
export type Color = string | [number, number, number];

export interface CompileMessage {
  /** Source line, starting at 1; 0 for problems with the whole program. */
  line: number;
  message: string;
}

export interface InputInfo {
  name: string;
  kind: 'num' | 'col';
  /** A number, or [r, g, b] with 0 to 1 values for colors. */
  value: number | [number, number, number];
  min: number | null;
  max: number | null;
}

export interface SceneInfo {
  start: number;
  end: number;
  fadein: number;
  fadeout: number;
}

export interface CompileResult {
  /** True when there are no errors. */
  ok: boolean;
  /** Sorted by line; several lines can report at once. */
  errors: CompileMessage[];
  warnings: CompileMessage[];
  /** The fragment shader, GLSL ES 1.00. */
  glsl: string;
  duration: number;
  aspect: number;
  aspectLabel: string;
  bpm: number;
  offset: number;
  inputs: InputInfo[];
  scenes: SceneInfo[];
  /** Names of reusable drawings. */
  defines: string[];
  /** Work per pixel in the busiest moment, in shapes (noise and fbm count as several). */
  cost: number;
}

/** Compile XYT source to a GLSL fragment shader. Never throws for problems in the source. */
export function compile(source: string): CompileResult;

/** The syntax tree, for tools. Its shape may change before 1.0. */
export interface ParsedProgram {
  /** The language version from an `xyt 0.2` line, if the program has one. */
  version: string | null;
  aspect: number;
  aspectLabel: string;
  duration: number;
  bpm: number;
  offset: number;
  inputs: Array<InputInfo & { line: number }>;
  body: unknown[];
  errors: Array<Error & { line: number }>;
  defines: Set<string>;
}

export function parse(source: string): ParsedProgram;

export interface PlayerOptions {
  /** Program to load right away. */
  source?: string;
  /** Default true. */
  autoplay?: boolean;
  /** Default true. */
  loop?: boolean;
  /** External time source in seconds, such as `() => audio.currentTime`. */
  clock?: (() => number) | null;
  /** Viewers who prefer reduced motion see a still frame ('still', the default) or the animation ('play'). */
  reducedMotion?: 'still' | 'play';
  /** Always show the still frame instead of playing. Default false. */
  still?: boolean;
  /** Time of the still frame in seconds. Default: 30% of the duration. */
  poster?: number | null;
  /** Lower the resolution when frames are slow. Default true. */
  adaptive?: boolean;
  /** Stop drawing while the canvas is off screen. Default true. */
  pauseWhenHidden?: boolean;
  /** Feed the pointer into mx and my. Default true. */
  pointer?: boolean;
  /** Default 2. */
  maxPixelRatio?: number;
  /** Cap on canvas pixels. Default 2 × 1080p. */
  maxPixels?: number;
  /** Size the canvas to the program's shape. Default true. */
  fitAspect?: boolean;
  /** Default false. */
  preserveDrawingBuffer?: boolean;
  /** Starting values for inputs. */
  inputs?: Record<string, number | Color>;
}

export class Player {
  constructor(canvas: HTMLCanvasElement, options?: PlayerOptions);
  readonly canvas: HTMLCanvasElement;
  /** The running program's compile result, or null before one loads. */
  result: CompileResult | null;
  /** Measured frames per second while playing. */
  fps: number;
  /** Current time in seconds; setting it seeks. */
  time: number;
  readonly duration: number;
  readonly playing: boolean;
  /** Compile and show a program. On errors the previous program keeps running. */
  load(source: string): CompileResult;
  play(): this;
  pause(): this;
  seek(time: number): this;
  /** Change an input declared in the program (`input wind = 0.5`). */
  set(name: string, value: number | Color): this;
  get(name: string): number | [number, number, number] | undefined;
  /** Fix the drawing size in pixels (for exports), or pass nothing to size from the page again. */
  setSize(width?: number, height?: number): this;
  /** Draw one frame at a given time, right now. Pair with readPixels() for exports. */
  renderAt(time: number): this;
  /** RGBA pixels of the last frame, top row first. Call right after renderAt(). */
  readPixels(): Uint8Array;
  /** Match the canvas resolution to its size on the page. Called automatically. */
  resize(): void;
  /** Returns a function that stops listening. */
  on(event: 'load', fn: (result: CompileResult) => void): () => void;
  on(event: 'error', fn: (errors: CompileMessage[]) => void): () => void;
  on(event: 'frame', fn: (time: number) => void): () => void;
  on(event: 'play' | 'pause' | 'end', fn: () => void): () => void;
  destroy(): void;
}

/** Register the <xyt-player> element. Done automatically when the library loads in a browser. */
export function defineElement(tag?: string): void;

export interface XytPlayerElement extends HTMLElement {
  player: Player | null;
  /** The program text. Setting it loads it. */
  source: string | null;
  /** Shortcut for player.set(name, value). */
  set(name: string, value: number | Color): this;
}

declare global {
  interface HTMLElementTagNameMap {
    'xyt-player': XytPlayerElement;
  }
  interface HTMLElementEventMap {
    'xyt-load': CustomEvent<CompileResult>;
    'xyt-error': CustomEvent<CompileMessage[]>;
  }
}

/** The compact language reference for language models (also docs/llm-reference.md). */
export const reference: string;
export const FUNCTIONS: string[];
export const SHAPES: Record<string, Record<string, number>>;
export const NAMED_COLORS: Record<string, string>;
export const BUILTINS: Record<string, string>;
export const version: string;
