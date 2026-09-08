export const PERIOD = 24;
const ease = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * ease(t));
// Tip path lies on the desk's perspective plane. Pen-up segments are explicit.
export const strokes = [
  [
    [1418, 708],
    [1426, 699],
  ],
  [
    [1422, 704],
    [1432, 702],
    [1428, 708],
  ],
  [
    [1440, 703],
    [1436, 708],
  ],
  [
    [1442, 700],
    [1442.3, 700],
  ],
];
const lengths = strokes.map((s) =>
  s
    .slice(1)
    .reduce((n, p, i) => n + Math.hypot(p[0] - s[i][0], p[1] - s[i][1]), 0),
);
export function writingPoint(progress) {
  const total = lengths.reduce((a, b) => a + b, 0) + 6 * (strokes.length - 1);
  let d = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    for (let j = 1; j < s.length; j++) {
      const a = s[j - 1],
        b = s[j],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= l)
        return {
          tip: mix(a, b, d / l),
          down: true,
          stroke: i,
          segment: j,
          fraction: d / l,
        };
      d -= l;
    }
    if (i < strokes.length - 1) {
      if (d <= 6)
        return {
          tip: mix(s.at(-1), strokes[i + 1][0], d / 6).map((v, j) =>
            j ? v - 4 * Math.sin((Math.PI * d) / 6) : v,
          ),
          down: false,
          stroke: i,
          segment: s.length,
          fraction: 1,
        };
      d -= 6;
    }
  }
  return {
    tip: strokes.at(-1).at(-1),
    down: true,
    stroke: 3,
    segment: 1,
    fraction: 1,
  };
}
export function pose(seconds) {
  const t = ((seconds % PERIOD) + PERIOD) % PERIOD;
  const home = [1475, 590],
    holder = [1475, 627],
    lift = [1475, 590],
    ready = [1418, 678];
  let grip = home,
    held = false,
    closed = false,
    writing = null;
  if (t < 2) grip = mix(home, holder, t / 2);
  else if (t < 3) {
    grip = holder;
    closed = t > 2.25;
  } else if (t < 5) {
    grip = mix(holder, lift, (t - 3) / 2);
    held = closed = true;
  } else if (t < 7) {
    grip = mix(lift, ready, (t - 5) / 2);
    held = closed = true;
  } else if (t < 15) {
    writing = writingPoint((t - 7) / 8);
    grip = [writing.tip[0], writing.tip[1] - 30];
    held = closed = true;
  } else if (t < 17) {
    grip = mix([1442.3, 670], lift, (t - 15) / 2);
    held = closed = true;
  } else if (t < 19) {
    grip = mix(lift, holder, (t - 17) / 2);
    held = closed = true;
  } else if (t < 20) {
    grip = holder;
    closed = t < 19.5;
  } else if (t < 22) grip = mix(holder, home, (t - 20) / 2);
  // Both pause intervals share the exact same pencil position at transfer.
  return {
    t,
    grip,
    held,
    closed,
    writing,
    ink: t < 7 ? 0 : t < 15 ? (t - 7) / 8 : t < 22 ? 1 : 1 - ease((t - 22) / 2),
  };
}
export function solveArm(grip) {
  const base = [1424 + 193 * 0.615, 512 + 193 * 0.757];
  const v1 = [193 * (0.723 - 0.615), 193 * (0.297 - 0.757)];
  const v2 = [193 * (0.25 - 0.723), 193 * (0.14 - 0.297)];
  const wrist = [grip[0] + 193 * 0.045, grip[1] - 193 * 0.305];
  const dx = wrist[0] - base[0],
    dy = wrist[1] - base[1],
    l1 = Math.hypot(...v1),
    l2 = Math.hypot(...v2);
  const c = Math.max(
    -1,
    Math.min(1, (dx * dx + dy * dy - l1 * l1 - l2 * l2) / (2 * l1 * l2)),
  );
  const q2 = -Math.acos(c),
    q1 =
      Math.atan2(dy, dx) -
      Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2));
  return {
    shoulder: q1 - Math.atan2(v1[1], v1[0]),
    elbow: q2 - (Math.atan2(v2[1], v2[0]) - Math.atan2(v1[1], v1[0])),
    wrist: -(q1 + q2 - Math.atan2(v2[1], v2[0])),
    base,
    wristTarget: wrist,
  };
}
