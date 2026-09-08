const LINES = [
  'Loading algorithm to break the space-time continuum…',
  'Convincing the clouds to drift…',
  'Teaching the robot arm to wave…',
  'Painting the river one row at a time…',
  'Rehearsing a dad joke…',
  'Almost there. Probably.',
];

/** Fetches every asset URL, reporting byte-level progress as a 0–1 fraction. */
export async function fetchWithProgress(urls, onProgress) {
  const unique = [...new Set(urls)];
  const received = new Map(unique.map((u) => [u, 0]));
  const totals = new Map(unique.map((u) => [u, 0]));
  const report = () => {
    const known = [...totals.values()].every((t) => t > 0);
    let sum = 0;
    for (const u of unique) {
      const total = totals.get(u);
      const part = total ? received.get(u) / total : 0;
      sum += known ? received.get(u) : Math.min(1, part);
    }
    const denominator = known
      ? [...totals.values()].reduce((a, b) => a + b, 0)
      : unique.length;
    onProgress(Math.max(0, Math.min(1, sum / denominator)));
  };
  const blobs = await Promise.all(
    unique.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      totals.set(url, total);
      if (!res.body || !total) {
        const blob = await res.blob();
        totals.set(url, blob.size);
        received.set(url, blob.size);
        report();
        return [url, blob];
      }
      const reader = res.body.getReader(),
        chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received.set(url, received.get(url) + value.byteLength);
        report();
      }
      return [url, new Blob(chunks, { type: res.headers.get('content-type') })];
    }),
  );
  return new Map(blobs);
}

/** Decodes a blob into something the scene can draw from. */
export async function decodeImage(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to the <img> path below.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image failed to decode'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Drives the progress panel: rotating lines, percentage, bar, and exit. */
export function createSceneLoader(root, { reduceMotion = false } = {}) {
  if (!root) return { progress() {}, done() {}, hide() {} };
  const label = root.querySelector('[data-loader-label]'),
    pct = root.querySelector('[data-loader-pct]'),
    track = root.querySelector('[data-loader-track]'),
    fill = root.querySelector('[data-loader-fill]');
  let line = 0,
    finished = false,
    fraction = 0;
  const rotate = setInterval(() => {
    if (finished) return;
    // The last line is reserved for when the bar is actually near the end.
    const pool = fraction > 0.75 ? LINES.length : LINES.length - 1;
    line = (line + 1) % pool;
    if (reduceMotion) {
      label.textContent = LINES[line];
      return;
    }
    label.classList.add('is-swapping');
    setTimeout(() => {
      label.textContent = LINES[line];
      label.classList.remove('is-swapping');
    }, 250);
  }, 2200);
  const remove = () => {
    root.remove();
  };
  return {
    progress(next) {
      fraction = next;
      const value = Math.round(next * 100);
      pct.textContent = `${value}%`;
      fill.style.width = `${value}%`;
      track.setAttribute('aria-valuenow', String(value));
    },
    done() {
      if (finished) return;
      finished = true;
      clearInterval(rotate);
      this.progress(1);
      label.classList.remove('is-swapping');
      label.textContent = 'Scene ready.';
      root.classList.add('is-done');
      setTimeout(remove, reduceMotion ? 0 : 600);
    },
    hide() {
      finished = true;
      clearInterval(rotate);
      root.classList.add('is-done');
      setTimeout(remove, reduceMotion ? 0 : 600);
    },
  };
}
