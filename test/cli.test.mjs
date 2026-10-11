// Tests for `xyt check` and the command line's argument handling. Run: npm test (no browser needed;
// uses dist/, so run `npm run build` after changing src/). Rendering is tested in test/gpu.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const xyt = (...args) => spawnSync(process.execPath, ['bin/xyt.mjs', ...args], { encoding: 'utf8' });
const dir = mkdtempSync(path.join(tmpdir(), 'xyt-cli-'));
const program = (name, text) => { const f = path.join(dir, name); writeFileSync(f, text); return f; };

test('check: a good program', () => {
  const r = xyt('check', 'examples/pip.xyt');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /examples\/pip\.xyt: ok\. 1:1 canvas, 30 s, cost 107, 4 scenes\. Heaviest: line \d+ \(\d+\)/);
});

test('check: errors as file:line, exit code 1', () => {
  const f = program('bad.xyt', 'circle colr=red\nfill mix(red)\n');
  const r = xyt('check', f);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /bad\.xyt:1: error: circle has no 'colr'\. Did you mean 'color'\?/);
  assert.match(r.stderr, /bad\.xyt:2: error: mix\(\) takes 3 values, got 1/);
});

test('check: warnings go to stderr, still exit 0', () => {
  const f = program('heavy.xyt', ['define zed cx=0.5', ...Array(10).fill('  circle cx=cx'), 'end', 'repeat i 12', '  zed cx=i / 12', 'end'].join('\n'));
  const r = xyt('check', f);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /heavy\.xyt:14: warning: zed costs about 10 shapes and repeat draws it 12 times/);
  assert.match(r.stdout, /Heaviest: line 14 \(120\)/);
});

test('check: programs using the text plugin', () => {
  const r = xyt('check', 'examples/karaoke.xyt');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /karaoke\.xyt: ok\. 16:9 canvas, 20 s/);
});

test('check: Cyrillic, and fonts from files with --font', () => {
  assert.equal(xyt('check', program('ru.xyt', 'use text\ntext "Привет, Јелена"')).status, 0);
  const svg = program('plotter.svg', '<svg><font horiz-adv-x="500"><glyph unicode="Ω" d="M 0 0 L 250 700 L 500 0"/></font></svg>');
  const f = program('omega.xyt', 'use text\ntext "Ω" font=plotter');
  assert.match(xyt('check', f).stderr, /'font' takes one of: simplex, cyrillic/);
  const r = xyt('check', f, '--font', svg);
  assert.equal(r.status, 0, r.stderr);
  assert.match(xyt('check', f, '--font', 'README.md').stderr, /--font takes \.svg, \.jhf or \.json files/);
});

test('usage errors explain what to write', () => {
  assert.match(xyt('render', 'examples/ball.xyt').stderr, /exactly one of --at <seconds>, --sheet or --mp4/);
  assert.match(xyt('render', 'examples/watcher.xyt', '--at', '1', '--set', 'nope=1').stderr, /no input 'nope'; it has: mood, skin/);
  assert.match(xyt('render', 'examples/ball.xyt', '--at', 'soon').stderr, /--at needs a number/);
  assert.match(xyt('frobnicate').stderr, /unknown command 'frobnicate'/);
  assert.match(xyt('check').stderr, /check needs a program file/);
  assert.match(xyt('check', path.join(dir, 'missing.xyt')).stderr, /could not read/);
  assert.equal(xyt('--help').status, 0);
});
