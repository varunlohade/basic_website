import { addDetails } from './workshop-details.mjs';
import * as THREE from 'three';

export const WIDTH = 1672;
export const HEIGHT = 941;
export const LOOP_SECONDS = 96;
export const ASSETS = {
  backdrop: '/art/backdrop.png',
  branches: '/art/backdrop.png',
  canopy: '/art/canopy.png',
  cloud: '/art/cloud.png',
  robot: '/art/robot.png',
};
const TAU = Math.PI * 2;
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => {
  const a = clamp(x);
  return a * a * (3 - 2 * a);
};

// Shared by the WebGL scene and the offline film export. Coordinates are pixels,
// with the origin at the top left, so joint pivots remain tied to the artwork.
export function createWorkshop(textures) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, WIDTH, 0, HEIGHT, -100, 100);
  camera.position.z = 10;
  const materials = [];
  const geometries = [];
  function material(texture) {
    const m = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    materials.push(m);
    return m;
  }
  function quad(texture, width, height, order, segmentsX = 1, segmentsY = 1) {
    const g = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
    // PlaneGeometry's top row is positive Y. In our image coordinates top is 0.
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setXYZ(i, p.getX(i) + width / 2, height / 2 - p.getY(i), 0);
    geometries.push(g);
    const mesh = new THREE.Mesh(g, material(texture));
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }
  const backdrop = quad(textures.backdrop, WIDTH, HEIGHT, 0);
  backdrop.name = 'fixed scenery';
  const cloudRatio = textures.cloud.image.width / textures.cloud.image.height;
  const clouds = [];
  // Repeated strips wrap beyond both edges; no visible reset or reversed drift.
  // Both strips repeat after 96 seconds. The more distant layer travels slower.
  for (const layer of [
    { spacing: 836, width: 270, y: 277, offset: 50, order: 1, opacity: 0.65 },
    { spacing: 836, width: 155, y: 325, offset: 455, order: 1, opacity: 0.55 },
    { spacing: 1672, width: 790, y: 30, offset: 65, order: 2, opacity: 0.98 },
    { spacing: 1672, width: 400, y: 95, offset: 1110, order: 2, opacity: 0.9 },
  ]) {
    for (let i = -2; i <= Math.ceil(WIDTH / layer.spacing) + 1; i++) {
      const cloud = quad(
        textures.cloud,
        layer.width,
        layer.width / cloudRatio,
        layer.order,
      );
      cloud.material.opacity = layer.opacity;
      cloud.position.y = layer.y;
      clouds.push({
        mesh: cloud,
        start: i * layer.spacing + layer.offset,
        spacing: layer.spacing,
      });
    }
  }
  const branches = quad(textures.branches, WIDTH, HEIGHT, 3);
  branches.name = 'fixed trunk over clouds';
  const canopy = quad(textures.canopy, WIDTH, HEIGHT, 4, 24, 14);
  canopy.name = 'wind in leaves';
  const rest = Float32Array.from(canopy.geometry.attributes.position.array);
  const weights = Array.from({ length: rest.length / 3 }, (_, i) => {
    const x = rest[i * 3],
      y = rest[i * 3 + 1];
    return smooth(Math.hypot((x - 1575) * 0.9, y - 410) / 570);
  });

  // Articulated robot: fixed pedestal, shoulder group, elbow inside shoulder.
  // Rectangular UV regions select the transparent source without duplicating it.
  const robotX = 1424,
    robotY = 512,
    size = 193;
  const shoulderAt = new THREE.Vector2(size * 0.615, size * 0.757);
  const elbowAt = new THREE.Vector2(size * 0.723, size * 0.297);
  const shoulder = new THREE.Group();
  shoulder.position.set(robotX + shoulderAt.x, robotY + shoulderAt.y, 0);
  scene.add(shoulder);
  const elbow = new THREE.Group();
  elbow.position.set(elbowAt.x - shoulderAt.x, elbowAt.y - shoulderAt.y, 0);
  shoulder.add(elbow);
  function robotPart(rects, pivot, parent, order) {
    const positions = [],
      uvs = [];
    for (const [x0, y0, x1, y1] of rects) {
      for (const [x, y] of [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]) {
        positions.push(x * size - pivot.x, y * size - pivot.y, 0);
        uvs.push(x, 1 - y);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometries.push(g);
    const part = new THREE.Mesh(g, material(textures.robot));
    part.renderOrder = order;
    part.frustumCulled = false;
    parent.add(part);
    return part;
  }
  const pedestal = robotPart(
    [[0, 0.83, 1, 1]],
    new THREE.Vector2(-robotX, -robotY),
    scene,
    5,
  );
  pedestal.name = 'fixed robot pedestal';
  robotPart(
    [
      [0.55, 0.42, 1, 0.85],
      [0, 0.52, 0.55, 0.85],
    ],
    shoulderAt,
    shoulder,
    6,
  );
  robotPart(
    [
      [0, 0, 1, 0.22],
      [0.36, 0.22, 1, 0.42],
      [0.36, 0.42, 0.55, 0.52],
    ],
    elbowAt,
    elbow,
    7,
  );

  const details = addDetails({
    scene,
    textures,
    quad,
    robotPart,
    shoulder,
    elbow,
    size,
    materials,
    geometries,
  });
  function update(seconds) {
    const t = seconds % LOOP_SECONDS;
    for (const cloud of clouds)
      cloud.mesh.position.x = cloud.start + (t * cloud.spacing) / LOOP_SECONDS;
    const p = canopy.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = rest[i * 3],
        y = rest[i * 3 + 1],
        flexibility = weights[i];
      const gust =
        6.4 * Math.sin((TAU * t) / 8) +
        2.4 * Math.sin((TAU * t) / 12 + x * 0.003);
      const ripple = 1.3 * Math.sin((TAU * t) / 3 + x * 0.055 + y * 0.041);
      p.setXYZ(
        i,
        x + flexibility * (gust + ripple),
        y +
          flexibility *
            (2.2 * Math.sin((TAU * t) / 8 + 0.5) +
              0.65 * Math.sin((TAU * t) / 4 + x * 0.04)),
        0,
      );
    }
    p.needsUpdate = true;
    details.update(seconds);
    scene.updateMatrixWorld(true);
  }
  function resize(width, height) {
    // Match object-fit: cover / object-position: right center on the fallback.
    const scale = Math.max(width / WIDTH, height / HEIGHT);
    const visibleWidth = width / scale,
      visibleHeight = height / scale;
    camera.left = WIDTH - visibleWidth;
    camera.right = WIDTH;
    camera.top = (HEIGHT - visibleHeight) / 2;
    camera.bottom = camera.top + visibleHeight;
    camera.updateProjectionMatrix();
  }
  function dispose() {
    details.dispose();
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
    Object.values(textures).forEach((t) => t.dispose());
  }
  update(0);
  return {
    scene,
    camera,
    update,
    resize,
    dispose,
    canopy,
    clouds,
    shoulder,
    elbow,
    backdrop,
    pedestal,
  };
}
