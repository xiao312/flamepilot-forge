// Shape-preserving cubic Hermite interpolation. Display-only; never extrapolates.
export function validatePoints(points) {
  if (!Array.isArray(points) || !points.length) throw new Error('Series requires at least one point');
  for (let i = 0; i < points.length; i++) {
    if (!Number.isFinite(points[i].x) || !Number.isFinite(points[i].y)) throw new Error('Nonfinite series value');
    if (i && points[i].x <= points[i - 1].x) throw new Error('Series x values must be strictly increasing');
  }
}

function endpoint(h0, h1, d0, d1) {
  let slope = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (Math.sign(slope) !== Math.sign(d0)) slope = 0;
  else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(slope) > 3 * Math.abs(d0)) slope = 3 * d0;
  return slope;
}

export function interpolate(points, method = 'pchip', subdivisions = 16) {
  validatePoints(points);
  if (!['pchip', 'linear', 'points'].includes(method)) throw new Error('Unknown interpolation method');
  if (!Number.isInteger(subdivisions) || subdivisions < 1 || subdivisions > 128) throw new Error('Invalid display subdivisions');
  if (points.length < 3 || method !== 'pchip') return points.map(({x, y}) => ({x, y}));
  const n = points.length;
  const h = points.slice(1).map((p, i) => p.x - points[i].x);
  const d = points.slice(1).map((p, i) => (p.y - points[i].y) / h[i]);
  const m = new Array(n).fill(0);
  m[0] = endpoint(h[0], h[1], d[0], d[1]);
  m[n - 1] = endpoint(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] === 0 || d[i] === 0 || Math.sign(d[i - 1]) !== Math.sign(d[i])) continue;
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  const result = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < subdivisions; j++) {
      const t = j / subdivisions, t2 = t * t, t3 = t2 * t;
      result.push({ x: points[i].x + t * h[i], y:
        (2 * t3 - 3 * t2 + 1) * points[i].y + (t3 - 2 * t2 + t) * h[i] * m[i]
        + (-2 * t3 + 3 * t2) * points[i + 1].y + (t3 - t2) * h[i] * m[i + 1] });
    }
  }
  result.push({x: points[n - 1].x, y: points[n - 1].y});
  return result;
}
