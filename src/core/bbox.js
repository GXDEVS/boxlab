// Compute the minimum bounding box that fits a set of (effective) items
// when packed by the FFD3D algorithm. Used by ship-mode='original' so the
// container auto-shrinks to whatever the items take up — no outer wrapping.
import { pack } from '../packing/ffd3d.js';

export function bboxOfItems(effectiveItems) {
  if (!effectiveItems.length) {
    return { length: 0, width: 0, height: 0, positions: [], overflow: [] };
  }

  // Pack into a generously-sized virtual box, then take footprint as the
  // actual bbox. The virtual box must be big enough to never overflow.
  const totalVol = effectiveItems.reduce((s, it) => s + (it.length * it.width * it.height), 0);
  const safe = Math.max(1, Math.cbrt(totalVol) * 4);

  const r = pack(effectiveItems, { length: safe, width: safe, height: safe });

  if (!r.packingFootprint) {
    // Single item edge case — bbox is the item itself.
    const it = effectiveItems[0];
    return {
      length: it.length, width: it.width, height: it.height,
      positions: [{ id: it.id, x: 0, y: 0, z: 0, dims: [it.length, it.width, it.height], rotated: false }],
      overflow: r.overflow,
    };
  }

  return {
    length: r.packingFootprint.length,
    width: r.packingFootprint.width,
    height: r.packingFootprint.height,
    positions: r.positions,
    overflow: r.overflow,
  };
}
