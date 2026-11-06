// Tiny pixel painter: compose shapes on a material grid, then auto-shade
// (light from top-left, 3-tone ramps) and auto-outline. Output is a 2D array
// of CSS colours (null = transparent) that <PixelSprite pixels> renders.

export const OUTLINE = '#170f22';

// [highlight, base, shadow]
export const MATS = {
  skin:   ['#ffe3c8', '#f3b88e', '#c97f5f'],
  pale:   ['#fff4ee', '#efd6d2', '#bf9ea6'],
  fae:    ['#e4fbcf', '#b5e39a', '#76ad6a'],
  orc:    ['#c7d1a4', '#97a37a', '#636c4f'],
  white:  ['#ffffff', '#e7e3da', '#aaa39a'],
  blue:   ['#7fb0ff', '#3c66d8', '#24398f'],
  navy:   ['#4d68b8', '#2a3f86', '#18245a'],
  sky:    ['#c8e6ff', '#8cc2f2', '#5a8fca'],
  gold:   ['#ffe88a', '#f0b432', '#a8701a'],
  red:    ['#ff7a68', '#d63c34', '#8c1d26'],
  crimson:['#c23a45', '#8a1c2a', '#52101c'],
  metal:  ['#f2f6fa', '#b3bdca', '#6f7a8b'],
  iron:   ['#8d95a6', '#5b6273', '#353a48'],
  black:  ['#4e4860', '#2f2a3d', '#1d1a28'],
  violet: ['#c595ff', '#8b52d6', '#55298f'],
  plum:   ['#6b3f8c', '#43265e', '#28163b'],
  green:  ['#a6e872', '#56b04c', '#2c6d36'],
  leaf:   ['#7fd06a', '#3f9446', '#22592c'],
  wood:   ['#d39a5e', '#9a6233', '#5f3a1f'],
  brown:  ['#a8703f', '#74482a', '#4a2c1a'],
  bone:   ['#fff6dc', '#e2d2ac', '#a99872'],
  glow:   ['#ffffff', '#bff4ff', '#5fcff5'],
  magic:  ['#ffe6ff', '#e08cff', '#9b3fd6'],
  stone:  ['#a7a3b8', '#757087', '#4c475c'],
  pink:   ['#ffd1e6', '#f27aa8', '#b03c6e'],
};

export function paint(w, h, draw, { outline = OUTLINE, shade = true } = {}) {
  const mat = Array.from({ length: h }, () => Array(w).fill(null));
  const raw = Array.from({ length: h }, () => Array(w).fill(null));
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  const set = (x, y, m) => {
    x = Math.round(x); y = Math.round(y);
    if (!inb(x, y)) return;
    mat[y][x] = m; raw[y][x] = null;
  };
  const api = {
    px: set,
    rect(x0, y0, x1, y1, m) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, m); },
    ellipse(cx, cy, rx, ry, m) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
          if (dx * dx + dy * dy <= 1) set(x, y, m);
        }
    },
    line(x0, y0, x1, y1, m, thick = 1) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / steps), y = Math.round(y0 + ((y1 - y0) * i) / steps);
        for (let t = 0; t < thick; t++) set(x + t, y, m);
      }
    },
    poly(pts, m) {
      const ys = pts.map(p => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
        for (let x = 0; x < w; x++) {
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) set(x, y, m);
        }
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) api.line(pts[j][0], pts[j][1], pts[i][0], pts[i][1], m);
    },
    /** unshaded fixed colour (eyes, sparkles, details) */
    dot(x, y, color) { if (inb(x, y)) { raw[y][x] = color; mat[y][x] = '__raw'; } },
    dots(list, color) { list.forEach(([x, y]) => api.dot(x, y, color)); },
    clear(x, y) { if (inb(x, y)) { mat[y][x] = null; raw[y][x] = null; } },
  };

  draw(api);

  const out = Array.from({ length: h }, () => Array(w).fill(null));
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const m = mat[y][x];
      let end = x;
      while (end + 1 < w && mat[y][end + 1] === m) end++;
      if (m && m !== '__raw') {
        const ramp = Array.isArray(m) ? m : MATS[m] || [m, m, m];
        const L = end - x + 1;
        for (let i = x; i <= end; i++) {
          let tone = 1;
          if (shade) {
            const rel = L > 1 ? (i - x) / (L - 1) : 0;
            if (L >= 4 && rel > 0.68) tone = 2;
            const topEdge = y === 0 || mat[y - 1][i] !== m;
            if (tone === 1 && topEdge && L >= 2) tone = 0;
            if (tone === 1 && L >= 6 && i === x) tone = 0;
            const bottomEdge = y === h - 1 || mat[y + 1][i] !== m;
            if (bottomEdge && L >= 3 && tone === 1 && rel > 0.4) tone = 2;
          }
          out[y][i] = ramp[tone];
        }
      } else if (m === '__raw') {
        for (let i = x; i <= end; i++) out[y][i] = raw[y][i];
      }
      x = end + 1;
    }
  }
  if (outline) {
    const filled = (x, y) => inb(x, y) && out[y][x] !== null;
    const copy = out.map(r => [...r]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) copy[y][x] = outline;
    return copy;
  }
  return out;
}
