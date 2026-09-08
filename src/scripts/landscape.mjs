import { Texture, SRGBColorSpace } from 'three';
import { createWorkshop, ASSETS } from './workshop-scene.mjs';
import { CanvasRenderer } from './canvas-renderer.mjs';
import {
  createSceneLoader,
  fetchWithProgress,
  decodeImage,
} from './scene-loader.mjs';
const host = document.querySelector('.landscape');
const poster = document.querySelector('#scene-poster');
function showFullPoster() {
  if (!poster?.dataset.fullSrc) return;
  poster.src = poster.dataset.fullSrc;
  poster.classList.remove('is-placeholder');
}
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const loadingIndicator = createSceneLoader(
  document.querySelector('.scene-loader'),
  { reduceMotion: preference.matches },
);
// Safety net: if no bytes arrive for a while, hide the panel but keep loading.
const STALL_MS = 15000;
let loadingTimeout = setTimeout(() => loadingIndicator.hide(), STALL_MS);
function reportProgress(fraction) {
  clearTimeout(loadingTimeout);
  loadingTimeout = setTimeout(() => loadingIndicator.hide(), STALL_MS);
  loadingIndicator.progress(fraction);
}
function finishLoading() {
  clearTimeout(loadingTimeout);
  loadingIndicator.done();
}
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
  clearTimeout(loadingTimeout);
  loadingIndicator.hide();
  showFullPoster();
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
    const blobs = await fetchWithProgress(
        Object.values(ASSETS),
        reportProgress,
      ),
      images = new Map(
        await Promise.all(
          [...blobs].map(async ([url, blob]) => [url, await decodeImage(blob)]),
        ),
      ),
      textures = Object.fromEntries(
        Object.entries(ASSETS).map(([key, url]) => {
          const t = new Texture(prepare(images.get(url), key));
          t.colorSpace = SRGBColorSpace;
          t.needsUpdate = true;
          return [key, t];
        }),
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
    // Force a style pass so the canvas fades in instead of popping.
    renderer.domElement.getBoundingClientRect();
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
