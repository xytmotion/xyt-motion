// Unit tests for the player's adaptive resolution. Run: npm test  (no GPU or DOM needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/player.js';

// Feeds one fps measurement per second and returns the resolution level after each (0 = full).
// fpsAt(level, second) gives the frame rate the device reaches at that level.
function simulate(fpsAt, seconds) {
  const p = Object.create(Player.prototype);
  p.options = { adaptive: true };
  p._resetAdaptive();
  const levels = [];
  for (let s = 0; s < seconds; s++) {
    p._adapt(fpsAt(p._level, s));
    levels.push(p._level);
  }
  return levels;
}

test('a screen held at 30 fps keeps full resolution', () => {
  const levels = simulate(() => 30, 60);
  assert.equal(levels.at(-1), 0);
  assert.ok(levels.filter((l) => l > 0).length <= 1, 'at most one second at a lower resolution');
});

test('a heavy program settles at the resolution that runs smoothly', () => {
  const levels = simulate((level) => [20, 28, 42, 60, 60, 60][level], 60);
  assert.equal(levels.at(-1), 2);
});

test('a heavy program on a 30 fps screen stops lowering once it reaches 30', () => {
  const levels = simulate((level) => Math.min(30, [15, 25, 34, 45, 60, 60][level]), 60);
  assert.equal(levels.at(-1), 2);
});

test('a moment of slowness does not lower the resolution for good', () => {
  const levels = simulate((level, s) => (s < 3 ? 20 : 60), 30);
  assert.ok(Math.max(...levels) > 0, 'it reacts to the slow seconds');
  assert.equal(levels.at(-1), 0);
});

test('a resolution that is too slow is tried less and less often', () => {
  const levels = simulate((level) => [35, 58, 70, 70, 70, 70][level], 120);
  const raises = levels.filter((l, i) => i > 0 && l < levels[i - 1]).length;
  assert.equal(levels.at(-1), 1);
  assert.ok(raises <= 4, `tried full resolution ${raises} times in two minutes`);
});

test('a pause does not count as a slow second', () => {
  const p = Object.create(Player.prototype);
  p.options = { adaptive: true };
  p._resetAdaptive();
  p.fps = 60;
  p._fpsT = 1000;
  p._frames = 30;
  p._measure(61000, true); // first frame after a minute-long pause
  assert.equal(p.fps, 60);
  assert.equal(p._fpsT, 61000);
  assert.equal(p._frames, 0);
});
