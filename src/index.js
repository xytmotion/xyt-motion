// xyt-motion: pictures and motion as formulas of x, y and t.
import { defineElement } from './element.js';

export { compile, FUNCTIONS } from './compiler.js';
export { FrameValues } from './frames.js';
export { parse } from './parser.js';
export { Player } from './player.js';
export { defineElement } from './element.js';
export { reference } from './reference.js';
export { use } from './registry.js';
export { SHAPES, NAMED_COLORS, BUILTINS } from './language.js';
export const version = '0.4.0';

// In browsers, <xyt-player> works as soon as the library is loaded.
if (typeof window !== 'undefined') defineElement();
