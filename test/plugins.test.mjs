// Tests for plugins and the text plugin. Run: npm test (no GPU needed). In its own file, so the
// first test sees a fresh registry with nothing loaded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, use } from '../src/index.js';
import text from '../src/plugins/text.js';
import cyrillic from '../src/plugins/fonts/cyrillic.js';

const firstError = (src) => (compile(src).errors[0] || {}).message || '';

test('before the page loads a plugin, programs are told how to load it', () => {
  assert.match(firstError('use text\nfill red'), /uses the 'text' plugin, which isn't loaded here: import text from 'xyt-motion\/text'/);
  assert.match(firstError('text "hi"'), /text comes from the 'text' plugin: add 'use text' at the top of the program, and load the plugin/);
  assert.match(firstError('use banana\nfill red'), /there is no 'banana' plugin\. Plugins: text/);
  assert.equal(compile('define text cx=0.5\n circle cx=cx\nend\ntext').ok, true, "without 'use text', text is a free name");
});

test('use() checks what it is given', () => {
  assert.throws(() => use({}), /use\(\) needs an XYT plugin/);
  assert.throws(() => use({ name: 'shapes', reference: '', shapes: { circle: {} } }), /'circle' is already part of the language/);
  use(text);
});

test('text: one line of text, drawn like any shape', () => {
  const r = compile('use text\ncanvas 16:9\ntext "Frère Jacques" x=aspect / 2 y=0.4 size=0.1 color=gold align=left reveal=0.5 spacing=0.1 weight=0.1 blur=0.01 alpha=0.8');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.plugins, ['text']);
  assert.match(r.glsl, /float xt_[0-9a-f]+\(vec2 p, float size/);
  assert.equal(compile('use text\ntext "Hi" cx=0.5 cy=0.5 height=0.2 thickness=0.2 progress=1 letterspacing=0.1').ok, true, 'aliases');
  assert.equal(compile('use text\ngroup angle=20\n text "Tilted" stroke=0.005\nend').ok, true, 'inside a group, outlined');
});

test('text: each letter is one GLSL function, each text another', () => {
  const r = compile('use text\ntext "banana"\ntext "nab" y=0.7\ntext "banana" y=0.9');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  for (const c of 'abn') assert.equal(r.glsl.split(`float xg_0_${c.charCodeAt(0)}(`).length - 1, 1, `one function for '${c}'`);
  assert.equal((r.glsl.match(/float xt_[0-9a-f]+\(/g) || []).length, 2, 'the same text shares its function');
  assert.equal(r.cost, 9, '3 + 3 + 3');
});

test('text: accents, ligatures and pasted typography', () => {
  assert.equal(compile('use text\ntext "é è ê ë à ç ù û ü ô î ï ÿ ñ å œ æ « » É À Ç Œ"').ok, true);
  assert.equal(compile('use text\ntext "l’été “ici” – fin… dormez\u202f?"').ok, true, 'curly quotes, dashes, ellipsis and narrow spaces');
  assert.equal(compile('use text\ntext "Cafe\u0301"').ok, true, 'a combining accent');
});

test('text: errors', () => {
  assert.match(firstError('use text\ntext x=0.5'), /text needs its words in quotes first, like: text "Hello" x=0\.5/);
  assert.match(firstError('use text\ntext "日本"'), /text can't draw '日', '本' with the fonts loaded here \(simplex\)\. .*xyt-motion\/text\/cyrillic/);
  assert.match(firstError('use text\ntext ""'), /needs something to write/);
  assert.match(firstError('use text\ntext "hi" align=centre'), /'align' takes a number or one of: left, center, middle, right\. Did you mean 'center'\?/);
  assert.match(firstError('use text\ntext "hi" colour=red size=red'), /'size' must be a number/);
  assert.match(firstError('use text\nlet text = 1\nfill red'), /'text' is a command/);
  assert.match(firstError('use text\ndefine text cx=0\n circle\nend'), /'text' is a built-in name/);
  assert.match(firstError('fill "red"'), /words in quotes only go right after a command that writes them/);
  assert.match(firstError('use text\ntext "unclosed'), /these words have no closing "/);
});

test('text: clip to letters', () => {
  const r = compile('use text\nfill navy\nclip text "XYT" size=0.4\n  fill hsl(x * 360, 0.8, 0.6)\nend');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.cost, 1 + 3 + 1);
});

test('the words never reach the shader source', () => {
  const r = compile('use text\ntext "a); } void main(){ gl_FragColor = vec4(1.0); //"');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.glsl.includes('gl_FragColor = vec4(1.0)'), false);
});

test('the plugin brings its own model reference', () => {
  assert.match(text.reference, /use text/);
  assert.match(text.reference, /reveal=/);
});

test('fonts: the built-in one, and fonts the page adds', () => {
  assert.deepEqual(text.fonts(), ['simplex']);
  assert.match(firstError('use text\ntext "Привет"'), /can't draw 'П', 'р', 'и', 'в', 'е', 'т' with the fonts loaded here \(simplex\)/);
  assert.throws(() => text.addFont({ name: 'Bad Name', glyphs: {} }), /lowercase letters and digits/);
  assert.throws(() => text.addFont({ name: 'empty' }), /has no glyphs/);
  text.addFont(cyrillic);
  assert.deepEqual(text.fonts(), ['simplex', 'cyrillic']);
  const r = compile('use text\ntext "Привет, мир! Ёлка, Йод, эхо и Јелена"');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.match(r.glsl, /float xg_0_44\(/, 'the comma from simplex');
  assert.match(r.glsl, /float xg_1_1055\(/, 'П from cyrillic');
  assert.match(r.glsl, /float xg_1_1049\(/, 'Й composed from И and a breve, in cyrillic');
  assert.match(r.glsl, /float xg_0_1032\(/, 'Ј drawn as the Latin J');
  assert.match(text.reference, /Fonts: simplex, cyrillic\. Each letter comes from the first that has it; font=NAME picks one first\./);
});

test('fonts: font=NAME picks one first, the others fill in', () => {
  text.addFont({ name: 'boxy', glyphs: { A: { width: 10, strokes: [[[0, 9], [5, -12], [10, 9]]] } } });
  const r = compile('use text\ntext "AB" font=boxy');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.match(r.glsl, /float xg_2_65\(/, 'A from boxy');
  assert.match(r.glsl, /float xg_0_66\(/, 'B from simplex');
  assert.notEqual(compile('use text\ntext "A"').glsl.includes('xg_2_65'), true, 'without font=, simplex comes first');
  assert.match(firstError('use text\ntext "A" font=boxi'), /'font' takes one of: simplex, cyrillic, boxy\. Did you mean 'boxy'\?/);
  assert.match(firstError('use text\ntext "A" font=2'), /'font' takes one of/);
  assert.match(firstError('use text\ntext "A" fnot=boxy'), /text has no 'fnot'\..*It takes: .*font/);
});

test('fonts: SVG fonts and .jhf files', () => {
  const svg = `<svg><font horiz-adv-x="600"><font-face units-per-em="1000" cap-height="700"/>
    <glyph unicode="&#x3A9;" d="M 100 0 L 300 700 L 500 0 M 150 350 Q 300 450 450 350"/>
    <glyph unicode="ж" horiz-adv-x="500" d="m 0 0 l 250 500 l 250 -500 z"/></font></svg>`;
  text.addFont({ name: 'plotter', svg });
  const r = compile('use text\ntext "Ω" font=plotter');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.match(r.glsl, /vec2\(9\.0, -12\.0\)/, 'the apex at cap height, y up turned to y down');
  assert.throws(() => text.addFont({ name: 'arcs', svg: '<font><glyph unicode="o" d="M 0 0 A 5 5 0 1 1 10 0"/></font>' }), /uses 'A'/);
  // two glyphs of a .jhf file, given characters
  text.addFont({ name: 'jhf', jhf: '  501  9I[RFJ[ RRFZ[ RMTWT\n  502  6JZNFNM RVFVM', chars: '▲"' });
  assert.equal(compile('use text\ntext "▲" font=jhf').ok, true);
});
