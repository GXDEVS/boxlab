import { createStore } from './state/store.js';
import { applyMods } from './packing/volume-mods.js';
import { pack } from './packing/ffd3d.js';
import { calcWeights } from './core/weight.js';

import * as itemList from './ui/item-list.js';
import * as packagingForm from './ui/packaging-form.js';
import * as resultsPanel from './ui/results-panel.js';

import { createScene } from './three/scene.js';
import { makeBoxMesh } from './three/box-mesh.js';
import { makeItemMesh } from './three/item-mesh.js';

const debug = new URL(location.href).searchParams.get('debug') === '1';
const log = (...a) => debug && console.log('[boxlab]', ...a);

const [presetsItems, presetsPackaging] = await Promise.all([
  fetch('./src/data/presets-items.json').then(r => r.json()),
  fetch('./src/data/presets-packaging.json').then(r => r.json()),
]);

const store = createStore();

itemList.mount(document.getElementById('items-mount'), store, presetsItems);
packagingForm.mount(document.getElementById('packaging-mount'), store, presetsPackaging);

// Three.js viewport (graceful fallback if WebGL not available)
const viewport = document.getElementById('three-viewport');
let three = null;
try {
  three = createScene(viewport);
  document.getElementById('reset-camera').addEventListener('click', () => three.resetCamera());
} catch (e) {
  console.error('Three.js init failed', e);
  viewport.innerHTML = '<div class="p-6 text-center text-zinc-400">3D indisponível neste navegador. O cálculo continua funcionando.</div>';
  document.getElementById('reset-camera')?.remove();
}

let currentResults = null;
const results = resultsPanel.mount(document.getElementById('results'), () => currentResults);

const threeMeshes = [];

function recompute() {
  const s = store.get();
  const effective = applyMods(s.items, s.packagingOptions);
  const packing = pack(effective, s.box);
  for (const p of packing.positions) {
    const orig = s.items.find(i => i.id === p.id);
    p.color = orig?.color || '#3b82f6';
    p.name = orig?.name;
  }
  // calcWeights uses effective items so 'Peso real estimado' reflects bubble,
  // dropBoxes and removePlasticBags weight effects.
  const weights = calcWeights(effective, s.box);

  currentResults = { weights, packing };
  log('recompute', { weights, packing });

  results.rerender();
  if (three) renderThree(s.box, packing.positions, s.items);
}

function renderThree(box, positions, items) {
  while (threeMeshes.length) {
    const m = threeMeshes.pop();
    three.group.remove(m.mesh);
    m.dispose();
  }

  three.group.position.set(-box.length / 2, -box.height / 2, -box.width / 2);
  const boxMesh = makeBoxMesh(box);
  three.group.add(boxMesh.mesh);
  threeMeshes.push(boxMesh);

  for (const p of positions) {
    const item = items.find(i => i.id === p.id);
    if (!item) continue;
    const meshObj = makeItemMesh(p, { ...item, color: p.color }, { bubbled: !!item.bubbleWrap });
    three.group.add(meshObj.mesh);
    threeMeshes.push(meshObj);
  }

  const diag = Math.hypot(box.length, box.width, box.height);
  three.camera.far = Math.max(1000, diag * 5);
  three.camera.updateProjectionMatrix();
}

let debounceTimer = 0;
store.subscribe(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(recompute, 80);
});

recompute();

if (debug) {
  window.__boxlab = { store, recompute };
  console.log('[boxlab] debug mode on, window.__boxlab available');
}
