import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnchors,
  makeCamera,
  depthLabel,
  metresAt,
  WORLD,
} from '../src/scripts/sky-camera.mjs';

test('anchors are strictly increasing and end at maxY', () => {
  const a = buildAnchors(
    [
      [0, 0.5],
      [300, 0.6],
      [200, 2.1],
      [5000, 3.4],
    ],
    4000,
  );
  for (let i = 1; i < a.length; i++) assert.ok(a[i][0] > a[i - 1][0]);
  assert.equal(a[a.length - 1][0], 4000);
});

test('camera hits anchors, clamps at the ends, and never goes back up', () => {
  const anchors = buildAnchors(
    [
      [0, 0.5],
      [250, 0.6],
      [900, 2.1],
      [2000, 2.34],
      [2600, 2.62],
      [3000, 3.42],
    ],
    3000,
  );
  const cam = makeCamera(anchors);
  for (const [x, y] of anchors) assert.ok(Math.abs(cam(x) - y) < 1e-9);
  assert.equal(cam(-50), 0.5);
  assert.equal(cam(9999), 3.42);
  let prev = -Infinity;
  for (let y = 0; y <= 3000; y += 7) {
    const c = cam(y);
    assert.ok(c >= prev - 1e-9, `depth went up at ${y}`);
    prev = c;
  }
});

test('depth meter matches real heights at each landmark', () => {
  assert.equal(depthLabel(metresAt(WORLD.CY_TOP)), '3,000 m');
  assert.equal(depthLabel(metresAt(WORLD.HZ)), '2,000 m');
  assert.equal(depthLabel(metresAt(WORLD.C_BASE)), '900 m');
  assert.equal(depthLabel(metresAt(WORLD.TOWER_TOP)), '230 m');
  assert.equal(depthLabel(metresAt(WORLD.GROUND)), '0 m');
  assert.equal(depthLabel(metresAt(WORLD.FLOOR)), '−30 m');
  const reef = metresAt(WORLD.CY_BOT);
  assert.ok(reef <= -20 && reef >= -30, `bottom reads ${reef}`);
});

test('tallest building stands 300-400 m, above the bridge towers', () => {
  const top = metresAt(WORLD.GROUND - WORLD.MAX_BUILDING);
  assert.ok(top >= 300 && top <= 400, `building top reads ${top}`);
  assert.ok(top > metresAt(WORLD.TOWER_TOP));
});

test('height falls steadily from the sky to the reef', () => {
  let prev = Infinity;
  for (let y = WORLD.CY_TOP; y <= WORLD.CY_BOT; y += 0.01) {
    const m = metresAt(y);
    assert.ok(m < prev, `height rose at ${y}`);
    prev = m;
  }
});
