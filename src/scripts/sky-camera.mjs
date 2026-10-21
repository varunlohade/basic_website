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

// Depth meter text: altitude above the waterline, metres below it.
export function depthLabel(cy, ground) {
  if (cy < ground) {
    const m = Math.round(((ground - cy) * 1500) / 10) * 10;
    return m.toLocaleString('en-US') + ' m';
  }
  return '−' + Math.round((cy - ground) * 30) + ' m';
}
