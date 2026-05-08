import * as THREE from 'three';

// position: { x, y, z, dims: [length, width, height] } from packing world.
// Packing axes: x=length, y=width, z=height.
// Three axes:   x=length, y=height, z=width.
// Mapping: three.x = pack.x + l/2; three.y = pack.z + h/2; three.z = pack.y + w/2.
//
// Visual layers (from inner to outer):
//   inner cube   — solid colored item
//   bag shell    — translucent gray (when bagged)
//   bubble shell — translucent light blue with dashed edges (when bubbled)
//
// When both bag + bubble, the bag sits inside the bubble. Insets are tiny so
// the layers stay visually distinct without dramatically shrinking the item.
export function makeItemMesh(position, item, opts = {}) {
  const [l, w, h] = position.dims;
  const bubbled = !!opts.bubbled;
  const bagged  = !!opts.bagged;

  // When wrapped, draw the item itself a touch smaller so the wrap layer is visible.
  const innerInset = bubbled || bagged ? 1 : 0;
  const inL = Math.max(0.1, l - innerInset);
  const inW = Math.max(0.1, w - innerInset);
  const inH = Math.max(0.1, h - innerInset);

  const innerGeo = new THREE.BoxGeometry(inL, inH, inW);
  const innerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(item.color || '#3b82f6'),
    transparent: true,
    opacity: 0.9,
  });
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.position.set(position.x + l / 2, position.z + h / 2, position.y + w / 2);
  innerMesh.userData = { id: item.id, name: item.name, dims: [l, w, h], bagged, bubbled };

  const innerEdgesGeo = new THREE.EdgesGeometry(innerGeo);
  const innerLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const innerEdges = new THREE.LineSegments(innerEdgesGeo, innerLineMat);
  innerMesh.add(innerEdges);

  const group = new THREE.Group();
  group.add(innerMesh);

  const disposers = [
    () => { innerGeo.dispose(); innerMat.dispose(); innerEdgesGeo.dispose(); innerLineMat.dispose(); },
  ];

  // Bag shell — gray, soft, no dashed edges (suggests smooth plastic)
  if (bagged) {
    const bagDim = bubbled
      ? { l: l - 0.5, w: w - 0.5, h: h - 0.5 }   // sits inside the bubble layer
      : { l, w, h };
    const bagGeo = new THREE.BoxGeometry(bagDim.l, bagDim.h, bagDim.w);
    const bagMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,        // zinc-400, plastic-bag gray
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
    });
    const bagMesh = new THREE.Mesh(bagGeo, bagMat);
    bagMesh.position.copy(innerMesh.position);
    group.add(bagMesh);
    disposers.push(() => { bagGeo.dispose(); bagMat.dispose(); });
  }

  // Bubble shell — light blue with dashed edges (current behavior)
  if (bubbled) {
    const shellGeo = new THREE.BoxGeometry(l, h, w);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.copy(innerMesh.position);

    const shellEdgesGeo = new THREE.EdgesGeometry(shellGeo);
    const shellLineMat = new THREE.LineDashedMaterial({
      color: 0x93c5fd, dashSize: 0.6, gapSize: 0.3,
      transparent: true, opacity: 0.7,
    });
    const shellEdges = new THREE.LineSegments(shellEdgesGeo, shellLineMat);
    shellEdges.computeLineDistances();
    shellEdges.position.copy(innerMesh.position);

    group.add(shell);
    group.add(shellEdges);
    disposers.push(() => { shellGeo.dispose(); shellMat.dispose(); shellEdgesGeo.dispose(); shellLineMat.dispose(); });
  }

  return {
    mesh: group,
    dispose() { for (const d of disposers) d(); },
  };
}
