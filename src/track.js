// Drift Rally Mini — track geometry in game space (px; x right, y down on the ground plane).
function buildTrack(theme, rev) {
  const T = TRACKS[theme]; let pts = T.pts.map(p => [p[0] * U, p[1] * U]);
  if (rev) pts = [pts[0]].concat(pts.slice(1).reverse());
  const n = pts.length, tx = new Float32Array(n), ty = new Float32Array(n), nx = new Float32Array(n), ny = new Float32Array(n), curv = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n]; let dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; tx[i] = dx / l; ty[i] = dy / l; nx[i] = -ty[i]; ny[i] = tx[i]; }
  // signed curvature per px (positive = turning right on screen, y-down), smoothed
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; let d = Math.atan2(ty[j], tx[j]) - Math.atan2(ty[i], tx[i]); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; raw[i] = d / U; }
  for (let i = 0; i < n; i++) { let s = 0; for (let k = -5; k <= 5; k++) s += raw[(i + k + n) % n]; curv[i] = s / 11; }
  const hw = T.hw * U, bar = T.bar * U;
  // racing line: offset towards the inside of corners (apex slightly late), then smoothed twice
  let off = new Float32Array(n);
  for (let i = 0; i < n; i++) { let c = 0; for (let k = -2; k <= 10; k++) c += curv[(i + k + n) % n]; c /= 13; off[i] = Math.max(-.72, Math.min(.72, c * U * 9)) * hw; }
  for (let pass = 0; pass < 3; pass++) { const o2 = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = -9; k <= 9; k++) s += off[(i + k + n) % n]; o2[i] = s / 19; } off = o2; }
  const line = pts.map((p, i) => [p[0] + nx[i] * off[i], p[1] + ny[i] * off[i]]);
  // safe speed per index from the tightest curvature in the next stretch
  const vsafe = new Float32Array(n);
  for (let i = 0; i < n; i++) { let c = 0; for (let k = 0; k < 14; k++) c = Math.max(c, Math.abs(curv[(i + k) % n])); vsafe[i] = c > 1e-6 ? Math.sqrt(1 / c) : 9999; }
  return { theme, rev: !!rev, pts, n, tx, ty, nx, ny, curv, off, line, vsafe, hw, curb: hw + .75 * U, bar, w: T.size[0] * U, h: T.size[1] * U, len: n * U };
}
// nearest segment to (x,y). hint < 0 = full search. Returns {i, t, off (signed, + = right of travel), d}
function locate(tr, x, y, hint) {
  const n = tr.n, P = tr.pts; let best = 1e18, bi = 0, bt = 0;
  const scan = (i) => { const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = a[0] + dx * t - x, py = a[1] + dy * t - y, d = px * px + py * py;
    if (d < best) { best = d; bi = i; bt = t; } };
  if (hint < 0) for (let i = 0; i < n; i++) scan(i); else for (let k = -14; k <= 26; k++) scan((hint + k + n) % n);
  const a = P[bi], b = P[(bi + 1) % n], cx = a[0] + (b[0] - a[0]) * bt, cy = a[1] + (b[1] - a[1]) * bt;
  const j = (bi + 1) % n, nxi = tr.nx[bi] * (1 - bt) + tr.nx[j] * bt, nyi = tr.ny[bi] * (1 - bt) + tr.ny[j] * bt;
  return { i: bi, t: bt, off: (x - cx) * nxi + (y - cy) * nyi, d: Math.sqrt(best), cx, cy, nx: nxi, ny: nyi };
}
