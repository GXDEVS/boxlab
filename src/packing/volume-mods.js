// Apply order:
//   1. dropBoxes        — substitute original-box dims with coreDims (per item with hasOriginalBox)
//   2. removePlasticBags — shrink dims 5% (per item with hasOriginalPlastic)
//   3. vacuum            — compress longest dim 30% (per item with isSoft)
//   4. per-item bubble   — +1cm in each axis on items where item.bubbleWrap=true
//   5. air layer (global) — +airLayerCm in each axis on every item (gap pra ficar folgado)
export function applyMods(items, options = {}) {
  const air = Math.max(0, parseFloat(options.airLayerCm ?? 0) || 0);

  return items.map((it) => {
    const out = { ...it, flags: { ...it.flags } };

    if (options.dropBoxes && out.flags?.hasOriginalBox && out.coreDims) {
      out.length = out.coreDims.length;
      out.width = out.coreDims.width;
      out.height = out.coreDims.height;
    }

    if (options.removePlasticBags && out.flags?.hasOriginalPlastic) {
      out.length *= 0.95;
      out.width *= 0.95;
      out.height *= 0.95;
    }

    if (options.vacuum && out.flags?.isSoft) {
      const dims = ['length', 'width', 'height'];
      const largest = dims.reduce((a, b) => (out[a] >= out[b] ? a : b));
      out[largest] *= 0.7;
    }

    if (out.bubbleWrap) {
      out.length += 1;
      out.width += 1;
      out.height += 1;
    }

    if (air > 0) {
      out.length += air;
      out.width += air;
      out.height += air;
    }

    return out;
  });
}
