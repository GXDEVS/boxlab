// Order: dropBoxes -> removePlasticBags -> vacuum -> bubbleWrap
export function applyMods(items, options = {}) {
  return items.map((it) => {
    const out = { ...it, flags: { ...it.flags } };

    if (options.dropBoxes && out.flags.hasOriginalBox && out.coreDims) {
      out.length = out.coreDims.length;
      out.width = out.coreDims.width;
      out.height = out.coreDims.height;
    }

    if (options.removePlasticBags && out.flags.hasOriginalPlastic) {
      out.length *= 0.95;
      out.width *= 0.95;
      out.height *= 0.95;
    }

    if (options.vacuum && out.flags.isSoft) {
      const dims = ['length', 'width', 'height'];
      const largest = dims.reduce((a, b) => (out[a] >= out[b] ? a : b));
      out[largest] *= 0.7;
    }

    if (options.bubbleWrap) {
      out.length += 1;
      out.width += 1;
      out.height += 1;
    }

    return out;
  });
}
