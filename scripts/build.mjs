// Builds dist/ bundles and docs/llm-reference.md from src/.
import { build } from 'esbuild';
import { writeFileSync, readFileSync, copyFileSync } from 'node:fs';

const banner = '/*! xyt-motion ' + JSON.parse(readFileSync('package.json', 'utf8')).version + ' | MIT */';
const common = { entryPoints: ['src/index.js'], bundle: true, target: 'es2019', banner: { js: banner }, logLevel: 'warning' };

await build({ ...common, format: 'esm', outfile: 'dist/xyt.mjs' });
await build({ ...common, format: 'cjs', outfile: 'dist/xyt.cjs' });
await build({ ...common, format: 'iife', globalName: 'XYT', outfile: 'dist/xyt.js' });
await build({ ...common, format: 'iife', globalName: 'XYT', minify: true, outfile: 'dist/xyt.min.js' });
// One hand-written declaration file, as ESM types for import and CommonJS types for require.
copyFileSync('src/index.d.ts', 'dist/xyt.d.mts');
copyFileSync('src/index.d.ts', 'dist/xyt.d.cts');

// Plugins: their own files, so the library stays small. The script tag build registers itself.
const plugin = { ...common, entryPoints: ['src/plugins/text.js'], banner: { js: banner.replace('xyt-motion', 'xyt-motion text plugin') } };
await build({ ...plugin, format: 'esm', outfile: 'dist/text.mjs' });
await build({ ...plugin, format: 'cjs', outfile: 'dist/text.cjs' });
await build({ ...plugin, format: 'iife', globalName: 'XYTText', minify: true, outfile: 'dist/xyt-text.min.js',
  footer: { js: 'if (typeof XYT !== "undefined" && XYT.use) XYT.use(XYTText.text);' } });
copyFileSync('src/plugins/text.d.ts', 'dist/text.d.mts');
copyFileSync('src/plugins/text.d.ts', 'dist/text.d.cts');

// Fonts for the text plugin. The script tag build adds itself to the text plugin.
const cyrillic = { ...common, entryPoints: ['src/plugins/fonts/cyrillic.js'], banner: { js: banner.replace('xyt-motion', 'xyt-motion Cyrillic font') } };
await build({ ...cyrillic, format: 'esm', outfile: 'dist/text-cyrillic.mjs' });
await build({ ...cyrillic, format: 'cjs', outfile: 'dist/text-cyrillic.cjs' });
await build({ ...cyrillic, format: 'iife', globalName: 'XYTTextCyrillic', minify: true, outfile: 'dist/xyt-text-cyrillic.min.js',
  footer: { js: 'if (typeof XYTText !== "undefined") XYTText.text.addFont(XYTTextCyrillic.cyrillic);' } });
copyFileSync('src/plugins/fonts/cyrillic.d.ts', 'dist/text-cyrillic.d.mts');
copyFileSync('src/plugins/fonts/cyrillic.d.ts', 'dist/text-cyrillic.d.cts');

const { reference } = await import('../src/reference.js');
writeFileSync('docs/llm-reference.md', '# XYT reference for language models\n\n' +
  'Give this text to a model together with a request, and ask it to reply with only the XYT program.\n' +
  'It is also exported by the library as `reference`.\n\n```text\n' + reference + '\n```\n');
for (const f of ['dist/xyt.mjs', 'dist/xyt.cjs', 'dist/xyt.js', 'dist/xyt.min.js', 'dist/xyt-text.min.js', 'dist/xyt-text-cyrillic.min.js']) {
  console.log(f.padEnd(18), (readFileSync(f).length / 1024).toFixed(1) + ' KB');
}
