const HARD_LIMIT = 50;

export function pack(items, box) {
  if (items.length > HARD_LIMIT) {
    return { fits: false, positions: [], overflow: items.slice(), tooManyItems: true, packingFootprint: null };
  }

  const valid = [];
  const invalid = [];
  for (const it of items) {
    if (it.length > 0 && it.width > 0 && it.height > 0) valid.push(it);
    else invalid.push(it);
  }

  // FFD: sort by volume desc
  valid.sort((a, b) => b.length * b.width * b.height - a.length * a.width * a.height);

  const placed = [];
  const positions = [];
  const overflow = [...invalid];
  let extremePoints = [{ x: 0, y: 0, z: 0 }];

  for (const it of valid) {
    let best = null;
    let bestScore = Infinity;

    for (const ep of extremePoints) {
      for (const rot of rotations(it)) {
        if (!fitsInBox(ep, rot, box)) continue;
        if (collides(ep, rot, placed)) continue;
        const score = ep.x + ep.y * box.length + ep.z * box.length * box.width;
        if (score < bestScore) {
          bestScore = score;
          best = { ep, rot };
        }
      }
    }

    if (!best) {
      overflow.push(it);
      continue;
    }

    const { ep, rot } = best;
    placed.push({ x: ep.x, y: ep.y, z: ep.z, l: rot.length, w: rot.width, h: rot.height });
    positions.push({
      id: it.id,
      x: ep.x, y: ep.y, z: ep.z,
      dims: [rot.length, rot.width, rot.height],
      rotated: rot.rotated,
    });

    extremePoints = extremePoints.filter(p => !(p.x === ep.x && p.y === ep.y && p.z === ep.z));
    extremePoints.push({ x: ep.x + rot.length, y: ep.y, z: ep.z });
    extremePoints.push({ x: ep.x, y: ep.y + rot.width, z: ep.z });
    extremePoints.push({ x: ep.x, y: ep.y, z: ep.z + rot.height });
    extremePoints = pruneDominated(extremePoints, placed);
  }

  const fits = overflow.length === 0;
  const packingFootprint = placed.length === 0 ? null : footprint(placed);

  return { fits, positions, overflow, tooManyItems: false, packingFootprint };
}

function rotations(it) {
  const dims = [it.length, it.width, it.height];
  const seen = new Set();
  const out = [];
  const perms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  for (const [a, b, c] of perms) {
    const key = `${dims[a]}|${dims[b]}|${dims[c]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      length: dims[a], width: dims[b], height: dims[c],
      rotated: !(a === 0 && b === 1 && c === 2),
    });
  }
  return out;
}

function fitsInBox(ep, rot, box) {
  return ep.x + rot.length <= box.length
      && ep.y + rot.width  <= box.width
      && ep.z + rot.height <= box.height;
}

function collides(ep, rot, placed) {
  const a = {
    x1: ep.x, y1: ep.y, z1: ep.z,
    x2: ep.x + rot.length, y2: ep.y + rot.width, z2: ep.z + rot.height,
  };
  for (const p of placed) {
    const b = {
      x1: p.x, y1: p.y, z1: p.z,
      x2: p.x + p.l, y2: p.y + p.w, z2: p.z + p.h,
    };
    if (a.x1 < b.x2 && a.x2 > b.x1 &&
        a.y1 < b.y2 && a.y2 > b.y1 &&
        a.z1 < b.z2 && a.z2 > b.z1) return true;
  }
  return false;
}

function pruneDominated(eps, placed) {
  return eps.filter(p => !placed.some(b =>
    p.x >= b.x && p.x < b.x + b.l &&
    p.y >= b.y && p.y < b.y + b.w &&
    p.z >= b.z && p.z < b.z + b.h
  ));
}

function footprint(placed) {
  let l = 0, w = 0, h = 0;
  for (const p of placed) {
    l = Math.max(l, p.x + p.l);
    w = Math.max(w, p.y + p.w);
    h = Math.max(h, p.z + p.h);
  }
  return { length: l, width: w, height: h };
}
