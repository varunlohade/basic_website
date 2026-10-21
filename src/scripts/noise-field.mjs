// Dithered "warp" noise background.
// <div data-noise-field data-color="#000000" data-alpha="0.12">
// The canvas is viewport-sized and fixed; the host clips it, so cost never grows with page height.

function makeNoise() {
  const p = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (h, x, y, z) => {
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  };
  return (x, y, z) => {
    const X = Math.floor(x) & 255,
      Y = Math.floor(y) & 255,
      Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x),
      v = fade(y),
      w = fade(z);
    const A = p[X] + Y,
      AA = p[A] + Z,
      AB = p[A + 1] + Z;
    const B = p[X + 1] + Y,
      BA = p[B] + Z,
      BB = p[B + 1] + Z;
    return lerp(
      w,
      lerp(
        v,
        lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
        lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z)),
      ),
      lerp(
        v,
        lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
        lerp(
          u,
          grad(p[AB + 1], x, y - 1, z - 1),
          grad(p[BB + 1], x - 1, y - 1, z - 1),
        ),
      ),
    );
  };
}

const BAYER4 = new Float32Array(
  [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
    (v) => (v + 0.5) / 16,
  ),
);
const SPEED = 0.005;
const GRID_STEP = 4;

function packColor(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16);
  return (
    ((Math.round(alpha * 255) << 24) |
      ((n & 0xff) << 16) |
      (n & 0xff00) |
      ((n >> 16) & 0xff)) >>>
    0
  );
}

// Domain-warped smoke on a coarse noise grid, bilinear upsampled:
// per-pixel looks at a fraction of the cost.
function warp(noise, w, h) {
  const s = 0.0035;
  const sample = (x, y, t) => {
    const qx = noise(x * s, y * s, t),
      qy = noise(x * s + 5.2, y * s + 1.3, t);
    const v = noise(x * s + 3 * qx, y * s + 3 * qy, t * 0.7);
    return Math.max(0, v * 1.6 + 0.05);
  };
  const gw = Math.ceil(w / GRID_STEP) + 2,
    gh = Math.ceil(h / GRID_STEP) + 2;
  const g = new Float32Array(gw * gh);
  const ink = new Float32Array(w * h);
  return (t) => {
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++)
        g[gy * gw + gx] = sample(gx * GRID_STEP, gy * GRID_STEP, t);
    for (let y = 0; y < h; y++) {
      const fy = y / GRID_STEP,
        iy = fy | 0,
        ty = fy - iy;
      for (let x = 0; x < w; x++) {
        const fx = x / GRID_STEP,
          ix = fx | 0,
          tx = fx - ix,
          k = iy * gw + ix;
        const top = g[k] + (g[k + 1] - g[k]) * tx;
        const bot = g[k + gw] + (g[k + gw + 1] - g[k + gw]) * tx;
        ink[y * w + x] = top + (bot - top) * ty;
      }
    }
    return ink;
  };
}

function mount(host) {
  const d = host.dataset;
  const color = packColor(d.color || '#000000', parseFloat(d.alpha || '0.12'));
  const pixel = parseInt(d.pixel || '3', 10);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const noise = makeNoise();
  let w,
    h,
    img,
    px32,
    step,
    t = Math.random() * 10,
    last = 0,
    onScreen = true;

  const draw = () => {
    const ink = step(t);
    for (let y = 0; y < h; y++) {
      const row = (y & 3) << 2;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        px32[i] = ink[i] > BAYER4[row | (x & 3)] ? color : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  const size = () => {
    w = Math.ceil(innerWidth / pixel);
    h = Math.ceil(innerHeight / pixel);
    canvas.width = w;
    canvas.height = h;
    img = ctx.createImageData(w, h);
    px32 = new Uint32Array(img.data.buffer);
    step = warp(noise, w, h);
    draw();
  };
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!onScreen || document.hidden || now - last < 1000 / 30) return;
    last = now;
    t += SPEED;
    draw();
  };
  size();
  addEventListener('resize', size);
  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting)).observe(
    host,
  );
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
    requestAnimationFrame(loop);
}

document.querySelectorAll('[data-noise-field]').forEach(mount);
