import * as THREE from 'three';
import { pose, solveArm, strokes, writingPoint } from './workshop-motion.mjs';
export function createCanvasTexture(canvas) {
  const texture = new THREE.Texture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
export function addDetails({
  scene,
  textures,
  quad,
  robotPart,
  shoulder,
  elbow,
  size,
  materials,
  geometries,
}) {
  const dynamicTextures = [];
  const textureCanvas = (w, h) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const texture = createCanvasTexture(canvas);
    dynamicTextures.push(texture);
    return { canvas, texture, ctx: canvas.getContext('2d') };
  };
  const place = (mesh, corners) => {
    const a = mesh.geometry.attributes.position;
    for (let i = 0; i < 4; i++) a.setXYZ(i, ...corners[i], 0);
    a.needsUpdate = true;
  };
  // Animated application UI rendered into the laptop's screen plane.
  const screen = textureCanvas(640, 420),
    screenMesh = quad(screen.texture, 640, 420, 5);
  place(screenMesh, [
    [1310, 599],
    [1403, 599],
    [1289, 673],
    [1382, 673],
  ]);
  screenMesh.material.opacity = 0.91;
  function laptop(t) {
    const c = screen.ctx;
    c.fillStyle = '#172131';
    c.fillRect(0, 0, 640, 420);
    c.fillStyle = '#273348';
    c.fillRect(0, 0, 640, 28);
    c.font = '12px monospace';
    c.fillStyle = '#b7c5d9';
    c.fillText('Visual Studio Code — app.swift', 16, 19);
    c.fillStyle = '#1d293c';
    c.fillRect(0, 28, 95, 366);
    c.fillStyle = '#8293ad';
    c.font = '12px monospace';
    [
      'EXPLORER',
      '⌄ uchi',
      '  App.swift',
      '  Home.swift',
      '  Assets',
      '  Models',
    ].forEach((s, i) => c.fillText(s, 8, 54 + i * 25));
    c.font = '14px monospace';
    const code = [
      'import SwiftUI',
      '',
      'struct HomeView: View {',
      '  var body: some View {',
      '    VStack(spacing: 16) {',
      '      Text("Hello, world")',
      '      IntentCard()',
      '    }',
      '    .padding()',
      '  }',
      '}',
    ];
    code.forEach((s, i) => {
      c.fillStyle = ['#bb9af7', '#9ece6a', '#7dcfff'][i % 3];
      c.fillText(s, 110, 60 + i * 22);
    });
    c.fillStyle = '#111a28';
    c.fillRect(96, 309, 390, 85);
    c.fillStyle = '#8f9dab';
    c.font = '11px monospace';
    c.fillText('TERMINAL  OUTPUT  DEBUG CONSOLE', 108, 325);
    const lines = [
      '$ swift build',
      '✓ Connected to iPhone simulator',
      '✓ Build complete in 1.8s',
      '› Hot reload complete',
      '› Syncing files to device…',
      '✓ Ready',
    ];
    const index = Math.floor(t / 2) % lines.length;
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i === 2 ? '#91bbae' : '#71859d';
      c.fillText(lines[(index + i) % lines.length], 108, 343 + i * 17);
    }
    if (t % 1 < 0.5) c.fillRect(110, 387, 6, 2);
    // iPhone Simulator window, restrained and small next to the editor.
    c.fillStyle = '#303d52';
    c.fillRect(488, 34, 142, 355);
    c.fillStyle = '#a5b2c6';
    c.font = '10px monospace';
    c.fillText('iPhone · Simulator', 493, 49);
    c.fillStyle = '#080e18';
    c.beginPath();
    c.roundRect(499, 60, 120, 314, 18);
    c.fill();
    c.fillStyle = '#dce3e8';
    c.beginPath();
    c.roundRect(505, 67, 108, 300, 13);
    c.fill();
    c.fillStyle = '#142335';
    c.beginPath();
    c.roundRect(535, 72, 48, 8, 4);
    c.fill();
    c.font = 'bold 14px sans-serif';
    c.fillText('uchi', 514, 113);
    c.font = '9px sans-serif';
    c.fillText('Remember what matters', 513, 130);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i === Math.floor(t / 4) % 3 ? '#c0d4cd' : '#cad4de';
      c.fillRect(514, 147 + i * 52, 90, 42);
      c.fillStyle = '#718194';
      c.fillRect(522, 159 + i * 52, 62, 3);
      c.fillRect(522, 169 + i * 52, 43, 3);
    }
    c.fillStyle = '#92a6a7';
    c.fillRect(0, 396, 640, 24);
    screen.texture.needsUpdate = true;
  }
  // The canvas renderer applies a blue-water mask to this layer.
  const water = quad(textures.backdrop, 1672, 941, 3.5); // Wrist and independently closing jaws reuse the robot's original sprite.
  const wrist = new THREE.Group();
  wrist.position.set(size * (0.25 - 0.723), size * (0.14 - 0.297), 0);
  elbow.add(wrist);
  const wristAt = new THREE.Vector2(size * 0.25, size * 0.14);
  robotPart([[0, 0.22, 0.22, 0.52]], wristAt, wrist, 8).name = 'left gripper';
  const rightJaw = robotPart([[0.22, 0.22, 0.36, 0.52]], wristAt, wrist, 8);
  // Pencil is a slim native mesh, moving in the same coordinates as the grasp point.
  function pencil() {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          -1.5, -18, 0, 1.5, -18, 0, -1.5, 25, 0, 1.5, -18, 0, 1.5, 25, 0, -1.5,
          25, 0, -1.5, 25, 0, 1.5, 25, 0, 0, 30, 0,
        ],
        3,
      ),
    );
    const m = new THREE.MeshBasicMaterial({
      color: 0xdfa743,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 8;
    scene.add(mesh);
    materials.push(m);
    geometries.push(g);
    return mesh;
  }
  const pen = pencil();
  // Other pencils stay in the holder; the animated one is the rightmost pencil.
  const fixed = [pencil(), pencil(), pencil()];
  fixed.forEach((p, i) => {
    p.position.set(1453 + i * 6, 630, 0);
    p.rotation.z = (i - 1) * 0.12;
    p.renderOrder = 4.1;
  });
  const cup = quad(textures.backdrop, 1672, 941, 8.5);
  const ink = textureCanvas(400, 120),
    inkMesh = quad(ink.texture, 400, 120, 5);
  place(inkMesh, [
    [1375, 690],
    [1509, 690],
    [1375, 720],
    [1509, 720],
  ]);
  function drawInk(progress, opacity) {
    const c = ink.ctx;
    c.clearRect(0, 0, 400, 120);
    c.lineWidth = 2.8;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = `rgba(42,55,67,${opacity})`;
    const state = writingPoint(progress);
    for (let i = 0; i <= state.stroke; i++) {
      const points = strokes[i];
      c.beginPath();
      const pt = (p) => [((p[0] - 1375) * 400) / 134, (p[1] - 690) * 4];
      c.moveTo(...pt(points[0]));
      for (let j = 1; j < points.length; j++) {
        if (i === state.stroke && j === state.segment) {
          if (state.down) c.lineTo(...pt(state.tip));
          break;
        }
        c.lineTo(...pt(points[j]));
      }
      c.stroke();
    }
    ink.texture.needsUpdate = true;
  }
  function update(t) {
    const state = pose(t),
      q = solveArm(state.grip);
    shoulder.rotation.z = q.shoulder;
    elbow.rotation.z = q.elbow;
    wrist.rotation.z = q.wrist;
    rightJaw.position.x = state.closed ? -5 : 0;
    pen.position.set(...(state.held ? state.grip : [1475, 627]), 0);
    pen.visible = true;
    drawInk(
      state.t < 15 ? state.ink : 1,
      state.t < 7 ? 0 : state.t > 22 ? state.ink : 1,
    );
    laptop(t);
    return state;
  }
  return {
    update,
    dispose: () => dynamicTextures.forEach((texture) => texture.dispose()),
  };
}
