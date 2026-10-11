// Plugins the host page has loaded. A program can only name one (`use text`), never load code,
// so programs stay safe to run from any source.
import { SHAPES, SHAPE_ALIASES, COMMANDS, BUILTINS, NAMED_COLORS } from './language.js';

const loaded = new Map();

/** Makes a plugin's commands available to programs that start with `use NAME`. */
export function use(plugin) {
  if (!plugin || typeof plugin.name !== 'string' || !/^[a-z][a-z0-9]*$/.test(plugin.name)) {
    throw new TypeError('use() needs an XYT plugin, like the default export of xyt-motion/text');
  }
  for (const name of Object.keys(plugin.shapes || {})) {
    if (COMMANDS.includes(name) || SHAPES[name] || SHAPE_ALIASES[name] || BUILTINS[name] || NAMED_COLORS[name]) {
      throw new Error(`the ${plugin.name} plugin's '${name}' is already part of the language`);
    }
  }
  loaded.set(plugin.name, plugin);
}

export const pluginNamed = (name) => loaded.get(name);
export const loadedPlugins = () => [...loaded.values()];

/** Plugins XYT knows by name, so errors can say how to load them. */
export const KNOWN_PLUGINS = {
  text: { commands: ['text'], load: "import text from 'xyt-motion/text' and call use(text), or load dist/xyt-text.min.js after the library" },
};
