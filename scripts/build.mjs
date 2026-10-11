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

const { reference } = await import('../src/reference.js');
writeFileSync('docs/llm-reference.md', '# XYT reference for language models\n\n' +
  'Give this text to a model together with a request, and ask it to reply with only the XYT program.\n' +
  'It is also exported by the library as `reference`.\n\n```text\n' + reference + '\n```\n');
for (const f of ['dist/xyt.mjs', 'dist/xyt.cjs', 'dist/xyt.js', 'dist/xyt.min.js']) {
  console.log(f.padEnd(18), (readFileSync(f).length / 1024).toFixed(1) + ' KB');
}
