import { TextureLoader, SRGBColorSpace } from 'three';
import { createWorkshop, ASSETS } from './workshop-scene.mjs';
import { CanvasRenderer } from './canvas-renderer.mjs';
const host = document.querySelector('.landscape');
const loadingIndicator = document.querySelector('.scene-loader');
const loadingTimeout = setTimeout(finishLoading, 10000);
function finishLoading() {
  clearTimeout(loadingTimeout);
  loadingIndicator?.remove();
}
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let paused = preference.matches,
  visible = true,
  frame = 0,
  last = 0,
  time = 0,
  renderer,
  workshop,
  resizeObserver,
  failed = false;
function fail(error) {
  finishLoading();
  console.error('Landscape animation failed', error);
  failed = true;
  resizeObserver?.disconnect();
  workshop?.dispose();
  cancelAnimationFrame(frame);
  renderer?.domElement.remove();
  host.classList.remove('has-animation');
}
function paint() {
  workshop.update(time);
  renderer.render(workshop.scene, workshop.camera, time);
}
function tick(now) {
  frame = 0;
  if (paused || !visible || document.hidden) return;
  if (!last) last = now;
  if (now - last >= 1000 / 24) {
    time += Math.min((now - last) / 1000, 0.15);
    last = now;
    try {
      paint();
    } catch (e) {
      fail(e);
      return;
    }
  }
  frame = requestAnimationFrame(tick);
}
function resume() {
  cancelAnimationFrame(frame);
  last = 0;
  if (workshop && !failed && !paused && visible && !document.hidden)
    frame = requestAnimationFrame(tick);
}
function prepare(image, key) {
  if (!['branches', 'canopy'].includes(key)) return image;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const c = canvas.getContext('2d');
  c.drawImage(image, 0, 0);
  const d = c.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i],
      g = d.data[i + 1],
      b = d.data[i + 2];
    if (key === 'branches' && b > r * 1.15 && b > g * 1.04) d.data[i + 3] = 0;
    if (key === 'canopy')
      d.data[i + 3] *= Math.max(
        0,
        Math.min(1, (Math.max(r, g, b) - Math.min(r, g, b) - 8) / 12),
      );
  }
  c.putImageData(d, 0, 0);
  return canvas;
}
async function start() {
  try {
    const loader = new TextureLoader(),
      textures = Object.fromEntries(
        await Promise.all(
          Object.entries(ASSETS).map(async ([key, url]) => {
            const t = await loader.loadAsync(url);
            t.image = prepare(t.image, key);
            t.colorSpace = SRGBColorSpace;
            return [key, t];
          }),
        ),
      );
    workshop = createWorkshop(textures);
    renderer = new CanvasRenderer();
    renderer.setPixelRatio(devicePixelRatio);
    renderer.domElement.id = 'scene-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const resize = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height || failed) return;
      renderer.setSize(r.width, r.height);
      workshop.resize(r.width, r.height);
      paint();
    };
    resize();
    host.append(renderer.domElement);
    host.classList.add('has-animation');
    finishLoading();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resume();
  } catch (e) {
    fail(e);
  }
}
preference.addEventListener('change', (e) => {
  paused = e.matches;
  resume();
});
document.addEventListener('visibilitychange', resume);
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  resume();
}).observe(host);
window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
window.addEventListener('pageshow', resume);
start();
