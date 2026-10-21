// Scroll position -> camera depth for the sky-to-sea scene.
// Depth is in world units (1 = one viewport height).

// points: [[scrollY, depth], ...] in section order. Returns strictly
// increasing anchors that start at 0 and end at maxY.
export function buildAnchors(points, maxY) {
  const anchors = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = anchors[anchors.length - 1][0];
    let x = Math.min(maxY, Math.max(points[i][0], prev + 1));
    if (i === points.length - 1) x = Math.max(maxY, prev + 1);
    if (x <= prev) continue;
    anchors.push([x, points[i][1]]);
  }
  return anchors;
}

// Monotone cubic (Fritsch-Carlson) through the anchors.
export function makeCamera(anchors) {
  const n = anchors.length;
  if (n < 2) return () => anchors[0][1];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    d.push(
      (anchors[i + 1][1] - anchors[i][1]) / (anchors[i + 1][0] - anchors[i][0]),
    );
  }
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m.push(0);
      continue;
    }
    const h0 = anchors[i][0] - anchors[i - 1][0];
    const h1 = anchors[i + 1][0] - anchors[i][0];
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    m.push((w1 + w2) / (w1 / d[i - 1] + w2 / d[i]));
  }
  m.push(d[n - 2]);

  return (y) => {
    if (y <= anchors[0][0]) return anchors[0][1];
    if (y >= anchors[n - 1][0]) return anchors[n - 1][1];
    let i = 0;
    while (y > anchors[i + 1][0]) i++;
    const h = anchors[i + 1][0] - anchors[i][0];
    const s = (y - anchors[i][0]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * anchors[i][1] +
      (s3 - 2 * s2 + s) * h * m[i] +
      (-2 * s3 + 3 * s2) * anchors[i + 1][1] +
      (s3 - s2) * h * m[i + 1]
    );
  };
}

// World layout shared by the scene and the depth meter (y grows downward).
export const WORLD = {
  CY_TOP: 0.5, // camera centre at the top of the page
  HZ: 0.66, // cloud tops / horizon of the cloud sea
  C_NEAR: 1.22, // cloud sea gives way to fog
  C_BASE: 1.86, // underside of the cloud deck
  TOWER_TOP: 2.27, // bridge tower tops
  GROUND: 2.5, // waterline
  FLOOR: 3.74, // reef floor
  CY_BOT: 3.42, // camera centre at the bottom of the page
  MAX_BUILDING: 0.38, // tallest building, in world units above the water
};

// Homepage scroll anchors. The descent is spread so the scene moves close
// to page speed: clouds over the hero, the city as #work arrives, and the
// sea from the moment the footer comes into view.
export function sceneAnchors({ W, H, wTop, fTop, maxY }) {
  const phone = W < 600;
  return buildAnchors(
    [
      [0, WORLD.CY_TOP],
      [wTop - H * 0.05, phone ? 1.9 : 2.0],
      [fTop - H, phone ? 2.9 : 2.7],
      [maxY, WORLD.CY_BOT],
    ],
    maxY,
  );
}

// Real heights at each landmark. Below the cloud base the city uses one
// scale (1 unit = 1,000 m), so towers and buildings read true to size.
export const LANDMARKS = [
  [WORLD.CY_TOP, 3000],
  [WORLD.HZ, 2000],
  [WORLD.C_BASE, 900],
  [WORLD.GROUND - 0.4, 400],
  [WORLD.TOWER_TOP, 230],
  [WORLD.GROUND, 0],
  [WORLD.FLOOR, -30],
];

// Metres above (+) or below (-) the waterline at world depth y.
export function metresAt(y, marks = LANDMARKS) {
  let i = 0;
  if (y > marks[marks.length - 1][0]) i = marks.length - 2;
  else while (i < marks.length - 2 && y > marks[i + 1][0]) i++;
  const [y0, m0] = marks[i];
  const [y1, m1] = marks[i + 1];
  return m0 + ((y - y0) / (y1 - y0)) * (m1 - m0);
}

// Depth meter text: tens of metres in the air, single metres under water.
export function depthLabel(metres) {
  if (metres >= 0.5) {
    const m = Math.round(metres / 10) * 10;
    return m.toLocaleString('en-US') + ' m';
  }
  const d = Math.round(-metres);
  return d === 0 ? '0 m' : '−' + d + ' m';
}
