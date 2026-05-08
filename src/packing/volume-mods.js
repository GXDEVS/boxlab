// Apply order:
//   1. dropBoxes        — substitute original-box dims with coreDims AND subtract originalBoxWeight
//   2. removePlasticBags — shrink dims 5% AND subtract originalPlasticWeight
//   3. vacuum            — compress longest dim 30% (no weight change)
//   4. per-item bagged   — +0.4cm in each axis AND +5g (small plastic bag)
//   5. per-item bubble   — +1cm in each axis AND add bubble wrap weight by surface area
//   6. air layer (global) — +airLayerCm in each axis on every item (no weight change)
//
// Bag goes BEFORE bubble in the apply order so that when both are checked the bag sits inside
// the bubble layer — that matches how CSSBuy actually packages (item → bag → bubble).
//
// Bubble wrap density: ~1g per ~100cm² of surface area.
// Bag weight: flat 5g for a small plastic bag. Real bags vary 3-15g; we pick a middle estimate.
//
// Weight values are clamped to ≥ 0 after each subtraction.

const BAG_PADDING_CM = 0.4;
const BAG_WEIGHT_G   = 5;

export function applyMods(items, options = {}) {
  const air = Math.max(0, parseFloat(options.airLayerCm ?? 0) || 0);

  return items.map((it) => {
    const out = { ...it, flags: { ...it.flags } };

    if (options.dropBoxes && out.flags?.hasOriginalBox && out.coreDims) {
      out.length = out.coreDims.length;
      out.width = out.coreDims.width;
      out.height = out.coreDims.height;
      const boxW = Number(out.originalBoxWeight) || 0;
      out.weight = Math.max(0, (out.weight ?? 0) - boxW);
    }

    if (options.removePlasticBags && out.flags?.hasOriginalPlastic) {
      out.length *= 0.95;
      out.width *= 0.95;
      out.height *= 0.95;
      const plastic = Number(out.originalPlasticWeight) || 0;
      out.weight = Math.max(0, (out.weight ?? 0) - plastic);
    }

    if (options.vacuum && out.flags?.isSoft) {
      const dims = ['length', 'width', 'height'];
      const largest = dims.reduce((a, b) => (out[a] >= out[b] ? a : b));
      out[largest] *= 0.7;
    }

    if (out.bagged) {
      out.length += BAG_PADDING_CM;
      out.width  += BAG_PADDING_CM;
      out.height += BAG_PADDING_CM;
      out.weight = (out.weight ?? 0) + BAG_WEIGHT_G;
    }

    if (out.bubbleWrap) {
      out.length += 1;
      out.width += 1;
      out.height += 1;
      const surface = 2 * (out.length * out.width + out.length * out.height + out.width * out.height);
      out.weight = (out.weight ?? 0) + Math.round(surface / 100);
    }

    if (air > 0) {
      out.length += air;
      out.width += air;
      out.height += air;
    }

    return out;
  });
}
