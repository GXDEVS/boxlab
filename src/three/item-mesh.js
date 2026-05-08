import * as THREE from 'three';

// position: { x, y, z, dims: [length, width, height] } from packing world.
// Packing axes: x=length, y=width, z=height.
// Three axes:   x=length, y=height, z=width.
// Mapping: three.x = pack.x + l/2; three.y = pack.z + h/2; three.z = pack.y + w/2.
//
// When `bubbled=true` we render a translucent outer shell (~+1cm each axis)
// to visualize the bubble wrap layer that volume-mods already accounted for.
export function makeItemMesh(position, item, opts = {}) {
  const [l, w, h] = position.dims;
  const bubbled = !!opts.bubbled;

  // For visual clarity: when bubbled, draw the inner solid slightly smaller
  // so the user can see both the item and its bubble shell distinctly.
  const innerInset = bubbled ? 1 : 0;
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
  innerMesh.userData = { id: item.id, name: item.name, dims: [l, w, h], bubbled };

  const innerEdgesGeo = new THREE.EdgesGeometry(innerGeo);
  const innerLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const innerEdges = new THREE.LineSegments(innerEdgesGeo, innerLineMat);
  innerMesh.add(innerEdges);

  const group = new THREE.Group();
  group.add(innerMesh);

  let shellGeo = null, shellMat = null, shellEdgesGeo = null, shellLineMat = null;
  if (bubbled) {
    shellGeo = new THREE.BoxGeometry(l, h, w);
    shellMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,        // light blue-ish bubble feel
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.copy(innerMesh.position);

    shellEdgesGeo = new THREE.EdgesGeometry(shellGeo);
    shellLineMat = new THREE.LineDashedMaterial({
      color: 0x93c5fd, dashSize: 0.6, gapSize: 0.3,
      transparent: true, opacity: 0.7,
    });
    const shellEdges = new THREE.LineSegments(shellEdgesGeo, shellLineMat);
    shellEdges.computeLineDistances();
    shellEdges.position.copy(innerMesh.position);

    group.add(shell);
    group.add(shellEdges);
  }

  return {
    mesh: group,
    dispose() {
      innerGeo.dispose();
      innerMat.dispose();
      innerEdgesGeo.dispose();
      innerLineMat.dispose();
      shellGeo?.dispose();
      shellMat?.dispose();
      shellEdgesGeo?.dispose();
      shellLineMat?.dispose();
    },
  };
}
