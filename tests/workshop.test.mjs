import test from 'node:test';
import assert from 'node:assert/strict';
import { Texture } from 'three';
import { createCanvasTexture } from '../src/scripts/workshop-details.mjs';
import { pose, solveArm } from '../src/scripts/workshop-motion.mjs';

test('animated screens cannot overwrite the backdrop texture', () => {
  const image = { width: 1672, height: 941 };
  const backdrop = new Texture(image);
  const screen = createCanvasTexture({ width: 640, height: 420 });
  const ink = createCanvasTexture({ width: 400, height: 120 });
  screen.image = { width: 10, height: 10 };
  assert.equal(backdrop.image, image);
  assert.notEqual(screen.source, backdrop.source);
  assert.notEqual(ink.source, screen.source);
  assert.equal(ink.image.width, 400);
});

test('arm reaches the pencil throughout the loop without jumps', () => {
  let previous;
  for (let frame = 0; frame <= 24 * 60; frame++) {
    const state = pose(frame / 60);
    const q = solveArm(state.grip);
    const rotate = ([x, y], r) => [
      x * Math.cos(r) - y * Math.sin(r),
      x * Math.sin(r) + y * Math.cos(r),
    ];
    const upper = rotate([193 * 0.108, -193 * 0.46], q.shoulder);
    const lower = rotate([-193 * 0.473, -193 * 0.157], q.shoulder + q.elbow);
    assert.ok(
      Math.hypot(
        q.base[0] + upper[0] + lower[0] - q.wristTarget[0],
        q.base[1] + upper[1] + lower[1] - q.wristTarget[1],
      ) < 0.001,
    );
    if (previous)
      assert.ok(Math.hypot(...state.grip.map((x, i) => x - previous[i])) < 2);
    previous = state.grip;
  }
});

test('pencil transfer stays at the holder and only writes while held', () => {
  for (const time of [3, 19]) assert.deepEqual(pose(time).grip, [1475, 627]);
  for (let t = 7; t < 15; t += 0.1) {
    const state = pose(t);
    assert.ok(state.held && state.closed);
    assert.equal(state.grip[1] + 30, state.writing.tip[1]);
  }
  assert.deepEqual(pose(0), pose(24));
});
