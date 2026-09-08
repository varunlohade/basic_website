// Rasterize the Three.js scene graph without depending on GPU/WebGL availability.
export class CanvasRenderer {
  constructor() {
    this.domElement = document.createElement('canvas');
    this.ctx = this.domElement.getContext('2d', { alpha: false });
    this.ratio = 1;
    this.water = null;
  }
  setPixelRatio(r) {
    this.ratio = Math.min(r, 1.25);
  }
  setSize(w, h) {
    this.domElement.width = Math.round(w * this.ratio);
    this.domElement.height = Math.round(h * this.ratio);
  }
  dispose() {}
  render(scene, camera, time = 0) {
    const ctx = this.ctx,
      w = this.domElement.width,
      h = this.domElement.height;
    const sx = w / (camera.right - camera.left),
      sy = h / (camera.bottom - camera.top);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#68b6ee';
    ctx.fillRect(0, 0, w, h);
    const objects = [];
    scene.traverse((o) => {
      if (o.isMesh && o.visible) objects.push(o);
    });
    objects.sort((a, b) => a.renderOrder - b.renderOrder);
    for (const mesh of objects) {
      const { position: p, uv } = mesh.geometry.attributes,
        ix = mesh.geometry.index,
        m = mesh.matrixWorld.elements,
        img = mesh.material.map?.image;
      ctx.save();
      if (mesh.renderOrder === 3.5) {
        this.drawWater(img, time, camera, sx, sy);
        ctx.restore();
        continue;
      }
      if (mesh.renderOrder === 8.5) {
        ctx.beginPath();
        ctx.rect(
          (1445 - camera.left) * sx,
          (646 - camera.top) * sy,
          47 * sx,
          48 * sy,
        );
        ctx.clip();
      }
      const pts = [],
        coords = [];
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i);
        pts.push([
          (m[0] * x + m[4] * y + m[12] - camera.left) * sx,
          (m[1] * x + m[5] * y + m[13] - camera.top) * sy,
        ]);
        if (img)
          coords.push([uv.getX(i) * img.width, (1 - uv.getY(i)) * img.height]);
      }
      ctx.globalAlpha = mesh.material.opacity ?? 1;
      if (p.count === 4 && img) {
        const [a, b, c] = pts;
        ctx.setTransform(
          (b[0] - a[0]) / img.width,
          (b[1] - a[1]) / img.width,
          (c[0] - a[0]) / img.height,
          (c[1] - a[1]) / img.height,
          a[0],
          a[1],
        );
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        continue;
      }
      const count = ix ? ix.count : p.count;
      for (let j = 0; j < count; j += 3) {
        const a = ix ? ix.getX(j) : j,
          b = ix ? ix.getX(j + 1) : j + 1,
          c = ix ? ix.getX(j + 2) : j + 2;
        if (
          Math.max(pts[a][0], pts[b][0], pts[c][0]) < 0 ||
          Math.min(pts[a][0], pts[b][0], pts[c][0]) > w
        )
          continue;
        if (img)
          this.triangle(
            img,
            pts[a],
            pts[b],
            pts[c],
            coords[a],
            coords[b],
            coords[c],
          );
        else {
          ctx.fillStyle = '#dfa743';
          ctx.beginPath();
          ctx.moveTo(...pts[a]);
          ctx.lineTo(...pts[b]);
          ctx.lineTo(...pts[c]);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
  triangle(img, a, b, c, u, v, z) {
    const ctx = this.ctx,
      [x0, y0] = u,
      [x1, y1] = v,
      [x2, y2] = z,
      d = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    if (Math.abs(d) < 0.0001) return;
    const ax = (a[0] * (y1 - y2) + b[0] * (y2 - y0) + c[0] * (y0 - y1)) / d,
      bx = (a[1] * (y1 - y2) + b[1] * (y2 - y0) + c[1] * (y0 - y1)) / d;
    const cy = (a[0] * (x2 - x1) + b[0] * (x0 - x2) + c[0] * (x1 - x0)) / d,
      dy = (a[1] * (x2 - x1) + b[1] * (x0 - x2) + c[1] * (x1 - x0)) / d;
    const ex =
        (a[0] * (x1 * y2 - x2 * y1) +
          b[0] * (x2 * y0 - x0 * y2) +
          c[0] * (x0 * y1 - x1 * y0)) /
        d,
      fy =
        (a[1] * (x1 * y2 - x2 * y1) +
          b[1] * (x2 * y0 - x0 * y2) +
          c[1] * (x0 * y1 - x1 * y0)) /
        d;
    ctx.save();
    const mx = (a[0] + b[0] + c[0]) / 3,
      my = (a[1] + b[1] + c[1]) / 3;
    const expand = (p) => {
      const dx = p[0] - mx,
        dy = p[1] - my,
        len = Math.hypot(dx, dy) || 1;
      return [p[0] + (dx / len) * 0.35, p[1] + (dy / len) * 0.35];
    };
    ctx.beginPath();
    ctx.moveTo(...expand(a));
    ctx.lineTo(...expand(b));
    ctx.lineTo(...expand(c));
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(ax, bx, cy, dy, ex, fy);
    const x = Math.max(0, Math.floor(Math.min(x0, x1, x2))),
      y = Math.max(0, Math.floor(Math.min(y0, y1, y2))),
      width = Math.min(img.width - x, Math.ceil(Math.max(x0, x1, x2)) - x + 1),
      height = Math.min(
        img.height - y,
        Math.ceil(Math.max(y0, y1, y2)) - y + 1,
      );
    if (width > 0 && height > 0)
      ctx.drawImage(img, x, y, width, height, x, y, width, height);
    ctx.restore();
  }
  drawWater(img, time, camera, sx, sy) {
    if (!this.water) {
      const c = document.createElement('canvas');
      c.width = 545;
      c.height = 109;
      const x = c.getContext('2d');
      x.drawImage(img, 455, 694, 545, 109, 0, 0, 545, 109);
      const d = x.getImageData(0, 0, 545, 109);
      for (let i = 0; i < d.data.length; i += 4) {
        const r = d.data[i],
          g = d.data[i + 1],
          b = d.data[i + 2],
          y = Math.floor(i / 4 / 545);
        const mask =
          Math.max(0, Math.min(1, (b - r - 8) / 28)) *
          Math.max(0, Math.min(1, (b - g + 4) / 15)) *
          Math.min(1, y / 16, (109 - y) / 18);
        d.data[i + 3] = 255 * mask;
      }
      x.putImageData(d, 0, 0);
      this.water = c;
    }
    const ctx = this.ctx;
    ctx.setTransform(sx, 0, 0, sy, -camera.left * sx, -camera.top * sy);
    for (let y = 0; y < 109; y += 2) {
      const shift =
        2.2 * Math.sin(y * 0.38 + time * 2.1) +
        0.8 * Math.sin(y * 0.78 - time * 1.4);
      ctx.drawImage(this.water, 0, y, 545, 2, 455 + shift, 694 + y, 545, 2);
    }
  }
}
