// Type declarations for xyt-motion/text. Copied to dist/ by scripts/build.mjs.
import type { XytPlugin } from 'xyt-motion';

/**
 * A stroke font for text.addFont(). Give one or more of jhf, svg and glyphs. jhf and glyphs use
 * Hershey's units (y down, capitals from -12 to the baseline at 9) unless capHeight and baseline say otherwise.
 */
export interface StrokeFont {
  /** Lowercase letters and digits; programs pick the font with font=NAME. */
  name: string;
  /** A .jhf file of the Hershey distribution, or a list of its glyphs. */
  jhf?: string | string[];
  /** The character of each jhf glyph, in order (default: ASCII from space). */
  chars?: string | string[];
  /** An SVG font file; each glyph names its character. */
  svg?: string;
  /** Glyphs as strokes: polylines of [x, y] points. */
  glyphs?: Record<string, { width: number; strokes: Array<Array<[number, number]>> }>;
  capHeight?: number;
  baseline?: number;
}

export interface TextPlugin extends XytPlugin {
  /** Add a stroke font: letters it has that earlier fonts lack are drawn with it. */
  addFont(font: StrokeFont): TextPlugin;
  /** Names of the loaded fonts, in the order letters are looked up ('simplex' first). */
  fonts(): string[];
}

/** The text plugin: register it with use(text), then programs can say `use text`. */
export declare const text: TextPlugin;
export default text;
