// Builds playground/index.html from playground/template.html and examples/.
//   node scripts/playground.mjs            -> loads ../dist/xyt.min.js (serve the repo root, e.g. GitHub Pages)
//   node scripts/playground.mjs --inline   -> one self-contained file with the library inside
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const ORDER = ['pip', 'journey', 'watcher', 'bells', 'karaoke', 'ball', 'spinner', 'progress', 'sunset', 'plasma', 'clouds', 'ripples', 'stars', 'fire', 'clock'];
export function loadExamples(dir = 'examples') {
  const files = readdirSync(dir).filter((f) => f.endsWith('.xyt'));
  const list = files.map((f) => {
    const src = readFileSync(`${dir}/${f}`, 'utf8').replace(/\s+$/, '') + '\n';
    const m = /^\/\/\s*([^:]+):\s*(.*)$/m.exec(src.split('\n')[0]);
    return { id: f.replace(/\.xyt$/, ''), title: m ? m[1].trim() : f, about: m ? m[2].trim() : '', src };
  });
  const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  return list.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

export function buildPlayground({ inline = false, hooks = {} } = {}) {
  let html = readFileSync('playground/template.html', 'utf8');
  // the library, the text plugin and its Cyrillic font, which register themselves
  const bundle = ['xyt.min.js', 'xyt-text.min.js', 'xyt-text-cyrillic.min.js']
    .map((f) => (inline ? `<script>${readFileSync(`dist/${f}`, 'utf8')}</script>` : `<script src="../dist/${f}"></script>`)).join('\n');
  const examples = JSON.stringify(loadExamples()).replace(/</g, '\\u003c');
  html = html.replace('<!--HOOK:bundle-->', () => bundle).replace('/*HOOK:examples*/[]', () => examples);
  for (const key of ['css', 'sections', 'after', 'script']) {
    const value = hooks[key] || '';
    html = html.replace(key === 'css' || key === 'script' ? `/*HOOK:${key}*/` : `<!--HOOK:${key}-->`, () => value);
  }
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inline = process.argv.includes('--inline');
  writeFileSync('playground/index.html', buildPlayground({ inline }));
  console.log('playground/index.html', inline ? '(self-contained)' : '(uses ../dist/xyt.min.js and the text plugin)');
}
